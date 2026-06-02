"""Extract frames from walking video, remove green screen, build sprite sheet."""
import cv2
import numpy as np
from pathlib import Path

VIDEO = r"c:\Users\12858\Downloads\A_cute_chibi_orange_Pochita_fr (1).mp4"
OUT_DIR = Path("d:/chainsawman/assets/images")
FRAME_COUNT = 8          # Number of frames to extract
FRAME_W = 100            # Target display width (px), height auto from aspect

def main():
    cap = cv2.VideoCapture(VIDEO)
    if not cap.isOpened():
        print("ERROR: Cannot open video")
        return

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    print(f"Video: {width}x{height}, {total_frames} frames, {fps:.1f} fps")

    # Skip first 10% and last 10% (startup/ending artifacts)
    start_frame = int(total_frames * 0.15)
    end_frame = int(total_frames * 0.85)
    usable = end_frame - start_frame
    print(f"Extracting {FRAME_COUNT} frames from frame {start_frame} to {end_frame}")

    # Extract frames
    raw_frames = []
    for i in range(FRAME_COUNT):
        frame_idx = start_frame + int(usable * i / (FRAME_COUNT - 1))
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
        ret, frame = cap.read()
        if ret:
            # Convert BGR to RGB
            frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            raw_frames.append(frame)
            print(f"  Frame {i+1}/{FRAME_COUNT} @ index {frame_idx}")
    cap.release()

    if len(raw_frames) < FRAME_COUNT:
        print(f"WARNING: Only got {len(raw_frames)} frames")
        FRAME_COUNT = len(raw_frames)

    # Process: remove green screen, find unified bounding box
    processed = []
    all_nonzero = []  # for computing unified bbox

    for i, frame in enumerate(raw_frames):
        # Green screen removal
        r, g, b = frame[:,:,0].astype(float), frame[:,:,1].astype(float), frame[:,:,2].astype(float)

        # Green is dominant: g > r*1.2 and g > b*1.2 and g > 80
        mask = (g > r * 1.15) & (g > b * 1.15) & (g > 80)
        alpha = np.where(mask, 0, 255).astype(np.uint8)

        # Feather edges
        kernel = np.ones((3,3), np.uint8)
        alpha_erode = cv2.erode(alpha, kernel, iterations=1)
        alpha_dilate = cv2.dilate(alpha, kernel, iterations=2)
        alpha = cv2.medianBlur(alpha_dilate, 3)

        # RGBA
        rgba = np.dstack([frame, alpha])
        processed.append(rgba)

        # Track non-transparent pixels for bbox
        ys, xs = np.where(alpha > 30)
        if len(ys) > 0:
            all_nonzero.append((ys.min(), ys.max(), xs.min(), xs.max()))

    # Unified bounding box (with padding)
    pad = 8
    y_min = max(0, min(n[0] for n in all_nonzero) - pad)
    y_max = min(height, max(n[1] for n in all_nonzero) + pad)
    x_min = max(0, min(n[2] for n in all_nonzero) - pad)
    x_max = min(width, max(n[3] for n in all_nonzero) + pad)
    bbox_w = x_max - x_min
    bbox_h = y_max - y_min
    print(f"Unified bbox: {x_min},{y_min} → {x_max},{y_max} ({bbox_w}x{bbox_h})")

    # Crop all frames to unified bbox
    cropped = []
    for rgba in processed:
        crop = rgba[y_min:y_max, x_min:x_max]
        cropped.append(crop)

    # Calculate display height from target width, maintaining aspect ratio
    display_h = int(FRAME_W * bbox_h / bbox_w)
    print(f"Display size: {FRAME_W}x{display_h} per frame")

    # Resize and build sprite sheet
    resized_frames = []
    for crop in cropped:
        resized = cv2.resize(crop, (FRAME_W, display_h), interpolation=cv2.INTER_LANCZOS4)
        resized_frames.append(resized)

    # Horizontal sprite sheet
    sprite_w = FRAME_W * FRAME_COUNT
    sprite = np.zeros((display_h, sprite_w, 4), dtype=np.uint8)
    for i, frame in enumerate(resized_frames):
        sprite[:, i*FRAME_W:(i+1)*FRAME_W] = frame

    # Save
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUT_DIR / "pochita_walk.png"
    cv2.imwrite(str(out_path), cv2.cvtColor(sprite, cv2.COLOR_RGBA2BGRA))
    print(f"\nSaved sprite sheet: {out_path} ({sprite_w}x{display_h}, {FRAME_COUNT} frames)")

    # Also save the first frame for reference
    ref_path = OUT_DIR / "pochita_walk_ref.png"
    cv2.imwrite(str(ref_path), cv2.cvtColor(resized_frames[0], cv2.COLOR_RGBA2BGRA))
    print(f"Saved reference frame: {ref_path}")

    print("Done!")

if __name__ == "__main__":
    main()
