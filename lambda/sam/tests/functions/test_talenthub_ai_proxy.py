"""talenthub_ai_proxy ハンドラの最小テスト."""
import json
from unittest.mock import patch

import pytest

from app.functions import talenthub_ai_proxy
from app.libs.bizport_auth import AuthError


def _drain(gen):
    """generator handler を文字列リストに変換."""
    return list(gen)


def test_handler_returns_401_when_auth_fails():
    event = {"headers": {"Authorization": "Bearer invalid"}, "body": "{}"}
    with patch.object(talenthub_ai_proxy, "verify_jwt", side_effect=AuthError("bad token")):
        chunks = _drain(talenthub_ai_proxy.handler(event, None))
    assert "401 Unauthorized" in chunks[0]
    assert json.loads(chunks[1])["error"] == "unauthorized"


def test_handler_returns_400_when_body_is_not_json():
    event = {"headers": {"Authorization": "Bearer ok"}, "body": "not-json"}
    with patch.object(talenthub_ai_proxy, "verify_jwt", return_value={"id": "u1"}):
        chunks = _drain(talenthub_ai_proxy.handler(event, None))
    assert "400 Bad Request" in chunks[0]
    assert json.loads(chunks[1])["error"] == "invalid_request"


def test_handler_streams_bedrock_response():
    event = {
        "headers": {"Authorization": "Bearer ok"},
        "body": json.dumps({"messages": [{"role": "user", "content": "hi"}]}),
    }

    fake_stream = iter(
        [
            {"chunk": {"bytes": b'{"delta":"Hel"}'}},
            {"chunk": {"bytes": b'{"delta":"lo"}'}},
        ]
    )

    with patch.object(talenthub_ai_proxy, "verify_jwt", return_value={"id": "u1"}), patch.object(
        talenthub_ai_proxy.bedrock,
        "invoke_model_with_response_stream",
        return_value={"body": fake_stream},
    ):
        chunks = _drain(talenthub_ai_proxy.handler(event, None))

    assert chunks[0].startswith("HTTP/1.1 200 OK")
    assert any('data: {"delta":"Hel"}' in c for c in chunks)
    assert any('data: {"delta":"lo"}' in c for c in chunks)
    assert chunks[-1] == "event: done\ndata: [DONE]\n\n"
