"""Generate all Pochita sprites: 4 walk frames + 1 jump frame.
Each frame uses the previous as reference for style consistency."""
import base64
import json
import os
import sys
import urllib.request
from pathlib import Path

API_KEY = os.environ.get("GEMINI_API_KEY", "")
MODEL_ID = "gemini-3-pro-image-preview"
API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL_ID}:streamGenerateContent?key={API_KEY}"

REF_PATH = Path("d:/chainsawman/400.webp")
OUT_DIR = Path("d:/chainsawman/assets/images")

BASE_PROMPT = """A cute chibi/Q-version Pochita (波奇塔) from Chainsaw Man, side view facing RIGHT.

Character details:
- Small orange dog-like creature, round chubby body
- Chainsaw blade protruding from center of forehead pointing forward/up
- Pull-cord handle on the back of the head (chainsaw starter)
- Short stubby legs and arms
- Round black eyes, cute simple face
- Small pointed tail
- Clean white background
- Q-version chibi kawaii style, flat colors, simple clean outlines
- Full body visible, centered, occupying ~70% of frame height"""

WALK_PROMPTS = [
    BASE_PROMPT + "\n\nPose: Standing/walking pose 1 of 4 — right legs forward, body slightly tilted forward, beginning of a walking step. Side view, facing right.",
    BASE_PROMPT + "\n\nPose: Walking pose 2 of 4 — mid-step, right front leg extended forward, left back leg pushing off. Side view, facing right. Consistent style with the reference image.",
    BASE_PROMPT + "\n\nPose: Walking pose 3 of 4 — legs passing each other, body at neutral position mid-stride. Side view, facing right. Consistent style with the reference image.",
    BASE_PROMPT + "\n\nPose: Walking pose 4 of 4 — left front leg reaching forward, right back leg trailing, completing the step cycle. Side view, facing right. Consistent style with the reference image.",
]

JUMP_PROMPT = BASE_PROMPT + "\n\nPose: Jumping up excitedly — all four paws off the ground, body lifted upward, ears/features slightly raised, happy expression. Side view, facing right. Consistent style with the reference image."

def call_api(ref_path, prompt):
    """Call Gemini API with optional reference image."""
    ref_bytes = ref_path.read_bytes()
    mime = "image/webp" if ref_path.suffix == ".webp" else "image/png"
    ref_b64 = base64.b64encode(ref_bytes).decode("utf-8")

    parts = [
        {"inlineData": {"mimeType": mime, "data": ref_b64}},
        {"text": prompt}
    ]

    body = {
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": {
            "responseModalities": ["IMAGE", "TEXT"],
            "imageConfig": {"image_size": "1K"}
        }
    }

    req = urllib.request.Request(
        API_URL,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )

    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=180) as resp:
                response = json.loads(resp.read().decode("utf-8"))
            break
        except Exception as e:
            if attempt == 2:
                raise
            print(f"  Retry {attempt+1} after error: {e}")
            import time; time.sleep(5)

    candidates = response[0].get("candidates", []) if isinstance(response, list) else response.get("candidates", [])
    if not candidates:
        print("  No candidates, response:", json.dumps(response, indent=2)[:500])
        return None

    parts = candidates[0].get("content", {}).get("parts", [])
    for part in parts:
        if "inlineData" in part:
            return base64.b64decode(part["inlineData"]["data"])
        if "text" in part:
            print(f"  [text] {part['text'][:200]}")

    print("  No image data in response")
    return None

def main():
    if not API_KEY:
        print("Error: GEMINI_API_KEY not set")
        sys.exit(1)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # --- Walk frame 1 (reference: original 400.webp) ---
    print("Generating walk frame 1/4...")
    img = call_api(REF_PATH, WALK_PROMPTS[0])
    if not img:
        print("FAILED")
        sys.exit(1)
    f1 = OUT_DIR / "pochita_w1.png"
    f1.write_bytes(img)
    print(f"  Saved {f1.name} ({len(img)} bytes)")

    # --- Walk frame 2 (reference: frame 1) ---
    print("Generating walk frame 2/4...")
    img = call_api(f1, WALK_PROMPTS[1])
    if not img:
        print("FAILED")
        sys.exit(1)
    f2 = OUT_DIR / "pochita_w2.png"
    f2.write_bytes(img)
    print(f"  Saved {f2.name} ({len(img)} bytes)")

    # --- Walk frame 3 (reference: frame 2) ---
    print("Generating walk frame 3/4...")
    img = call_api(f2, WALK_PROMPTS[2])
    if not img:
        print("FAILED")
        sys.exit(1)
    f3 = OUT_DIR / "pochita_w3.png"
    f3.write_bytes(img)
    print(f"  Saved {f3.name} ({len(img)} bytes)")

    # --- Walk frame 4 (reference: frame 3) ---
    print("Generating walk frame 4/4...")
    img = call_api(f3, WALK_PROMPTS[3])
    if not img:
        print("FAILED")
        sys.exit(1)
    f4 = OUT_DIR / "pochita_w4.png"
    f4.write_bytes(img)
    print(f"  Saved {f4.name} ({len(img)} bytes)")

    # --- Jump frame (reference: frame 1) ---
    print("Generating jump frame...")
    img = call_api(f1, JUMP_PROMPT)
    if not img:
        print("FAILED")
        sys.exit(1)
    fj = OUT_DIR / "pochita_jump.png"
    fj.write_bytes(img)
    print(f"  Saved {fj.name} ({len(img)} bytes)")

    print("\nAll 5 images generated successfully!")
    print(f"Files: pochita_w1..w4.png + pochita_jump.png")

if __name__ == "__main__":
    main()
