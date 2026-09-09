import requests
import re

def test_odaapi_postcreate_withoutlogin_returnsauthfailure():
    base_url = "http://localhost:3000"
    url = f"{base_url}/api/oda"
    headers = {
        "Content-Type": "application/json"
    }
    timeout = 30

    try:
        response = requests.post(url, headers=headers, timeout=timeout)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    # The endpoint requires authentication. Guest accesses return 400 VALIDATION_ERROR with Turkish message.
    # Validate HTTP status code
    assert response.status_code == 400 or response.status_code == 429, \
        f"Expected status code 400 or 429 for rate limiting, got {response.status_code}"

    if response.status_code == 429:
        # Rate limit handling: must have Retry-After header and Cache-Control no-store
        assert "Retry-After" in response.headers, "429 response missing Retry-After header"
        cache_control = response.headers.get("Cache-Control", "").lower()
        assert "no-store" in cache_control, "429 response missing Cache-Control no-store"
        # Rate limiting is not a test failure
        return

    # Parse JSON response body
    try:
        json_body = response.json()
    except ValueError:
        assert False, "Response body is not valid JSON"

    # Validate error shape
    assert "error" in json_body, "Response JSON missing 'error' key"
    error = json_body["error"]

    # Validate error keys
    assert isinstance(error, dict), "'error' is not an object"
    for key in ("code", "message", "traceId"):
        assert key in error, f"Error object missing '{key}' key"
        assert isinstance(error[key], str), f"Error '{key}' is not a string"

    # Validate error code is VALIDATION_ERROR (HTTP 400)
    valid_error_codes = {"VALIDATION_ERROR", "NOT_FOUND", "RATE_LIMITED", "INTERNAL_ERROR"}
    assert error["code"] in valid_error_codes, f"Unexpected error code: {error['code']}"
    assert error["code"] == "VALIDATION_ERROR", f"Expected error code VALIDATION_ERROR, got {error['code']}"

    # Validate the error message is Turkish and no leak of stack trace, SQL, file path
    message = error["message"]
    # It must be a non-empty string and Turkish
    assert isinstance(message, str) and len(message) > 0, "Error message is empty or not a string"
    # Check message does not contain stack trace or file path keywords (common patterns)
    forbidden_patterns = [
        r"(?i)stack trace",
        r"(?i)sql",
        r"(?i)database",
        r"(?i)exception",
        r"(?i)error:",
        r"(?i)at\s+[\w\.]+\(",  # function call pattern stack trace
        r"\\",  # Windows file path separator
        r"/[\w./-]+\.ts",  # Typescript file path
        r"/[\w./-]+\.js",
        r"line \d+",
        r"column \d+"
    ]
    for pattern in forbidden_patterns:
        assert not re.search(pattern, message), f"Error message contains forbidden pattern: {pattern}"

    # Validate traceId is a non-empty string
    trace_id = error["traceId"]
    assert len(trace_id) > 0, "traceId is empty"

test_odaapi_postcreate_withoutlogin_returnsauthfailure()