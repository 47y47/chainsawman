"""Remove dark background from Makima PNG images using color-distance thresholding."""
from PIL import Image
import os

IMG_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'images')
BG_COLOR = (26, 26, 26)    # target dark background
THRESHOLD = 55              # max color distance to be considered background
FEATHER = 15                # feather zone: partial alpha transition

def color_dist(c1, c2):
    return abs(c1[0]-c2[0]) + abs(c1[1]-c2[1]) + abs(c1[2]-c2[2])

def process_image(path):
    img = Image.open(path).convert('RGBA')
    w, h = img.size
    pixels = img.load()

    # Pass 1: mark background pixels
    alpha = [[0]*h for _ in range(w)]
    for y in range(h):
        for x in range(w):
            r, g, b, _ = pixels[x, y]
            d = color_dist((r, g, b), BG_COLOR)
            if d <= THRESHOLD:
                alpha[x][y] = 0
            elif d <= THRESHOLD + FEATHER:
                # Feather: linear transition from 0 to 255
                alpha[x][y] = int(255 * (d - THRESHOLD) / FEATHER)
            else:
                alpha[x][y] = 255

    # Apply alpha
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            pixels[x, y] = (r, g, b, alpha[x][y])

    img.save(path)
    print(f'  {os.path.basename(path)}  done')

def main():
    files = sorted(f for f in os.listdir(IMG_DIR) if f.startswith('makima_') and f.endswith('.png'))
    print(f'Processing {len(files)} images...')
    for f in files:
        process_image(os.path.join(IMG_DIR, f))
    print('All done.')

if __name__ == '__main__':
    main()
