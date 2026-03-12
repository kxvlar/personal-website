#!/usr/bin/env python3
"""
Eye Zoom Frame Generator
Generates 45 frames of an eye slowly zooming in until it goes black.
"""

from PIL import Image, ImageEnhance, ImageFilter
import os
import math

INPUT_IMAGE = "origin_2.jpg"  # Place your eye image here
OUTPUT_DIR = "eye_zoom_frames_2"
NUM_FRAMES = 20

os.makedirs(OUTPUT_DIR, exist_ok=True)

img = Image.open(INPUT_IMAGE).convert("RGBA")
width, height = img.size
cx, cy = width // 2, height // 2

print(f"Image size: {width}x{height}")
print(f"Generating {NUM_FRAMES} frames...")

for i in range(NUM_FRAMES):
    t = i / (NUM_FRAMES - 1)  # 0.0 → 1.0

    # Zoom: start at 1x, end at ~8x (deep into the pupil)
    zoom = 1.0 + (t ** 1.6) * 7.0

    # Crop box size shrinks as we zoom in
    crop_w = width / zoom
    crop_h = height / zoom

    # Center the crop
    left   = cx - crop_w / 2
    top    = cy - crop_h / 2
    right  = cx + crop_w / 2
    bottom = cy + crop_h / 2

    # Clamp to image bounds
    left   = max(0, left)
    top    = max(0, top)
    right  = min(width, right)
    bottom = min(height, bottom)

    cropped = img.crop((left, top, right, bottom))
    frame   = cropped.resize((width, height), Image.LANCZOS)

    # Fade to black in the final ~30% of frames
    if t > 0.70:
        darkness = (t - 0.70) / 0.30   # 0 → 1
        # Use a smooth ease-in curve
        darkness = darkness ** 1.8
        enhancer = ImageEnhance.Brightness(frame)
        frame = enhancer.enhance(1.0 - darkness)

    # Add very subtle vignette throughout
    vignette = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    from PIL import ImageDraw
    draw = ImageDraw.Draw(vignette)
    vignette_strength = int(80 + t * 120)
    for r in range(min(width, height) // 2, 0, -1):
        alpha = int(vignette_strength * (1 - r / (min(width, height) / 2)) ** 2)
        draw.ellipse(
            [cx - r, cy - r, cx + r, cy + r],
            fill=(0, 0, 0, alpha)
        )
    frame = Image.alpha_composite(frame.convert("RGBA"), vignette)

    # Save as RGB PNG
    out_path = os.path.join(OUTPUT_DIR, f"frame_{i+1:03d}.png")
    frame.convert("RGB").save(out_path, "PNG")

    bar_len = 30
    filled = int(bar_len * (i + 1) / NUM_FRAMES)
    bar = "█" * filled + "░" * (bar_len - filled)
    print(f"\r  [{bar}] {i+1}/{NUM_FRAMES}  zoom={zoom:.2f}x", end="", flush=True)

print(f"\n\n✅ Done! {NUM_FRAMES} frames saved to '{OUTPUT_DIR}/'")
print("\nTo make a GIF, run:")
print(f"  convert -delay 6 -loop 0 {OUTPUT_DIR}/frame_*.png eye_zoom.gif")
print("\nTo make an MP4 (ffmpeg):")
print(f"  ffmpeg -framerate 24 -i {OUTPUT_DIR}/frame_%03d.png -c:v libx264 -pix_fmt yuv420p eye_zoom.mp4")
