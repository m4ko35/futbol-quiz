import requests
import time

BASE_URL = "http://localhost:3000"
TIMEOUT = 30
HEADERS = {"Content-Type": "application/json"}


def test_statmatchapi_postanswer_withvalidstatkey_returnsscore():
    session = requests.Session()

    # Step 1: Discover a valid statKey and playerId by fetching /api/stat-match
    stat_key = None
    player_id = None

    # Get daily stat round info
    for attempt in range(5):
        try:
            resp = session.get(f"{BASE_URL}/api/stat-match", timeout=TIMEOUT)
            if resp.status_code == 429:  # Rate limited
                retry_after = int(resp.headers.get("Retry-After", "1"))
                time.sleep(retry_after)
                continue
            resp.raise_for_status()
            json_body = resp.json()
            if ("data" not in json_body or 
                not isinstance(json_body["data"], dict) or 
                "round" not in json_body["data"]):
                # Missing expected field, retry
                time.sleep(1)
                continue
            round_data = json_body["data"]["round"]

            # Use fallback stat_key as per PRD example
            stat_key = "goals"
            break
        except (requests.RequestException, ValueError, AssertionError):
            if attempt == 4:
                raise
            time.sleep(1)

    assert stat_key is not None, "Unable to determine statKey"

    # Step 2: Discover a valid playerId by searching players
    player_id = None
    q = "leo"  # generic search short term to get players
    for attempt in range(5):
        try:
            resp = session.get(f"{BASE_URL}/api/players", params={"q": q, "limit": 5}, timeout=TIMEOUT)
            if resp.status_code == 429:  # Rate limited
                retry_after = int(resp.headers.get("Retry-After", "1"))
                time.sleep(retry_after)
                continue
            if resp.status_code == 400:
                # Possibly invalid q param, try alternative q
                q = "messi"
                time.sleep(1)
                continue
            resp.raise_for_status()
            json_body = resp.json()
            # Validate response shape: { data: PlayerSuggestion[] }
            assert "data" in json_body and isinstance(json_body["data"], list) and len(json_body["data"]) > 0, "No players found in response data"
            first_player = json_body["data"][0]
            assert "id" in first_player and isinstance(first_player["id"], str) and first_player["id"], "Invalid player id"
            player_id = first_player["id"]
            break
        except (requests.RequestException, ValueError, AssertionError):
            if attempt == 4:
                raise
            time.sleep(1)

    assert player_id is not None, "Unable to obtain a valid playerId"

    # Step 3: POST /api/stat-match/answer with valid statKey and playerId, retry on 429
    url = f"{BASE_URL}/api/stat-match/answer"
    payload = {"statKey": stat_key, "playerId": player_id}

    for attempt in range(5):
        try:
            resp = session.post(url, json=payload, headers=HEADERS, timeout=TIMEOUT)
            if resp.status_code == 429:
                retry_after = int(resp.headers.get("Retry-After", "1"))
                time.sleep(retry_after)
                continue
            # Success responses or other errors:
            if resp.status_code == 200:
                # Expect body shape: { data: { score, trueValue, ... } }
                json_body = resp.json()
                assert "data" in json_body, "Response missing data field"
                data = json_body["data"]
                assert "score" in data, "Response data missing score"
                assert isinstance(data["score"], (int, float)), "score is not numeric"
                assert "trueValue" in data, "Response data missing trueValue"
                # trueValue can be any type logically; just assert presence
                return  # Test passed
            else:
                # Any 400 or 500 is failure for this test
                json_body = resp.json()
                assert "error" in json_body, "Error response missing error field"
                error = json_body["error"]
                assert "code" in error and "message" in error and "traceId" in error, "Error response missing code/message/traceId"
                # Messages must be Turkish (no English). Do a simple heuristic that message is str and non-empty
                assert isinstance(error["message"], str) and error["message"], "Error message empty or not a string"
                # This test expects success, so fail here
                assert False, f"Unexpected error response: {error}"
        except requests.RequestException as e:
            if attempt == 4:
                raise
            time.sleep(1)
        except ValueError as e:
            # JSON decode error or assertion failure
            raise

    assert False, "Failed to get a successful response for POST /api/stat-match/answer"


test_statmatchapi_postanswer_withvalidstatkey_returnsscore()
