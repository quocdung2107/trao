# Ảnh minh họa cho trang xem mẫu (/mau/...): tự vẽ, không dùng ảnh của bên thứ ba.
import random, sys
from PIL import Image, ImageDraw, ImageFilter
out = sys.argv[1]
W = H = 900
def grad(top, bottom):
    im = Image.new("RGB", (W, H)); d = ImageDraw.Draw(im)
    for y in range(H):
        t = y / H; d.line([(0, y), (W, y)], fill=tuple(int(a + (b - a) * t) for a, b in zip(top, bottom)))
    return im
def bokeh(im, colors, n, rmin, rmax, blur, seed):
    rnd = random.Random(seed); layer = Image.new("RGBA", im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(layer)
    for _ in range(n):
        x, y, r = rnd.randint(0, W), rnd.randint(0, H), rnd.randint(rmin, rmax); c = rnd.choice(colors)
        d.ellipse([x - r, y - r, x + r, y + r], fill=c + (rnd.randint(70, 170),))
    return Image.alpha_composite(im.convert("RGBA"), layer.filter(ImageFilter.GaussianBlur(blur)))
def tree(im, cx, base, h, color, lights, seed):
    rnd = random.Random(seed); d = ImageDraw.Draw(im)
    for i in range(4):
        w = h * (0.25 + 0.17 * i); top = base - h + i * h * 0.2
        d.polygon([(cx, top), (cx - w, top + h * 0.38), (cx + w, top + h * 0.38)], fill=color)
    d.rectangle([cx - h * 0.05, base - h * 0.02, cx + h * 0.05, base + h * 0.08], fill=(80, 50, 30))
    glow = Image.new("RGBA", im.size, (0, 0, 0, 0)); g = ImageDraw.Draw(glow)
    for _ in range(46):
        t = rnd.random(); y = base - h + 30 + t * h * 0.95; half = (0.1 + 0.9 * t) * h * 0.72; x = cx + rnd.uniform(-half, half) * 0.8
        c = rnd.choice(lights); g.ellipse([x - 9, y - 9, x + 9, y + 9], fill=c + (200,)); d.ellipse([x - 3, y - 3, x + 3, y + 3], fill=(255, 250, 230))
    im.alpha_composite(glow.filter(ImageFilter.GaussianBlur(6)))
    star = [(cx, base - h - 22), (cx + 7, base - h - 6), (cx + 24, base - h - 4), (cx + 10, base - h + 7), (cx + 15, base - h + 25), (cx, base - h + 14), (cx - 15, base - h + 25), (cx - 10, base - h + 7), (cx - 24, base - h - 4), (cx - 7, base - h - 6)]
    d.polygon(star, fill=(255, 214, 110))
    return im
def gifts(im, seed, palette):
    rnd = random.Random(seed); d = ImageDraw.Draw(im)
    x = 120
    while x < W - 150:
        w = rnd.randint(130, 210); h = rnd.randint(110, 200); y = H - 90 - h; c = rnd.choice(palette)
        d.rounded_rectangle([x, y, x + w, H - 90], 10, fill=c)
        d.rectangle([x + w / 2 - 10, y, x + w / 2 + 10, H - 90], fill=(245, 215, 140))
        d.rectangle([x, y + h / 2 - 8, x + w, y + h / 2 + 8], fill=(245, 215, 140))
        d.ellipse([x + w / 2 - 34, y - 30, x + w / 2, y + 6], outline=(245, 215, 140), width=9)
        d.ellipse([x + w / 2, y - 30, x + w / 2 + 34, y + 6], outline=(245, 215, 140), width=9)
        x += w + rnd.randint(10, 40)
warm = [(255, 190, 90), (255, 140, 70), (255, 220, 150), (230, 90, 60)]
gold = [(232, 196, 110), (255, 226, 150), (190, 150, 70)]
night = [(255, 220, 140), (180, 200, 255), (255, 245, 210)]
imgs = {
  "lo-suoi-1": lambda: tree(bokeh(grad((92, 32, 22), (40, 14, 10)), warm, 60, 20, 70, 14, 1), 450, 760, 560, (38, 82, 46), warm, 2),
  "lo-suoi-2": lambda: (lambda im: (gifts(im, 3, [(170, 45, 30), (46, 92, 58), (120, 30, 25)]), im)[1])(bokeh(grad((70, 26, 18), (30, 12, 8)), warm, 70, 15, 60, 12, 4)),
  "lo-suoi-3": lambda: bokeh(bokeh(grad((60, 24, 16), (20, 8, 5)), warm, 50, 30, 90, 20, 5), warm, 40, 8, 20, 4, 6),
  "dem-thanh-1": lambda: tree(bokeh(grad((22, 36, 80), (8, 12, 30)), night, 50, 10, 50, 12, 7), 450, 760, 560, (20, 54, 52), night, 8),
  "dem-thanh-2": lambda: bokeh(bokeh(grad((25, 40, 90), (6, 10, 26)), night, 120, 2, 6, 1, 9), [(255, 230, 160)], 18, 30, 80, 24, 10),
  "dem-thanh-3": lambda: bokeh(grad((40, 30, 60), (10, 10, 25)), [(255, 205, 120), (255, 170, 80)], 60, 18, 60, 16, 11),
  "gala-1": lambda: bokeh(grad((26, 24, 30), (8, 8, 10)), gold, 90, 14, 60, 12, 12),
  "gala-2": lambda: (lambda im: (gifts(im, 13, [(25, 25, 28), (60, 50, 30), (120, 95, 45)]), im)[1])(bokeh(grad((24, 22, 28), (6, 6, 8)), gold, 70, 10, 50, 12, 14)),
  "gala-3": lambda: bokeh(bokeh(grad((20, 18, 22), (5, 5, 6)), gold, 40, 40, 110, 26, 15), gold, 60, 3, 10, 2, 16),
}
for name, f in imgs.items():
    im = f(); im = im.convert("RGB")
    im.save(f"{out}/{name}.webp", "WEBP", quality=78)
    if name.endswith("-1"): im.resize((720, 900)).save(f"{out}/{name}.jpg", "JPEG", quality=82)
print("ok")
