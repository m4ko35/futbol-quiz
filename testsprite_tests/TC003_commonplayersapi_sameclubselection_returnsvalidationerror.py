import requests
import time

BASE_URL = "http://localhost:3000"
COMMON_PLAYERS_ENDPOINT = f"{BASE_URL}/api/common-players"
TIMEOUT = 30

def test_commonplayersapi_sameclubselection_returnsvalidationerror():
    session = requests.Session()
    headers = {
        "Accept": "application/json",
    }

    # Step 1: Discover a valid club ID by searching clubs with some query
    club_id = None
    search_q = "ars"  # a common substring to find clubs

    while True:
        try:
            res = session.get(
                f"{BASE_URL}/api/clubs",
                params={"q": search_q, "limit": 10},
                headers=headers,
                timeout=TIMEOUT,
            )
            if res.status_code == 429:
                retry_after = res.headers.get("Retry-After")
                sleep_sec = int(retry_after) if retry_after and retry_after.isdigit() else 1
                time.sleep(sleep_sec)
                continue
            res.raise_for_status()
            body = res.json()
            data = body.get("data", [])
            if data and isinstance(data, list):
                club_id = data[0].get("id") or data[0].get("slug") or data[0].get("wikidataId") or data[0].get("clubId") or data[0].get("name")
                # Prefer id, fallback to name as string if id not found (id field uncertain)
                if isinstance(club_id, str) and club_id.strip():
                    break
            # If no data found, try other query or fail
            # To avoid infinite loop
            break
        except requests.RequestException:
            break

    assert club_id is not None, "Could not find a valid club ID for test"

    # Step 2: Send GET /api/common-players with clubA and clubB set to the same club to trigger SAME_CLUB validation error
    params = {
        "clubA": club_id,
        "clubB": club_id,
    }

    while True:
        try:
            response = session.get(COMMON_PLAYERS_ENDPOINT, params=params, headers=headers, timeout=TIMEOUT)
            if response.status_code == 429:
                retry_after = response.headers.get("Retry-After")
                sleep_sec = int(retry_after) if retry_after and retry_after.isdigit() else 1
                time.sleep(sleep_sec)
                continue
            break
        except requests.RequestException as e:
            raise e

    # Validate response is 400 VALIDATION_ERROR with proper error body (code, message, traceId)
    assert response.status_code == 400, f"Expected HTTP 400 but got {response.status_code}"

    try:
        error_body = response.json()
    except Exception:
        assert False, "Response body is not valid JSON"

    assert "error" in error_body, "Error response must have 'error' field"
    error = error_body["error"]
    assert isinstance(error, dict), "'error' must be a JSON object"
    assert "code" in error and isinstance(error["code"], str), "'error.code' must be present and a string"
    assert error["code"] == "VALIDATION_ERROR", f"Expected error code VALIDATION_ERROR but got {error['code']}"
    assert "message" in error and isinstance(error["message"], str) and len(error["message"].strip()) > 0, "'error.message' must be a non-empty string"
    assert "traceId" in error and isinstance(error["traceId"], str) and len(error["traceId"].strip()) > 0, "'error.traceId' must be a non-empty string"

    # Assert no stack trace, SQL code, or file paths leakage by checking message content
    forbidden_terms = ["stack trace", "at ", "sql", "error:", "exception", "file", ".js", ".ts", "line "]
    lower_msg = error["message"].lower()
    for term in forbidden_terms:
        assert term not in lower_msg, f"Error message must not contain internal implementation detail: found '{term}'"

test_commonplayersapi_sameclubselection_returnsvalidationerror()