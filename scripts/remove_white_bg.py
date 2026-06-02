"""Remove white background from pochita.png, converting to transparent PNG."""
from PIL import Image
import os

IMG_PATH = os.path.join(os.path.dirname(__file__), '..', 'assets', 'images', 'pochita.png')
THRESHOLD = 200   # sum(RGB) above this = background candidate
FEATHER = 40      # transition zone

def is_white(r, g, b):
    """Return distance from pure white (lower = more white)."""
    return abs(r - 255) + abs(g - 255) + abs(b - 255)

def process_image(path):
    img = Image.open(path).convert('RGBA')
    w, h = img.size
    pixels = img.load()

    # Build alpha mask
    alpha = [[255] * h for _ in range(w)]
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            d = is_white(r, g, b)
            if d <= THRESHOLD:
                alpha[x][y] = 0
            elif d <= THRESHOLD + FEATHER:
                alpha[x][y] = int(255 * (d - THRESHOLD) / FEATHER)

    # Apply alpha
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            pixels[x, y] = (r, g, b, alpha[x][y])

    img.save(path)
    print(f'Done: {os.path.basename(path)} ({w}x{h})')

if __name__ == '__main__':
    process_image(IMG_PATH)
