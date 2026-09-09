import requests
import time

BASE_URL = "http://localhost:3000"
TIMEOUT = 30
HEADERS = {"Content-Type": "application/json"}


def test_gridapi_postanswer_validpayload_returnscorrectness():
    session = requests.Session()
    # Step 1: Find a valid playerId using GET /api/players?q=
    player_id = None
    for attempt in range(5):
        try:
            resp_players = session.get(
                f"{BASE_URL}/api/players",
                params={"q": "messi", "limit": 1},
                timeout=TIMEOUT,
            )
            if resp_players.status_code == 429:
                retry_after = int(resp_players.headers.get("Retry-After", "1"))
                time.sleep(retry_after + 0.5)
                continue
            resp_players.raise_for_status()
            result = resp_players.json()
            players = result.get("data", [])
            if players:
                player_id = players[0].get("id") or players[0].get("playerId") or None
            break
        except (requests.RequestException, ValueError):
            time.sleep(1)
    if not player_id:
        raise AssertionError("Could not find valid playerId for testing")

    # Step 2: Prepare to post an answer with valid row and col
    # Use row=1 and col=1 (valid indexes in 3x3 grid from 0 to 2)
    payload = {"row": 1, "col": 1, "playerId": player_id}

    # Attempt to POST /api/grid/answer; on rate limit 429 back off
    for attempt in range(5):
        try:
            resp = session.post(
                f"{BASE_URL}/api/grid/answer",
                json=payload,
                headers=HEADERS,
                timeout=TIMEOUT,
            )
            if resp.status_code == 429:
                retry_after = int(resp.headers.get("Retry-After", "1"))
                time.sleep(retry_after + 0.5)
                continue

            # Validate response success case
            if resp.status_code == 200:
                body = resp.json()
                assert "data" in body, "Response JSON missing 'data' key"
                data = body["data"]
                assert isinstance(data, dict), "'data' must be a dictionary"
                assert "correct" in data, "'correct' key missing in data"
                assert isinstance(data["correct"], bool), "'correct' must be boolean"
                # No stack trace or sensitive info validation
                assert all(
                    k not in resp.text.lower()
                    for k in ["stack", "trace", "sql", "file", "error.stack"]
                )
                return

            # Validate error shape if not 200
            if resp.status_code in {400, 404, 429, 500}:
                body = resp.json()
                assert "error" in body, "Error response missing 'error' key"
                error = body["error"]
                assert "code" in error, "'code' missing in error object"
                assert error["code"] in {
                    "VALIDATION_ERROR",
                    "NOT_FOUND",
                    "RATE_LIMITED",
                    "INTERNAL_ERROR",
                }
                assert isinstance(error.get("message"), str), "'message' must be string"
                assert isinstance(error.get("traceId"), str), "'traceId' must be string"
                # error body must not contain stack trace, SQL, or file info
                lower_text = str(error.get("message", "")).lower()
                assert all(
                    forbidden not in lower_text for forbidden in ["stack", "trace", "sql", "file"]
                )
                return

            resp.raise_for_status()
        except (requests.RequestException, ValueError) as e:
            # Last attempt raise
            if attempt == 4:
                raise e
            time.sleep(1)


test_gridapi_postanswer_validpayload_returnscorrectness()