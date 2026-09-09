import requests

def test_authapi_postkayit_withoutsession_returnsauthfailure():
    url = "http://localhost:3000/api/auth/kayit"
    headers = {
        "Content-Type": "application/json"
    }
    # No authentication/session cookie is sent
    try:
        response = requests.post(url, headers=headers, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    # The server might respond with 400 VALIDATION_ERROR or 401 Unauthorized for no session
    assert response.status_code in (400, 401), f"Expected 400 or 401, got {response.status_code}"

    try:
        body = response.json()
    except Exception:
        assert False, "Response is not valid JSON"

    # Validate error shape
    assert "error" in body, "Response JSON missing 'error' key"
    error = body["error"]

    # Must contain keys code, message, traceId
    for key in ("code", "message", "traceId"):
        assert key in error, f"Error object missing '{key}'"

    # For 400 status, code must be VALIDATION_ERROR; for 401 it could be different (auth failure)
    if response.status_code == 400:
        assert error["code"] == "VALIDATION_ERROR", f"Error code expected VALIDATION_ERROR, got {error['code']}"
    else:
        # For 401 or others, error code should reflect auth failure or unauthorized
        # Accept any string code for auth failure but must not be empty
        assert isinstance(error["code"], str) and error["code"].strip() != "", f"Error code must be a non-empty string"

    # message must be Turkish and indicate auth gated failure (no leak)
    message = error["message"]
    assert isinstance(message, str) and len(message) > 0, "Error message must be a non-empty string"

    # Basic heuristic for Turkish message
    turkish_chars = "çğıöşüÇĞİÖŞÜ"
    if not any(c in message for c in turkish_chars):
        common_turkish_words = ["giriş", "yapmalısın", "hata", "yetki", "yetkisiz", "kullanıcı"]
        assert any(word in message.lower() for word in common_turkish_words), "Error message does not appear Turkish"

    # traceId: non-empty string (opaque)
    trace_id = error["traceId"]
    assert isinstance(trace_id, str) and trace_id.strip() != "", "traceId must be a non-empty string"

    # Ensure no stack trace, sql, file path in message or elsewhere
    forbidden_keywords = ["stack", "trace", "sql", "file", "exception", "hata ayıklama", "at "]
    combined_error_text = message.lower()
    for key in forbidden_keywords:
        assert key not in combined_error_text, f"Error message contains forbidden leak keyword: {key}"

test_authapi_postkayit_withoutsession_returnsauthfailure()
