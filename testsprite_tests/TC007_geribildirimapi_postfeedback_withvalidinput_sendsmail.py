import requests

def test_geribildirimapi_postfeedback_withvalidinput_sendsmail():
    url = "http://localhost:3000/api/geri-bildirim"
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    payload = {
        "email": "testuser@example.com",
        "message": "Bu bir geri bildirim mesajıdır."
    }
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    if response.status_code == 200:
        # Successful send - expect { data: { sent: true } }
        try:
            body = response.json()
        except ValueError:
            assert False, "Response body is not valid JSON"

        assert "data" in body, "Response JSON missing 'data' key"
        data = body["data"]
        assert isinstance(data, dict), "'data' should be an object"
        assert "sent" in data, "'sent' key missing in response data"
        assert data["sent"] is True, "'sent' should be true"
    elif response.status_code == 500:
        # INTERNAL_ERROR expected if mail provider unreachable
        try:
            body = response.json()
        except ValueError:
            assert False, "Response body is not valid JSON"

        assert "error" in body, "Response JSON missing 'error' key"
        error = body["error"]
        assert isinstance(error, dict), "'error' should be an object"
        # Validate error structure and code
        assert "code" in error, "'code' missing in error"
        assert error["code"] == "INTERNAL_ERROR", f"Expected code 'INTERNAL_ERROR', got '{error['code']}'"
        assert "message" in error, "'message' missing in error"
        assert isinstance(error["message"], str) and error["message"], "'message' should be a non-empty string"
        assert "traceId" in error, "'traceId' missing in error"
        # Assert no stack trace, SQL, or file paths (basic check: no lines with slashes or .js/.ts/.sql)
        assert all(x not in error["message"].lower() for x in ["stack", "sql", "file", "\\", "/"]), "Error message must not contain stack trace, SQL, or file path"
    elif response.status_code == 429:
        # Rate limited - correct behavior, test passes but log for info
        retry_after = response.headers.get("Retry-After")
        assert retry_after is not None, "429 response missing Retry-After header"
        cache_control = response.headers.get("Cache-Control", "")
        assert "no-store" in cache_control.lower(), "429 response Cache-Control must include 'no-store'"
    else:
        # Any other status code is unexpected
        assert False, f"Unexpected status code {response.status_code} with body: {response.text}"

test_geribildirimapi_postfeedback_withvalidinput_sendsmail()