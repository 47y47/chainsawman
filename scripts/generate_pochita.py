"""Generate Pochita desktop pet image with reference."""
import base64
import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path

API_KEY = os.environ.get("GEMINI_API_KEY", "")
MODEL_ID = "gemini-3-pro-image-preview"
API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL_ID}:streamGenerateContent?key={API_KEY}"

REF_IMAGE = Path("d:/chainsawman/400.webp")
OUTPUT = Path("d:/chainsawman/assets/images/pochita.png")

PROMPT = """Generate a cute chibi/Q-version Pochita (波奇塔) from Chainsaw Man for use as a desktop pet.

Key characteristics (reference image provided):
- Small orange dog-like creature, round and chubby body
- Chainsaw blade protruding from the center of the forehead, pointing upward
- Handle/pull-cord on the back of the head (like a chainsaw starter)
- Short stubby limbs (small arms and legs)
- Round black eyes, simple cute expression
- Small pointed tail

Style requirements:
- Full body, front-facing view
- Clean white background
- Q-version / chibi / cute style, simplified design
- Flat colors, clean outlines
- Like a simple cartoon mascot suitable for animation
- The character should be centered and occupy about 70-80% of the frame

IMPORTANT: Keep the style and proportions consistent with the reference image. Make it clean and simple."""

def main():
    if not API_KEY:
        print("Error: GEMINI_API_KEY not set")
        sys.exit(1)

    # Read and encode reference image
    ref_bytes = REF_IMAGE.read_bytes()
    ref_b64 = base64.b64encode(ref_bytes).decode("utf-8")

    request_body = {
        "contents": [{
            "role": "user",
            "parts": [
                {
                    "inlineData": {
                        "mimeType": "image/webp",
                        "data": ref_b64
                    }
                },
                {"text": PROMPT}
            ]
        }],
        "generationConfig": {
            "responseModalities": ["IMAGE", "TEXT"],
            "imageConfig": {"image_size": "1K"}
        }
    }

    print(f"Sending request with reference image ({REF_IMAGE.stat().st_size} bytes)...")
    print(f"Model: {MODEL_ID}")

    req = urllib.request.Request(
        API_URL,
        data=json.dumps(request_body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            response = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}: {e.read().decode('utf-8', errors='replace')}")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

    # Extract image
    candidates = response[0].get("candidates", []) if isinstance(response, list) else response.get("candidates", [])
    if not candidates:
        print("No candidates in response")
        print(json.dumps(response, indent=2)[:2000])
        sys.exit(1)

    parts = candidates[0].get("content", {}).get("parts", [])
    for part in parts:
        if "inlineData" in part:
            image_data = part["inlineData"].get("data", "")
            if image_data:
                OUTPUT.parent.mkdir(parents=True, exist_ok=True)
                OUTPUT.write_bytes(base64.b64decode(image_data))
                print(f"Saved: {OUTPUT} ({OUTPUT.stat().st_size} bytes)")
                return

    # Maybe got text response instead
    for part in parts:
        if "text" in part:
            print(f"Text response: {part['text'][:500]}")
    print("No image data found")
    sys.exit(1)

if __name__ == "__main__":
    main()
