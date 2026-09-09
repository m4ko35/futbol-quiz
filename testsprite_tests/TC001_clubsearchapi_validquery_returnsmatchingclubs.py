import requests
import time

BASE_URL = "http://localhost:3000"
TIMEOUT = 30

def test_clubsearchapi_validquery_returnsmatchingclubs():
    session = requests.Session()
    endpoint = f"{BASE_URL}/api/clubs"
    headers = {
        "Accept": "application/json"
    }

    # We will try queries with 'ars' which is a typical partial club name ("Arsenal" likely)
    # We test with and without optional params limit and league.

    # Define some param sets to test:
    query_params_list = [
        {"q": "ars"},  # minimal valid
        {"q": "ars", "limit": 10},  # with limit
        {"q": "ars", "limit": 5, "league": "Q9458"}  # with league wikidata QID
    ]

    for params in query_params_list:
        resp = session.get(endpoint, params=params, headers=headers, timeout=TIMEOUT)
        # Handle rate limiting by retrying after delay if 429:
        retry_count = 0
        while resp.status_code == 429 and retry_count < 3:
            retry_after = resp.headers.get("Retry-After")
            wait_sec = int(retry_after) if retry_after and retry_after.isdigit() else 1
            time.sleep(wait_sec)
            resp = session.get(endpoint, params=params, headers=headers, timeout=TIMEOUT)
            retry_count += 1

        assert resp.status_code == 200, f"Expected 200 OK, got {resp.status_code} for params {params}"

        json_body = resp.json()
        # Validate the success contract: { "data": [...] }
        assert isinstance(json_body, dict), "Response body is not a JSON object"
        assert "data" in json_body, "'data' key missing in response"
        data = json_body["data"]
        # data should be a list (Club[])
        assert isinstance(data, list), "'data' should be a list"
        # If data is non-empty, check that each item is a club object (dict) with some expected keys
        if data:
            for club in data:
                assert isinstance(club, dict), "Each club item should be an object"
                # Expected minimal keys for a club (assumed): id (str), name (str)
                assert "id" in club and isinstance(club["id"], str) and club["id"], "Club must have a non-empty 'id'"
                assert "name" in club and isinstance(club["name"], str) and club["name"], "Club must have a non-empty 'name'"
    
    # No error path expected, no cleanup needed

test_clubsearchapi_validquery_returnsmatchingclubs()