"""talenthub-ai Lambda: bizport JWT 認証 → Bedrock streaming proxy.

Lambda Function URL (RESPONSE_STREAM) で公開し、CloudFront `/api/ai/*` 経由で受信する。

リクエスト:
    POST /api/ai/<path>
    Authorization: Bearer <Entra JWT>
    Content-Type: application/json
    Body: Bedrock InvokeModel に渡す JSON (modelId 以外)

レスポンス:
    Content-Type: text/event-stream
    Bedrock invoke_model_with_response_stream の結果を SSE で順次返却。
"""
import base64
import json
from logging import INFO, getLogger

import boto3

from app import settings
from app.libs.bizport_auth import AuthError, verify_jwt

log = getLogger(__name__)
log.setLevel(INFO)

bedrock = boto3.client("bedrock-runtime", region_name=settings.REGION)


def _extract_body(event: dict) -> dict:
    body_str = event.get("body") or "{}"
    if event.get("isBase64Encoded"):
        body_str = base64.b64decode(body_str).decode()
    return json.loads(body_str)


def _get_authorization(event: dict) -> str:
    headers = event.get("headers") or {}
    return headers.get("authorization") or headers.get("Authorization") or ""


def handler(event, context):
    """Lambda Function URL (RESPONSE_STREAM) ハンドラ.

    AWS Lambda Python ランタイムでの response streaming は yield 形式で逐次レスポンスを返す。
    最初の yield で HTTP ステータスとヘッダを書き、以降は本文を流す。
    """
    try:
        user = verify_jwt(_get_authorization(event))
    except AuthError as e:
        log.warning("auth failed: %s", e)
        yield "HTTP/1.1 401 Unauthorized\r\nContent-Type: application/json\r\n\r\n"
        yield json.dumps({"error": "unauthorized", "message": str(e)})
        return

    log.info("authenticated: user_id=%s", user.get("id") or user.get("userId"))

    try:
        body = _extract_body(event)
    except json.JSONDecodeError as e:
        log.warning("invalid request body: %s", e)
        yield "HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\n\r\n"
        yield json.dumps({"error": "invalid_request", "message": "body is not valid JSON"})
        return

    try:
        response = bedrock.invoke_model_with_response_stream(
            modelId=settings.BEDROCK_MODEL_ID,
            body=json.dumps(body),
            accept="application/json",
            contentType="application/json",
        )
    except Exception as e:  # noqa: BLE001 - Bedrock 呼び出しは外部要因なので幅広に拾う
        log.exception("bedrock invoke failed")
        yield "HTTP/1.1 502 Bad Gateway\r\nContent-Type: application/json\r\n\r\n"
        yield json.dumps({"error": "bedrock_error", "message": str(e)})
        return

    yield "HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nCache-Control: no-cache\r\n\r\n"
    for chunk_event in response["body"]:
        chunk = chunk_event.get("chunk", {}).get("bytes")
        if not chunk:
            continue
        yield f"data: {chunk.decode()}\n\n"
    yield "event: done\ndata: [DONE]\n\n"
