#!/usr/bin/env python3
"""
Modern Icon Generator for CALLSTACK
Generates clean, minimal REST API testing tool icons
"""

from PIL import Image, ImageDraw
import subprocess
import os

def create_icon(size, output_path):
    """Create a modern, minimal icon for CALLSTACK"""

    # Modern color palette
    primary = '#2563eb'   # Modern blue
    accent = '#06b6d4'    # Cyan accent

    img = Image.new('RGBA', (size, size), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)

    # Draw rounded rectangle background
    radius = size // 8  # Rounded corner radius
    draw.rounded_rectangle(
        [(0, 0), (size, size)],
        radius=radius,
        fill='#ffffff'
    )

    # Draw circular background
    margin = size // 12
    circle_bbox = [margin, margin, size - margin, size - margin]
    draw.ellipse(circle_bbox, fill=primary, outline=None)

    # Draw modern request/response arrows in the center
    center = size // 2
    arrow_size = size // 4
    line_width = max(2, size // 32)

    # Left arrow (request) - pointing right
    arrow_left_x = center - arrow_size // 2
    arrow_right_x = center

    # Left arrow line
    draw.line(
        [(arrow_left_x, center), (arrow_right_x, center)],
        fill='#ffffff',
        width=line_width
    )

    # Left arrow head
    arrow_head_size = size // 12
    points_left = [
        (arrow_right_x, center),
        (arrow_right_x - arrow_head_size, center - arrow_head_size // 2),
        (arrow_right_x - arrow_head_size, center + arrow_head_size // 2),
    ]
    draw.polygon(points_left, fill='#ffffff')

    # Right arrow (response) - pointing left
    arrow_right_start = center + arrow_size // 2

    # Right arrow line
    draw.line(
        [(arrow_right_start, center + size // 8), (center, center + size // 8)],
        fill=accent,
        width=line_width
    )

    # Right arrow head
    points_right = [
        (center, center + size // 8),
        (center + arrow_head_size, center + size // 8 - arrow_head_size // 2),
        (center + arrow_head_size, center + size // 8 + arrow_head_size // 2),
    ]
    draw.polygon(points_right, fill=accent)

    # Draw decorative circles for network concept
    circle_radius = size // 20
    circle_spacing = size // 6

    # Left node
    left_circle_x = center - circle_spacing
    draw.ellipse(
        [left_circle_x - circle_radius, center - circle_radius,
         left_circle_x + circle_radius, center + circle_radius],
        fill=None,
        outline='#ffffff',
        width=max(1, size // 64)
    )

    # Right node
    right_circle_x = center + circle_spacing
    draw.ellipse(
        [right_circle_x - circle_radius, center + size // 8 - circle_radius,
         right_circle_x + circle_radius, center + size // 8 + circle_radius],
        fill=None,
        outline=accent,
        width=max(1, size // 64)
    )

    # Save the icon
    img.save(output_path, 'PNG')
    print(f"✓ Generated {output_path}")
    return output_path

def generate_platform_icons(icon_512_path):
    """Generate platform-specific icons from the 512x512 base icon"""
    icon_dir = 'src-tauri/icons'
    os.makedirs(icon_dir, exist_ok=True)

    try:
        # Use ImageMagick to convert and resize
        sizes = [
            (32, '32x32.png'),
            (128, '128x128.png'),
            (256, '128x128@2x.png'),  # 2x retina
            (512, 'icon.png'),
        ]

        for size, filename in sizes:
            output_path = os.path.join(icon_dir, filename)
            img = Image.open(icon_512_path)
            img = img.resize((size, size), Image.Resampling.LANCZOS)
            img.save(output_path, 'PNG')
            print(f"✓ Generated {output_path}")

        # Generate ICO (Windows) using PIL
        try:
            img = Image.open(icon_512_path)
            ico_sizes = [(256, 256), (128, 128), (96, 96), (64, 64), (48, 48), (32, 32), (16, 16)]
            icons = []
            for width, height in ico_sizes:
                resized = img.resize((width, height), Image.Resampling.LANCZOS)
                icons.append(resized)

            icons[0].save(
                os.path.join(icon_dir, 'icon.ico'),
                'ICO',
                sizes=ico_sizes
            )
            print(f"✓ Generated {icon_dir}/icon.ico")
        except Exception as e:
            print(f"⚠ Skipping icon.ico ({e})")

        # Try to generate ICNS (macOS) - requires sips on macOS
        if os.uname().sysname == 'Darwin':
            try:
                icon_set_path = os.path.join(icon_dir, 'icon.iconset')
                os.makedirs(icon_set_path, exist_ok=True)

                # Create iconset with various sizes
                iconset_sizes = [
                    (16, 'icon_16x16.png'),
                    (32, 'icon_16x16@2x.png'),
                    (32, 'icon_32x32.png'),
                    (64, 'icon_32x32@2x.png'),
                    (128, 'icon_128x128.png'),
                    (256, 'icon_128x128@2x.png'),
                    (256, 'icon_256x256.png'),
                    (512, 'icon_256x256@2x.png'),
                    (512, 'icon_512x512.png'),
                ]

                for size, filename in iconset_sizes:
                    img = Image.open(icon_512_path)
                    img = img.resize((size, size), Image.Resampling.LANCZOS)
                    img.save(os.path.join(icon_set_path, filename), 'PNG')

                # Convert iconset to ICNS
                subprocess.run(
                    ['iconutil', '-c', 'icns', icon_set_path],
                    check=True,
                    capture_output=True
                )
                print(f"✓ Generated {icon_dir}/icon.icns")
            except (FileNotFoundError, subprocess.CalledProcessError):
                print(f"⚠ Skipping icon.icns (iconutil not available)")

    except Exception as e:
        print(f"Error generating platform icons: {e}")

def main():
    print("=" * 50)
    print("CALLSTACK Modern Icon Generator")
    print("=" * 50)

    # Generate the base 512x512 icon
    icon_512 = create_icon(512, 'icon-512.png')
    create_icon(192, 'icon-192.png')

    print()
    print("Generating platform-specific icons...")
    generate_platform_icons(icon_512)

    print("=" * 50)
    print("Icon generation complete!")

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
