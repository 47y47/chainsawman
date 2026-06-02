"""Generate battle-mode Pochita image."""
import base64, json, os, sys, urllib.request

API_KEY = os.environ.get("GEMINI_API_KEY", "")
if not API_KEY:
    print("Error: GEMINI_API_KEY not set")
    sys.exit(1)

MODEL = "gemini-3-pro-image-preview"
URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:streamGenerateContent?key={API_KEY}"

REF = "d:/chainsawman/assets/images/pochita_jump.png"  # reference for style

PROMPT = """A cute chibi orange Pochita from Chainsaw Man, side view facing right, BATTLE MODE.

Character (same style as reference): Small round orange dog-like creature standing on TWO LEGS (bipedal cartoon mascot). Chainsaw blade on forehead, pull-cord handle on back of head, short stubby arms and legs, small pointed tail.

Battle mode changes:
- The chainsaw blade on his forehead is extended longer and GLOWING with orange/yellow energy
- Small sparks flying from the chainsaw blade
- His stance is more aggressive - body lowered slightly, leaning forward ready to strike
- His round eyes have an angry/determined expression (angled eyebrows)
- The chainsaw blade has motion lines around it to show it's spinning

Style: Q-version chibi, flat colors, clean outlines, side view facing right, full body. White background. Same art style and proportions as the reference image."""

def main():
    with open(REF, "rb") as f:
        ref_b64 = base64.b64encode(f.read()).decode("utf-8")

    body = {
        "contents": [{
            "role": "user",
            "parts": [
                {"inlineData": {"mimeType": "image/png", "data": ref_b64}},
                {"text": PROMPT}
            ]
        }],
        "generationConfig": {
            "responseModalities": ["IMAGE", "TEXT"],
            "imageConfig": {"image_size": "1K"}
        }
    }

    print(f"Generating battle-mode Pochita...")
    req = urllib.request.Request(URL, data=json.dumps(body).encode("utf-8"),
                                  headers={"Content-Type": "application/json"}, method="POST")

    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                response = json.loads(resp.read().decode("utf-8"))
            break
        except Exception as e:
            if attempt == 2: raise
            print(f"  Retry {attempt+1}...")
            import time; time.sleep(3)

    candidates = response[0].get("candidates", []) if isinstance(response, list) else response.get("candidates", [])
    for part in candidates[0].get("content", {}).get("parts", []):
        if "inlineData" in part:
            out = "d:/chainsawman/assets/images/pochita_battle.png"
            with open(out, "wb") as f:
                f.write(base64.b64decode(part["inlineData"]["data"]))
            print(f"Saved: {out}")
            return
        if "text" in part:
            print(f"Text: {part['text'][:200]}")
    print("No image in response")

if __name__ == "__main__":
    main()
