"""Prepare textures for the diary scene. Run with /usr/bin/python3 -I (needs Pillow + numpy)."""
import os, sys, urllib.request
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEN = os.path.join(ROOT, 'gen')
TEX = os.path.join(ROOT, 'public', 'assets', 'tex')
os.makedirs(TEX, exist_ok=True)


def save(img, name, q=82):
    p = os.path.join(TEX, name)
    img.convert('RGB').save(p, 'JPEG', quality=q, optimize=True, progressive=True)
    print(name, img.size, os.path.getsize(p) // 1024, 'KB')


def normal_from_height(gray, strength=2.0):
    h = np.asarray(gray, dtype=np.float32) / 255.0
    dx = (np.roll(h, -1, axis=1) - np.roll(h, 1, axis=1)) * strength
    dy = (np.roll(h, -1, axis=0) - np.roll(h, 1, axis=0)) * strength
    nz = np.ones_like(h)
    n = np.stack([-dx, dy, nz], axis=-1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return Image.fromarray(((n * 0.5 + 0.5) * 255).astype(np.uint8))


# --- Parchment page: slightly desaturate + deepen, build normal from fibre detail
page = Image.open(os.path.join(GEN, 'page.png')).convert('RGB')
page = ImageEnhance.Color(page).enhance(0.78)
page = ImageEnhance.Brightness(page).enhance(0.95)
save(page, 'page_diff.jpg', 86)
g = page.convert('L')
hp = Image.fromarray(np.clip(np.asarray(g, np.float32) - np.asarray(g.filter(ImageFilter.GaussianBlur(6)), np.float32) + 128, 0, 255).astype(np.uint8))
save(normal_from_height(hp.filter(ImageFilter.GaussianBlur(0.6)), 3.0), 'page_nor.jpg', 88)

# --- Black leather cover
cov = Image.open(os.path.join(GEN, 'cover.png')).convert('RGB')
cov = cov.crop((0, 0, min(cov.size), min(cov.size))).resize((1024, 1024), Image.LANCZOS)
save(cov, 'cover_diff.jpg', 86)
cg = cov.convert('L')
chp = Image.fromarray(np.clip(np.asarray(cg, np.float32) - np.asarray(cg.filter(ImageFilter.GaussianBlur(4)), np.float32) + 128, 0, 255).astype(np.uint8))
save(normal_from_height(chp, 4.0), 'cover_nor.jpg', 88)
# roughness: rubbed (lighter) areas a bit glossier
r = np.asarray(cg.filter(ImageFilter.GaussianBlur(2)), np.float32) / 255.0
rough = np.clip(0.62 - (r - r.mean()) * 1.2, 0.35, 0.85)
save(Image.fromarray((rough * 255).astype(np.uint8)), 'cover_rough.jpg', 85)

# --- Desk wood (Poly Haven CC0): downsize/compress originals in place
for src, dst, size in [('dark_wood_diff.jpg', 'desk_diff.jpg', 2048), ('dark_wood_nor.jpg', 'desk_nor.jpg', 2048), ('dark_wood_rough.jpg', 'desk_rough.jpg', 1024)]:
    p = os.path.join(TEX, src)
    if os.path.exists(p):
        im = Image.open(p)
        if im.size[0] > size:
            im = im.resize((size, size), Image.LANCZOS)
        save(im, dst, 80)
        os.remove(p)
for n in ['brown_leather_diff.jpg', 'brown_leather_nor.jpg', 'brown_leather_rough.jpg']:
    p = os.path.join(TEX, n)
    if os.path.exists(p):
        os.remove(p)

# --- Page-edge (fore-edge) stripes
w, h = 64, 512
arr = np.zeros((h, w, 3), np.float32)
rng = np.random.default_rng(7)
base = np.array([214, 196, 156], np.float32)
for y in range(h):
    v = 0.82 + 0.18 * rng.random()
    if rng.random() < 0.12:
        v *= 0.75
    arr[y, :, :] = base * v
arr *= np.linspace(0.92, 1.0, w)[None, :, None]
save(Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)), 'edge_diff.jpg', 85)

# --- Back wall stone (Poly Haven castle_brick_07, CC0)
for kind, url in [('diff', 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/castle_brick_07/castle_brick_07_diff_1k.jpg'),
                  ('nor', 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/castle_brick_07/castle_brick_07_nor_gl_1k.jpg')]:
    p = os.path.join(TEX, f'wall_{kind}.jpg')
    if not os.path.exists(p):
        urllib.request.urlretrieve(url, p)
        im = Image.open(p)
        save(im, f'wall_{kind}.jpg', 78)
