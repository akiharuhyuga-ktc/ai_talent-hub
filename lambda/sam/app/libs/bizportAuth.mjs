// bizport `/api/me` を叩いて Entra JWT を検証するモジュール

export class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = "AuthError";
  }
}

const BIZPORT_API_BASE_URL = process.env.BizportApiBaseUrl;
const BIZPORT_API_TIMEOUT_MS = Number(process.env.BizportApiTimeoutMs ?? "10000");

/**
 * Authorization ヘッダを bizport `/api/me` に転送してユーザー情報を取得する。
 *
 * @param {string|undefined} authorizationHeader
 * @returns {Promise<object>} bizport `/api/me` のレスポンス JSON
 * @throws {AuthError} ヘッダ欠落 / `/api/me` が 200 以外を返した場合
 */
export async function verifyJwt(authorizationHeader) {
  if (!authorizationHeader) {
    throw new AuthError("Authorization header missing");
  }

  if (!BIZPORT_API_BASE_URL) {
    throw new AuthError("BizportApiBaseUrl env var is not set");
  }

  const url = `${BIZPORT_API_BASE_URL.replace(/\/$/, "")}/api/me`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BIZPORT_API_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      method: "GET",
      headers: { Authorization: authorizationHeader },
      signal: controller.signal,
    });
    if (!resp.ok) {
      throw new AuthError(`bizport /api/me returned ${resp.status}`);
    }
    return await resp.json();
  } catch (e) {
    if (e instanceof AuthError) throw e;
    if (e.name === "AbortError") {
      throw new AuthError("bizport /api/me timed out");
    }
    throw new AuthError(`bizport /api/me failed: ${e.message}`);
  } finally {
    clearTimeout(timer);
  }
}
