import os

# AWS
REGION = os.getenv("Region")
STAGE = os.getenv("Stage")

# bizport API（`/api/me` 認証用）
BIZPORT_API_BASE_URL = os.getenv("BizportApiBaseUrl")

# Bedrock
BEDROCK_MODEL_ID = os.getenv("BedrockModelId")

# `/api/me` 呼び出しタイムアウト (sec)
BIZPORT_API_TIMEOUT = int(os.getenv("BizportApiTimeout", "10"))
