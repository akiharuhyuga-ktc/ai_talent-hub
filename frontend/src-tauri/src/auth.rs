use std::collections::HashMap;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine as _;
use rand::{thread_rng, RngCore};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Runtime};
use tauri_plugin_opener::OpenerExt;
use tiny_http::{Header, Response, Server};

const AUTHORIZE_TIMEOUT_SECS: u64 = 300;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredTokensDto {
    access_token: String,
    refresh_token: String,
    id_token: String,
    expires_at: i64,
}

#[derive(Deserialize)]
struct AzureTokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    id_token: Option<String>,
    expires_in: i64,
}

#[tauri::command]
pub async fn auth_login<R: Runtime>(
    app: AppHandle<R>,
    client_id: String,
    tenant_id: String,
    scope: String,
) -> Result<StoredTokensDto, String> {
    tauri::async_runtime::spawn_blocking(move || login_blocking(app, client_id, tenant_id, scope))
        .await
        .map_err(|e| format!("内部エラー: {e}"))?
}

#[tauri::command]
pub async fn auth_refresh(
    client_id: String,
    tenant_id: String,
    scope: String,
    refresh_token: String,
) -> Result<StoredTokensDto, String> {
    tauri::async_runtime::spawn_blocking(move || {
        refresh_blocking(client_id, tenant_id, scope, refresh_token)
    })
    .await
    .map_err(|e| format!("内部エラー: {e}"))?
}

fn login_blocking<R: Runtime>(
    app: AppHandle<R>,
    client_id: String,
    tenant_id: String,
    scope: String,
) -> Result<StoredTokensDto, String> {
    // OS に空き port を割り当ててもらい、loopback で待ち受ける。
    let server = Server::http(("127.0.0.1", 0u16))
        .map_err(|e| format!("loopback bind 失敗: {e}"))?;
    let port = server
        .server_addr()
        .to_ip()
        .ok_or_else(|| "loopback アドレス取得に失敗".to_string())?
        .port();
    let redirect_uri = format!("http://localhost:{port}/");

    let (verifier, challenge) = generate_pkce();
    let state = random_token(32);

    let auth_url = build_authorize_url(
        &tenant_id,
        &client_id,
        &redirect_uri,
        &scope,
        &state,
        &challenge,
    )?;

    app.opener()
        .open_url(auth_url.as_str(), None::<&str>)
        .map_err(|e| format!("ブラウザ起動に失敗: {e}"))?;

    let request = server
        .recv_timeout(Duration::from_secs(AUTHORIZE_TIMEOUT_SECS))
        .map_err(|e| format!("loopback 受信エラー: {e}"))?
        .ok_or_else(|| "認証がタイムアウトしました".to_string())?;

    let request_url = format!("http://localhost:{port}{}", request.url());
    let parsed = url::Url::parse(&request_url)
        .map_err(|e| format!("redirect URL の解析に失敗: {e}"))?;
    let params: HashMap<String, String> = parsed.query_pairs().into_owned().collect();

    let html = "<!DOCTYPE html><html lang=\"ja\"><head><meta charset=\"utf-8\">\
                <title>サインイン完了</title></head><body \
                style=\"font-family:system-ui,sans-serif;text-align:center;padding:48px;\">\
                <h2>サインイン完了</h2>\
                <p>このタブを閉じてアプリに戻ってください。</p>\
                <script>window.close();</script></body></html>";
    let response = Response::from_string(html).with_header(
        Header::from_bytes(&b"Content-Type"[..], &b"text/html; charset=utf-8"[..])
            .expect("static header"),
    );
    let _ = request.respond(response);
    drop(server);

    if let Some(err) = params.get("error") {
        let desc = params
            .get("error_description")
            .map(String::as_str)
            .unwrap_or("");
        return Err(format!("認可サーバからエラー: {err} {desc}"));
    }

    let code = params
        .get("code")
        .ok_or_else(|| "code が返されませんでした".to_string())?;
    let returned_state = params
        .get("state")
        .ok_or_else(|| "state が返されませんでした".to_string())?;
    if returned_state != &state {
        return Err("state の不一致を検出しました（CSRF 防止）".into());
    }

    exchange_code(&tenant_id, &client_id, &scope, &redirect_uri, code, &verifier)
}

fn refresh_blocking(
    client_id: String,
    tenant_id: String,
    scope: String,
    refresh_token: String,
) -> Result<StoredTokensDto, String> {
    let token_url =
        format!("https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token");
    let body = [
        ("client_id", client_id.as_str()),
        ("scope", scope.as_str()),
        ("grant_type", "refresh_token"),
        ("refresh_token", refresh_token.as_str()),
    ];
    let response = reqwest::blocking::Client::new()
        .post(&token_url)
        .form(&body)
        .send()
        .map_err(|e| format!("refresh リクエストに失敗: {e}"))?;
    if !response.status().is_success() {
        let text = response.text().unwrap_or_default();
        return Err(format!("refresh に失敗: {text}"));
    }
    let json: AzureTokenResponse = response
        .json()
        .map_err(|e| format!("refresh レスポンス解析に失敗: {e}"))?;
    Ok(StoredTokensDto {
        access_token: json.access_token,
        refresh_token: json.refresh_token.unwrap_or(refresh_token),
        id_token: json.id_token.unwrap_or_default(),
        expires_at: now_ms() + json.expires_in * 1_000,
    })
}

fn exchange_code(
    tenant_id: &str,
    client_id: &str,
    scope: &str,
    redirect_uri: &str,
    code: &str,
    verifier: &str,
) -> Result<StoredTokensDto, String> {
    let token_url =
        format!("https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token");
    let body = [
        ("client_id", client_id),
        ("scope", scope),
        ("code", code),
        ("redirect_uri", redirect_uri),
        ("grant_type", "authorization_code"),
        ("code_verifier", verifier),
    ];
    let response = reqwest::blocking::Client::new()
        .post(&token_url)
        .form(&body)
        .send()
        .map_err(|e| format!("token リクエストに失敗: {e}"))?;
    if !response.status().is_success() {
        let text = response.text().unwrap_or_default();
        return Err(format!("token 交換に失敗: {text}"));
    }
    let json: AzureTokenResponse = response
        .json()
        .map_err(|e| format!("token レスポンス解析に失敗: {e}"))?;
    Ok(StoredTokensDto {
        access_token: json.access_token,
        refresh_token: json
            .refresh_token
            .ok_or_else(|| "refresh_token が返されませんでした".to_string())?,
        id_token: json.id_token.unwrap_or_default(),
        expires_at: now_ms() + json.expires_in * 1_000,
    })
}

fn build_authorize_url(
    tenant_id: &str,
    client_id: &str,
    redirect_uri: &str,
    scope: &str,
    state: &str,
    code_challenge: &str,
) -> Result<url::Url, String> {
    let mut auth_url = url::Url::parse(&format!(
        "https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/authorize"
    ))
    .map_err(|e| format!("authorize URL 構築に失敗: {e}"))?;
    auth_url
        .query_pairs_mut()
        .append_pair("client_id", client_id)
        .append_pair("response_type", "code")
        .append_pair("redirect_uri", redirect_uri)
        .append_pair("response_mode", "query")
        .append_pair("scope", scope)
        .append_pair("state", state)
        .append_pair("code_challenge", code_challenge)
        .append_pair("code_challenge_method", "S256");
    Ok(auth_url)
}

fn generate_pkce() -> (String, String) {
    let mut bytes = [0u8; 32];
    thread_rng().fill_bytes(&mut bytes);
    let verifier = URL_SAFE_NO_PAD.encode(bytes);
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    let challenge = URL_SAFE_NO_PAD.encode(hasher.finalize());
    (verifier, challenge)
}

fn random_token(len: usize) -> String {
    let mut bytes = vec![0u8; len];
    thread_rng().fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}
