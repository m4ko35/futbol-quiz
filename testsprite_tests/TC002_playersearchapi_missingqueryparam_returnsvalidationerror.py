import requests
import time

BASE_URL = "http://localhost:3000"
HEADERS = {"Accept": "application/json"}
TIMEOUT = 30

def test_playersearchapi_missingqueryparam_returnsvalidationerror():
    url = f"{BASE_URL}/api/players"
    params = {}  # Missing required 'q' parameter

    while True:
        response = requests.get(url, headers=HEADERS, params=params, timeout=TIMEOUT)
        if response.status_code == 429:
            # Rate limited - respect Retry-After header
            retry_after = response.headers.get("Retry-After")
            wait_time = int(retry_after) if retry_after and retry_after.isdigit() else 1
            time.sleep(wait_time)
            continue
        break

    assert response.status_code == 400, f"Expected 400 VALIDATION_ERROR but got {response.status_code}"

    try:
        body = response.json()
    except ValueError:
        assert False, "Response body is not valid JSON"

    assert "error" in body, "Response JSON must have 'error' key"
    error = body["error"]

    # Validate error keys
    assert set(error.keys()) == {"code", "message", "traceId"}, "Error object must have only code, message, and traceId"

    # Validate error code and values
    assert error["code"] == "VALIDATION_ERROR", f"Expected error code 'VALIDATION_ERROR' but got '{error['code']}'"
    assert isinstance(error["message"], str) and len(error["message"]) > 0, "Error message must be a non-empty string"
    assert isinstance(error["traceId"], str) and len(error["traceId"]) > 0, "traceId must be a non-empty string"

    # Confirm no stack trace, SQL, or file paths leaked in message
    forbidden_substrings = ["stack", "error", "trace", "sql", "exception", "\\", "/", " at ", "file"]
    lower_message = error["message"].lower()
    assert not any(fs in lower_message for fs in forbidden_substrings), "Error message leaks internal details"

    # Assert the message is Turkish (basic heuristic: presence of typical Turkish characters or words)
    turkish_indicators = ["geçerli", "hata", "parametre", "zorunlu", "eksik", "hatalı", "doğru"]
    assert any(word in lower_message for word in turkish_indicators), "Error message does not appear to be Turkish"

test_playersearchapi_missingqueryparam_returnsvalidationerror()