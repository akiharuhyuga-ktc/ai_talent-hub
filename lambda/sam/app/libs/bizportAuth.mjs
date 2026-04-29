// bizport `/api/v1/users/me` を叩いて Entra JWT 検証を委譲するモジュール
//
// Lambda 自身は JWT 鍵を持たず、bizport が JWT 署名・iss・aud・exp を厳格検証している前提で
// パススルー検証する (probe で確認済: 改竄署名・期限切れ・alg=none・iss/aud 改竄 全て 401)。

export class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = "AuthError";
  }
}

const BIZPORT_API_BASE_URL = process.env.BizportApiBaseUrl;
const BIZPORT_API_TIMEOUT_MS = Number(process.env.BizportApiTimeoutMs ?? "10000");
const BIZPORT_API_PATH = "/api/v1/users/me";

/**
 * Authorization ヘッダを bizport `/api/v1/users/me` に転送してユーザー情報を取得する。
 *
 * @param {string|undefined} authorizationHeader
 * @returns {Promise<object>} bizport `/api/v1/users/me` のレスポンス JSON
 * @throws {AuthError} ヘッダ欠落 / 2xx 以外 / タイムアウト
 */
export async function validateViaBizport(authorizationHeader) {
  if (!authorizationHeader) {
    throw new AuthError("Authorization header missing");
  }

  if (!BIZPORT_API_BASE_URL) {
    throw new AuthError("BizportApiBaseUrl env var is not set");
  }

  const url = `${BIZPORT_API_BASE_URL.replace(/\/$/, "")}${BIZPORT_API_PATH}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BIZPORT_API_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      method: "GET",
      headers: { Authorization: authorizationHeader },
      signal: controller.signal,
    });
    if (!resp.ok) {
      throw new AuthError(`bizport ${BIZPORT_API_PATH} returned ${resp.status}`);
    }
    return await resp.json();
  } catch (e) {
    if (e instanceof AuthError) throw e;
    if (e.name === "AbortError") {
      throw new AuthError(`bizport ${BIZPORT_API_PATH} timed out`);
    }
    throw new AuthError(`bizport ${BIZPORT_API_PATH} failed: ${e.message}`);
  } finally {
    clearTimeout(timer);
  }
}
