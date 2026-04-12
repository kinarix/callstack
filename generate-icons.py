#!/usr/bin/env python3
"""
Icon Generator for CALLSTACK
Lightning bolt on dark navy gradient background
"""

from PIL import Image, ImageDraw, ImageFilter
import subprocess
import os


def hex_to_rgb(hex_color):
    h = hex_color.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))


def create_gradient(size, top_color, bottom_color):
    """Create a vertical gradient image."""
    img = Image.new('RGBA', (size, size))
    r1, g1, b1 = hex_to_rgb(top_color)
    r2, g2, b2 = hex_to_rgb(bottom_color)
    for y in range(size):
        t = y / (size - 1)
        r = int(r1 + (r2 - r1) * t)
        g = int(g1 + (g2 - g1) * t)
        b = int(b1 + (b2 - b1) * t)
        for x in range(size):
            img.putpixel((x, y), (r, g, b, 255))
    return img


def bolt_polygon(size):
    """
    Lightning bolt polygon scaled to `size`.
    Based on Lucide Zap proportions (viewBox 0 0 24 24):
      Points: (13,2) (4.09,12.26) (11,12.26) (11,22) (19.91,11.74) (13,11.74)
    Returns list of (x, y) tuples scaled to the icon canvas with padding.
    """
    raw = [
        (13, 2),
        (4.09, 12.26),
        (11, 12.26),
        (11, 22),
        (19.91, 11.74),
        (13, 11.74),
    ]
    # Bounding box of raw coords
    min_x = min(p[0] for p in raw)
    max_x = max(p[0] for p in raw)
    min_y = min(p[1] for p in raw)
    max_y = max(p[1] for p in raw)
    raw_w = max_x - min_x
    raw_h = max_y - min_y

    # Target canvas area: leave 20% padding on each side
    pad = size * 0.18
    target_w = size - 2 * pad
    target_h = size - 2 * pad

    scale = min(target_w / raw_w, target_h / raw_h)
    scaled_w = raw_w * scale
    scaled_h = raw_h * scale
    offset_x = (size - scaled_w) / 2 - min_x * scale
    offset_y = (size - scaled_h) / 2 - min_y * scale

    return [(x * scale + offset_x, y * scale + offset_y) for x, y in raw]


def create_icon(size):
    """Create the lightning bolt icon at the given size."""
    # 1. Navy gradient background
    img = create_gradient(size, '#0f172a', '#1e3a5f')

    poly = bolt_polygon(size)

    # 2. Teal glow layer (blurred, slightly larger bolt)
    glow_size = size * 2  # work at 2x for smoother blur
    glow_poly = bolt_polygon(glow_size)
    glow_layer = Image.new('RGBA', (glow_size, glow_size), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow_layer)
    glow_draw.polygon(glow_poly, fill=(16, 185, 129, 220))  # #10b981
    blur_radius = max(4, glow_size // 20)
    glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(radius=blur_radius))
    glow_layer = glow_layer.resize((size, size), Image.Resampling.LANCZOS)
    img = Image.alpha_composite(img, glow_layer)

    # 3. White bolt
    bolt_layer = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    bolt_draw = ImageDraw.Draw(bolt_layer)
    bolt_draw.polygon(poly, fill=(248, 250, 252, 255))  # #f8fafc
    img = Image.alpha_composite(img, bolt_layer)

    return img


def generate_all(icon_dir='src-tauri/icons'):
    os.makedirs(icon_dir, exist_ok=True)

    # Generate base images at needed sizes
    sizes = [
        (32,  '32x32.png'),
        (128, '128x128.png'),
        (256, '128x128@2x.png'),
        (512, 'icon.png'),
    ]

    base_512 = create_icon(512)
    base_512.save('icon-512.png', 'PNG')
    print('Generated icon-512.png (preview)')

    for size, filename in sizes:
        img = create_icon(size) if size >= 128 else base_512.resize((size, size), Image.Resampling.LANCZOS)
        out = os.path.join(icon_dir, filename)
        img.save(out, 'PNG')
        print(f'Generated {out}')

    # Windows ICO (multi-size)
    ico_sizes = [256, 128, 96, 64, 48, 32, 16]
    ico_images = []
    for s in ico_sizes:
        ico_images.append(base_512.resize((s, s), Image.Resampling.LANCZOS).convert('RGBA'))
    ico_path = os.path.join(icon_dir, 'icon.ico')
    ico_images[0].save(
        ico_path, 'ICO',
        sizes=[(s, s) for s in ico_sizes],
        append_images=ico_images[1:]
    )
    print(f'Generated {ico_path}')

    # macOS ICNS via iconutil
    if os.uname().sysname == 'Darwin':
        iconset_dir = os.path.join(icon_dir, 'icon.iconset')
        os.makedirs(iconset_dir, exist_ok=True)
        iconset_entries = [
            (16,  'icon_16x16.png'),
            (32,  'icon_16x16@2x.png'),
            (32,  'icon_32x32.png'),
            (64,  'icon_32x32@2x.png'),
            (128, 'icon_128x128.png'),
            (256, 'icon_128x128@2x.png'),
            (256, 'icon_256x256.png'),
            (512, 'icon_256x256@2x.png'),
            (512, 'icon_512x512.png'),
        ]
        for s, fname in iconset_entries:
            img = base_512.resize((s, s), Image.Resampling.LANCZOS)
            img.save(os.path.join(iconset_dir, fname), 'PNG')
        try:
            subprocess.run(['iconutil', '-c', 'icns', iconset_dir], check=True, capture_output=True)
            print(f'Generated {icon_dir}/icon.icns')
        except (FileNotFoundError, subprocess.CalledProcessError) as e:
            print(f'Skipping icon.icns: {e}')
    else:
        print('Skipping icon.icns (not macOS)')


if __name__ == '__main__':
    print('CALLSTACK Icon Generator — lightning bolt')
    generate_all()
    print('Done.')
