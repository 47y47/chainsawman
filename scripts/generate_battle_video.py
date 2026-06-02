"""Generate Pochita battle-mode video via Gemini Veo 3.1."""
import base64
import json
import os
import sys
import time
import urllib.request

API_KEY = os.environ.get("GEMINI_API_KEY", "")
if not API_KEY:
    print("Error: GEMINI_API_KEY not set")
    sys.exit(1)

# Use veo-3.1-fast for good speed/quality balance
MODEL = "veo-3.1-fast-generate-preview"
BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"

REF_IMAGE = "c:/Users/12858/Desktop/pochita_firstframe.png"
OUTPUT = "c:/Users/12858/Desktop/pochita_battle.mp4"

PROMPT = """A cute chibi orange Pochita from Chainsaw Man, side view, ENTERING BATTLE MODE. The chainsaw blade on his forehead starts spinning and glowing with orange energy. His stance changes from cute walking to aggressive battle-ready pose - body lowers slightly, blade points forward ready to strike. The chainsaw blade vibrates and small sparks fly from it. Pure green background (#00FF00). Fixed camera. 4 seconds. The character stays in the center. Q-version chibi cartoon style, clean outlines.

IMPORTANT: Pochita stands on TWO LEGS (bipedal), NOT four legs. He is a cartoon mascot character."""

def main():
    # Read reference image
    with open(REF_IMAGE, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode("utf-8")

    # Build request
    body = {
        "instances": [{
            "prompt": PROMPT,
            "image": {
                "bytesBase64Encoded": img_b64,
                "mimeType": "image/png"
            }
        }],
        "parameters": {
            "aspectRatio": "16:9",
            "durationSeconds": 4
        }
    }

    url = f"{BASE_URL}/{MODEL}:predictLongRunning"
    headers = {
        "x-goog-api-key": API_KEY,
        "Content-Type": "application/json"
    }

    print(f"Starting video generation with {MODEL}...")
    print(f"Reference image: {REF_IMAGE}")
    print(f"Duration: 3s")

    req = urllib.request.Request(url, data=json.dumps(body).encode("utf-8"), headers=headers, method="POST")

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            result = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        error = e.read().decode("utf-8", errors="replace")
        print(f"HTTP {e.code}: {error[:1000]}")
        sys.exit(1)

    operation_name = result.get("name")
    if not operation_name:
        print(f"No operation name. Response: {json.dumps(result, indent=2)[:500]}")
        sys.exit(1)

    print(f"Job started: {operation_name}")
    print("Polling for completion...")

    # Poll
    poll_url = f"{BASE_URL}/{operation_name}"
    max_attempts = 60  # ~10 min max
    for i in range(max_attempts):
        time.sleep(10)
        poll_req = urllib.request.Request(poll_url, headers={"x-goog-api-key": API_KEY})
        with urllib.request.urlopen(poll_req) as resp:
            poll_result = json.loads(resp.read().decode("utf-8"))

        done = poll_result.get("done", False)
        if done:
            print("Generation complete!")
            # Extract video URI
            resp_data = poll_result.get("response", {})
            gen_video = resp_data.get("generateVideoResponse", {})
            samples = gen_video.get("generatedSamples", [])
            if samples:
                video_uri = samples[0].get("video", {}).get("uri", "")
                if video_uri:
                    print(f"Downloading from: {video_uri[:80]}...")
                    dl_req = urllib.request.Request(video_uri, headers={"x-goog-api-key": API_KEY})
                    with urllib.request.urlopen(dl_req) as dl_resp:
                        with open(OUTPUT, "wb") as out:
                            out.write(dl_resp.read())
                    print(f"Saved: {OUTPUT}")
                    return
                else:
                    print(f"Response: {json.dumps(poll_result, indent=2)[:2000]}")
            sys.exit(1)

        error_info = poll_result.get("error", {})
        if error_info:
            print(f"Error: {error_info.get('message', str(error_info))}")
            sys.exit(1)

        print(f"  Poll {i+1}/{max_attempts}...")

    print("Timed out waiting for generation")
    sys.exit(1)

if __name__ == "__main__":
    main()
