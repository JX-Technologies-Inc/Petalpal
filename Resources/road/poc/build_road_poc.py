"""Road POC: assemble rigid, overlapping master-image strips along centerlines.

Requires Pillow and NumPy. No Garden runtime or Blender dependency.
"""
from __future__ import annotations

import hashlib
import math
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.tools'))
import numpy as np
from PIL import Image, ImageDraw, ImageFont

PROJECT = ROOT.parents[1]
MASTER = PROJECT / 'Resources' / 'decorations' / 'road' / 'road_straight_master.png'
SOURCE_COPY = ROOT / 'source' / 'road_straight_master.png'
APPROVED_SHA256 = 'f21de5546f90639254bea5490ab9c7fd14760c02cc35093e6114335d71d1ca37'
POC = ROOT / 'poc'
CANVAS = (1400, 900)
ROAD_CENTER_Y = 450.0
SOURCE_CENTER_Y = 519.0
CROP_TOP, CROP_BOTTOM = 355, 685
TILE_STEP = 64.0
TILE_HALF = 58
FEATHER = 22


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def centerline(kind: str):
    x = np.linspace(0, CANVAS[0] - 1, 4000, dtype=np.float64)
    t = x / (CANVAS[0] - 1)
    if kind == 'straight':
        y = np.full_like(x, ROAD_CENTER_Y)
    elif kind == 'gentle_curve':
        y = ROAD_CENTER_Y + 82 * np.sin(np.pi * t) ** 2
    else:
        y = ROAD_CENTER_Y + 88 * np.sin(2 * np.pi * t)
    arc = np.concatenate(([0.0], np.cumsum(np.hypot(np.diff(x), np.diff(y)))))
    return x, y, arc


def repeating_patch(master_pixels: np.ndarray, s: float) -> Image.Image:
    """Wrap long paths through the master with a narrow controlled crossfade."""
    start, period, fade = 130, 1330, 70
    local = np.mod(s + np.arange(-TILE_HALF, TILE_HALF, dtype=np.float64), period)
    a_col = np.rint(start + local).astype(int)
    b_col = np.rint(start + local - period).astype(int)
    q = np.clip((local - (period - fade)) / fade, 0, 1).astype(np.float32)
    a = master_pixels[CROP_TOP:CROP_BOTTOM, a_col].astype(np.float32)
    b = master_pixels[CROP_TOP:CROP_BOTTOM, np.clip(b_col, 0, master_pixels.shape[1]-1)].astype(np.float32)
    blended = np.rint(a * (1-q[None,:,None]) + b * q[None,:,None]).astype(np.uint8)
    return Image.fromarray(blended, 'RGBA')


def render(kind: str, master: Image.Image) -> dict:
    path_x, path_y, arc = centerline(kind)
    total = float(arc[-1])
    repeat = total > master.width - 40
    source_start = (master.width - total) / 2 if not repeat else None
    master_pixels = np.asarray(master, dtype=np.uint8)
    yy = CROP_BOTTOM - CROP_TOP
    feather = np.ones(2 * TILE_HALF, dtype=np.float32)
    feather[:FEATHER] = np.linspace(0, 1, FEATHER, endpoint=False)
    feather[-FEATHER:] = np.linspace(1, 0, FEATHER, endpoint=False)
    acc = np.zeros((CANVAS[1], CANVAS[0], 3), dtype=np.float32)
    weight = np.zeros((CANVAS[1], CANVAS[0]), dtype=np.float32)
    coverage = np.zeros((CANVAS[1], CANVAS[0]), dtype=np.float32)
    tile_count = 0
    for s in np.arange(0, total + TILE_STEP, TILE_STEP):
        s = min(float(s), total)
        cx = float(np.interp(s, arc, path_x))
        cy = float(np.interp(s, arc, path_y))
        if repeat:
            patch = repeating_patch(master_pixels, s)
        else:
            sx = int(round(source_start + s))
            # A few pixels of source beyond the visible ends are harmless
            # because the review canvas clips the path at x=0 and x=1399.
            patch = master.crop((sx - TILE_HALF, CROP_TOP, sx + TILE_HALF, CROP_BOTTOM))
        raw = np.asarray(patch, dtype=np.uint8).copy()
        raw[:, :, 3] = np.where(raw[:, :, 3] < 16, 0, raw[:, :, 3])
        raw[:, :, 3] = np.rint(raw[:, :, 3].astype(np.float32) * feather[None, :]).astype(np.uint8)
        patch = Image.fromarray(raw, 'RGBA')
        lo = max(0, np.searchsorted(arc, s - 3))
        hi = min(len(arc) - 1, np.searchsorted(arc, s + 3))
        angle = math.degrees(math.atan2(float(path_y[hi] - path_y[lo]), float(path_x[hi] - path_x[lo])))
        rotated = patch.rotate(-angle, resample=Image.Resampling.BICUBIC, expand=True)
        tile = np.asarray(rotated, dtype=np.float32)
        left = int(round(cx - rotated.width / 2))
        top = int(round(cy - rotated.height / 2))
        x0 = max(0, left); y0 = max(0, top)
        x1 = min(CANVAS[0], left + rotated.width); y1 = min(CANVAS[1], top + rotated.height)
        if x1 <= x0 or y1 <= y0:
            continue
        cropped = tile[y0-top:y1-top, x0-left:x1-left]
        a = cropped[:, :, 3] / 255.0
        acc[y0:y1, x0:x1] += cropped[:, :, :3] * a[:, :, None]
        weight[y0:y1, x0:x1] += a
        np.maximum(coverage[y0:y1, x0:x1], a, out=coverage[y0:y1, x0:x1])
        tile_count += 1
        if s >= total:
            break
    rgb = np.clip(acc / np.maximum(weight[:, :, None], 1e-6), 0, 255).astype(np.uint8)
    rgba = np.dstack((rgb, np.clip(coverage * 255, 0, 255).astype(np.uint8)))
    result = Image.fromarray(rgba, 'RGBA')
    result.save(POC / f'road_poc_{kind}.png', optimize=True)
    return {'kind': kind, 'arc_px': round(total, 2), 'tiles': tile_count,
            'max_angle_deg': round(float(np.max(np.abs(np.rad2deg(np.arctan2(np.gradient(path_y), np.gradient(path_x)))))), 2)}


def contact_sheet():
    labels = [('straight', 'A  STRAIGHT'), ('gentle_curve', 'B  GENTLE CURVE'), ('s_curve', 'C  S-CURVE')]
    pad = 38
    row_h = CANVAS[1] + pad
    sheet = Image.new('RGBA', (CANVAS[0], row_h * 3), (42, 54, 50, 255))
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 22)
    except OSError:
        font = ImageFont.load_default()
    for row, (kind, label) in enumerate(labels):
        im = Image.open(POC / f'road_poc_{kind}.png').convert('RGBA')
        panel = Image.new('RGBA', CANVAS, (48, 60, 54, 255))
        panel.alpha_composite(im)
        sheet.alpha_composite(panel, (0, row * row_h + pad))
        draw.text((32, row * row_h + 7), label, font=font, fill=(237, 236, 221, 255))
    sheet.convert('RGB').save(POC / 'road_poc_contact_sheet.png', optimize=True)


def main():
    (ROOT / 'source').mkdir(parents=True, exist_ok=True)
    POC.mkdir(parents=True, exist_ok=True)
    if not SOURCE_COPY.exists():
        SOURCE_COPY.write_bytes(MASTER.read_bytes())
    assert sha256(MASTER) == APPROVED_SHA256, 'Production master differs from approved image'
    assert sha256(SOURCE_COPY) == APPROVED_SHA256, 'Road source copy differs from approved image'
    master = Image.open(SOURCE_COPY).convert('RGBA')
    assert master.size == (1536, 1024)
    print('approved_source_sha256', sha256(SOURCE_COPY))
    print('canonical_width_px', 237, 'source_opaque_alpha_median_100_to_1435')
    for kind in ('straight', 'gentle_curve', 's_curve'):
        print(render(kind, master))
    contact_sheet()


if __name__ == '__main__':
    main()
