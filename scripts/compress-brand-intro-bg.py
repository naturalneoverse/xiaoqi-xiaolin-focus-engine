#!/usr/bin/env python3
"""Export brand intro background to WebP for subpkg (target ~150-220KB).

Usage:
  python scripts/compress-brand-intro-bg.py path/to/source.png

Output:
  miniprogram/subpkg/brand-intro/bg.webp  (width 750, quality 82)
"""

import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError as e:
    raise SystemExit("Install Pillow: pip install Pillow") from e

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "miniprogram" / "subpkg" / "brand-intro" / "bg.webp"
TARGET_W = 750
QUALITY = 82


def main():
    if len(sys.argv) < 2:
        raise SystemExit(f"Usage: {sys.argv[0]} <source.png|jpg>")
    src = Path(sys.argv[1]).expanduser().resolve()
    if not src.is_file():
        raise SystemExit(f"Not found: {src}")

    img = Image.open(src).convert("RGB")
    w, h = img.size
    if w != TARGET_W:
        nh = max(1, round(h * TARGET_W / w))
        img = img.resize((TARGET_W, nh), Image.Resampling.LANCZOS)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT, "WEBP", quality=QUALITY, method=6)
    kb = OUT.stat().st_size / 1024
    print(f"Wrote {OUT} ({kb:.1f} KB, {img.size[0]}x{img.size[1]})")


if __name__ == "__main__":
    main()
