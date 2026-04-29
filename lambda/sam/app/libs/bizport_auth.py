"""bizport `/api/me` を叩いて Entra JWT を検証するモジュール."""
import json
import urllib.error
import urllib.request
from logging import INFO, getLogger

from app import settings

log = getLogger(__name__)
log.setLevel(INFO)


class AuthError(Exception):
    """認証失敗 (401)."""


def verify_jwt(authorization_header: str) -> dict:
    """`Authorization` ヘッダを bizport `/api/me` に転送してユーザー情報を取得する.

    Returns:
        dict: bizport `/api/me` のレスポンス JSON.
    Raises:
        AuthError: ヘッダ欠落 / `/api/me` が 200 以外を返した場合.
    """
    if not authorization_header:
        raise AuthError("Authorization header missing")

    url = f"{settings.BIZPORT_API_BASE_URL.rstrip('/')}/api/me"
    req = urllib.request.Request(
        url=url,
        headers={"Authorization": authorization_header},
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=settings.BIZPORT_API_TIMEOUT) as resp:
            if resp.status != 200:
                raise AuthError(f"bizport /api/me returned {resp.status}")
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        raise AuthError(f"bizport /api/me HTTPError: {e.code}") from e
    except urllib.error.URLError as e:
        raise AuthError(f"bizport /api/me URLError: {e.reason}") from e
