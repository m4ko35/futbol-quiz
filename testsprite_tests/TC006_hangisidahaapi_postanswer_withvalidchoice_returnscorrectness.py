import requests
import time

BASE_URL = "http://localhost:3000"
TIMEOUT = 30

def test_hangisidahaapi_postanswer_withvalidchoice_returnscorrectness():
    round_url = f"{BASE_URL}/api/hangisi-daha/round"
    answer_url = f"{BASE_URL}/api/hangisi-daha/answer"
    headers = {"Content-Type": "application/json"}

    # Step 1: Get a valid round to obtain roundId and choice options
    while True:
        response_round = requests.get(round_url, timeout=TIMEOUT)
        if response_round.status_code == 429:
            retry_after = response_round.headers.get("Retry-After", "1")
            try:
                wait_sec = int(retry_after)
            except Exception:
                wait_sec = 1
            time.sleep(wait_sec)
            continue
        break

    assert response_round.status_code == 200, f"Expected 200 but got {response_round.status_code}"
    json_round = response_round.json()
    # Validate shape of success response
    assert "data" in json_round and isinstance(json_round["data"], dict), "Missing or invalid 'data' in round response"

    round_data = json_round["data"].get("round")
    assert round_data is not None, "Missing 'round' key in response data"
    # Expected round contains two players and stat label but no values

    round_id = round_data.get("id") or round_data.get("roundId")
    assert round_id is not None, "Round id not found in round data"

    player1 = round_data.get("playerA") or round_data.get("player1")
    player2 = round_data.get("playerB") or round_data.get("player2")
    stat_label = round_data.get("statLabel") or round_data.get("stat") or round_data.get("label")

    # Must have two players and a stat label
    assert player1 and player2 and stat_label, "Round data must have two players and stat label"

    # Pick one of the players as the choice for the answer submission
    # The request body schema is roundId and choice describing the round choice
    # The exact schema is not explicitly given, assume { "roundId": <id>, "choice": <playerId> }
    # Determine player IDs if present, keys might vary
    player1_id = player1.get("id") if isinstance(player1, dict) else None
    player2_id = player2.get("id") if isinstance(player2, dict) else None

    if player1_id and player2_id:
        chosen_id = player1_id  # pick player1 as valid choice
    else:
        # fallback: if player1/player2 are strings or ids directly
        chosen_id = player1 if isinstance(player1, str) else None

    assert chosen_id is not None, "Cannot determine a valid player id for choice"

    payload = {"roundId": round_id, "choice": chosen_id}

    # Step 2: POST the answer with valid choice, handle rate limiting
    while True:
        response_answer = requests.post(answer_url, json=payload, headers=headers, timeout=TIMEOUT)
        if response_answer.status_code == 429:
            retry_after = response_answer.headers.get("Retry-After", "1")
            try:
                wait_sec = int(retry_after)
            except Exception:
                wait_sec = 1
            time.sleep(wait_sec)
            continue
        break

    assert response_answer.status_code == 200, f"Expected 200 but got {response_answer.status_code}"

    json_answer = response_answer.json()
    assert "data" in json_answer and isinstance(json_answer["data"], dict), "Missing or invalid 'data' in answer response"

    data = json_answer["data"]

    # Validate that response includes 'correct' boolean and revealed values of both players
    assert "correct" in data and isinstance(data["correct"], bool), "Response must include boolean 'correct' key"
    # The response should reveal both values, keys unknown but expect at least two values different from 'correct'
    # Check that at least one key besides 'correct' is present and of appropriate type (numbers)
    values_keys = [k for k in data.keys() if k != "correct"]
    assert values_keys, "Response 'data' must include other revealed values besides 'correct'"

    # Check numeric values exist and are numbers
    numeric_values_found = False
    for key in values_keys:
        val = data[key]
        if isinstance(val, (int, float)):
            numeric_values_found = True
            break
    assert numeric_values_found, "At least one of the revealed values should be numeric"

test_hangisidahaapi_postanswer_withvalidchoice_returnscorrectness()