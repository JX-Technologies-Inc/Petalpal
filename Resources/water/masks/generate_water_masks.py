"""Regenerate Garden spatial masks from mobile Garden layout and source PNG alpha.

Run from the project root after installing requirements.txt:
    python Resources/water/masks/generate_water_masks.py
All output pixels use the mobile Garden's top-left-origin world coordinates.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / '.tools'))  # Optional isolated dependencies.

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFont
from scipy.ndimage import binary_fill_holes, distance_transform_edt
from PIL import ImageFilter

ROOT = HERE.parents[2]
LAYOUT = ROOT / 'mobile/src/components/garden/gardenMapLayout.ts'
ASSETS = ROOT / 'mobile/assets/garden/land'
SHORE_FADE_PX = 90.0
DEPTH_START_PX = 28.0
DEPTH_FULL_PX = 200.0
ALPHA_OCCUPANCY_THRESHOLD = 128

# Visual-use controls. Modulation cells are hundreds of pixels across and are
# blurred before use; the seed makes every run deterministic.
VISUAL_SEED = 20260922
VISUAL_SHORE_MAX_PX = 55.0
VISUAL_SHORE_MAX_STRENGTH = 0.72
VISUAL_SHORE_GRID = (6, 5)
VISUAL_DEPTH_GRID = (7, 6)
VISUAL_FIELD_BLUR_PX = 110
VISUAL_DEPTH_START_PX = 28.0
VISUAL_DEPTH_FULL_PX = 235.0
VISUAL_DEPTH_DISTANCE_SHIFT_PX = 90.0


def read_layout():
    source = LAYOUT.read_text(encoding='utf-8')
    def constant(name):
        match = re.search(rf'export const {name}\s*=\s*(\d+)\s*;', source)
        if not match:
            raise ValueError(f'Missing {name} in {LAYOUT}')
        return int(match.group(1))
    width = constant('GARDEN_WORLD_WIDTH')
    height = constant('GARDEN_WORLD_HEIGHT')
    block = re.search(r'export const GARDEN_LANDS\s*=\s*\[(.*?)\]\s*as const', source, re.S)
    if not block:
        raise ValueError(f'Cannot parse GARDEN_LANDS in {LAYOUT}')
    lands = []
    fields = r"id:\s*'([^']+)'.*?source:\s*require\('([^']+)'\).*?x:\s*([-\d.]+).*?y:\s*([-\d.]+).*?width:\s*([-\d.]+).*?rotation:\s*([-\d.]+)"
    for item in re.findall(r'\{([^{}]+)\}', block.group(1), re.S):
        match = re.search(fields, item, re.S)
        if not match:
            raise ValueError(f'Cannot parse land entry: {item}')
        land_id, source_path, x, y, displayed_width, rotation = match.groups()
        path = ASSETS / Path(source_path).name
        if not path.is_file():
            raise FileNotFoundError(path)
        lands.append((land_id, path, float(x), float(y), float(displayed_width), float(rotation)))
    if len(lands) != 7 or len({land[0] for land in lands}) != len(lands):
        raise ValueError(f'Expected seven distinct production lands, got {len(lands)}')
    return width, height, lands


def smoothstep(value):
    value = np.clip(value, 0.0, 1.0)
    return value * value * (3.0 - 2.0 * value)


def font(size):
    path = Path('C:/Windows/Fonts/arial.ttf')
    return ImageFont.truetype(str(path), size) if path.exists() else ImageFont.load_default()


def broad_field(rng, size, grid):
    """Smooth seeded modulation with ~350-500 px cells, no pixel-scale texture."""
    coarse = np.rint(rng.random((grid[1], grid[0])) * 255).astype(np.uint8)
    image = Image.fromarray(coarse, 'L').resize(size, Image.Resampling.BICUBIC)
    image = image.filter(ImageFilter.GaussianBlur(VISUAL_FIELD_BLUR_PX))
    values = np.asarray(image, dtype=np.float32) / 255.0
    low, high = np.quantile(values, (0.05, 0.95))
    return np.clip((values - low) / (high - low), 0.0, 1.0)


def save_raw_if_missing_or_validate(name, pixels):
    path = HERE / name
    if path.exists():
        with Image.open(path) as existing:
            if existing.mode != 'L' or existing.size != (pixels.shape[1], pixels.shape[0]) or not np.array_equal(np.asarray(existing), pixels):
                raise ValueError(f'Approved raw mask differs from regenerated data: {path}')
        print(f'Preserved approved raw mask: {name}')
    else:
        Image.fromarray(pixels, 'L').save(path, optimize=True)
        print(f'Created missing raw mask: {name}')


def main():
    width, height, lands = read_layout()
    canvas = (width, height)
    combined_alpha = Image.new('L', canvas, 0)
    garden = Image.new('RGBA', canvas, (120, 184, 178, 255))
    for land_id, path, x, y, displayed_width, rotation in lands:
        with Image.open(path) as source:
            if source.mode not in ('RGBA', 'LA') or 'A' not in source.getbands():
                raise ValueError(f'Land has no alpha channel: {path}')
            source = source.convert('RGBA')
            displayed_height = displayed_width * source.height / source.width
            size = (round(displayed_width), round(displayed_height))
            image = source.resize(size, Image.Resampling.LANCZOS)
        # Skia rotates clockwise for positive angles in top-left-origin screen space.
        image = image.rotate(-rotation, resample=Image.Resampling.BICUBIC, expand=True)
        center_x = x + displayed_width / 2
        center_y = y + displayed_height / 2
        left = round(center_x - image.width / 2)
        top = round(center_y - image.height / 2)
        alpha_layer = Image.new('L', canvas, 0)
        alpha_layer.paste(image.getchannel('A'), (left, top))
        combined_alpha = ImageChops.lighter(combined_alpha, alpha_layer)
        artwork_layer = Image.new('RGBA', canvas, (0, 0, 0, 0))
        artwork_layer.paste(image, (left, top))
        garden = Image.alpha_composite(garden, artwork_layer)
        print(f'{land_id}: {path.name}, source={source.size}, placed=({x:g},{y:g}), '
              f'width={displayed_width:g}, height={displayed_height:.2f}, rotation={rotation:g}')

    raw_land = np.asarray(combined_alpha, dtype=np.uint8) >= ALPHA_OCCUPANCY_THRESHOLD
    # Source alpha can contain enclosed one-pixel artwork pinholes. They are
    # interior to a land silhouette and must not become isolated water cells.
    land = binary_fill_holes(raw_land)
    print(f'Filled {int(land.sum() - raw_land.sum())} enclosed pinhole pixels')
    water = ~land
    distance = distance_transform_edt(water).astype(np.float32)
    shallow = 1.0 - smoothstep(distance / SHORE_FADE_PX)
    shallow[land] = 0.0
    depth = smoothstep((distance - DEPTH_START_PX) / (DEPTH_FULL_PX - DEPTH_START_PX))
    depth[land] = 0.0
    masks = {
        'land_combined_mask.png': np.where(land, 255, 0).astype(np.uint8),
        'water_area_mask.png': np.where(water, 255, 0).astype(np.uint8),
        'shore_shallow_mask.png': np.rint(shallow * 255).astype(np.uint8),
        'open_water_depth_mask.png': np.rint(depth * 255).astype(np.uint8),
    }
    for name, pixels in masks.items():
        save_raw_if_missing_or_validate(name, pixels)

    # Side-by-side diagnostic at common scale; labels are outside the mask panels.
    panel = (600, 450)
    contact = Image.new('RGB', (panel[0] * 4, panel[1] + 64), '#20282b')
    draw = ImageDraw.Draw(contact)
    for index, (name, pixels) in enumerate(masks.items()):
        thumbnail = Image.fromarray(pixels, 'L').resize(panel, Image.Resampling.LANCZOS)
        contact.paste(thumbnail.convert('RGB'), (index * panel[0], 64))
        draw.text((index * panel[0] + 16, 18), name, fill='white', font=font(25))
    raw_contact = HERE / 'water_masks_contact_sheet.png'
    if not raw_contact.exists():
        contact.save(raw_contact, optimize=True)

    # Tint only spatial mask values, over the actual source-land composition.
    garden_rgb = np.asarray(garden.convert('RGB'), dtype=np.float32).copy()
    cyan = np.array([0, 245, 255], dtype=np.float32)
    blue = np.array([15, 40, 245], dtype=np.float32)
    cyan_amount = (shallow * 0.58)[:, :, None]
    blue_amount = (depth * 0.32)[:, :, None]
    garden_rgb = garden_rgb * (1 - blue_amount) + blue * blue_amount
    garden_rgb = garden_rgb * (1 - cyan_amount) + cyan * cyan_amount
    # The interior is guaranteed untouched, even at antialiased art edges.
    overlay = Image.fromarray(np.rint(np.clip(garden_rgb, 0, 255)).astype(np.uint8), 'RGB')
    legend = ImageDraw.Draw(overlay)
    legend.rectangle((16, 16, 970, 76), fill=(20, 32, 37))
    legend.text((30, 28), 'CYAN shallow water   |   BLUE open-water depth',
                fill='white', font=font(27))
    raw_validation = HERE / 'water_mask_validation_overlay.png'
    if not raw_validation.exists():
        overlay.save(raw_validation, optimize=True)

    assert all(image.shape == (height, width) and image.dtype == np.uint8
               for image in masks.values())
    assert not np.any(masks['shore_shallow_mask.png'][land])
    assert not np.any(masks['open_water_depth_mask.png'][land])
    assert np.array_equal(masks['water_area_mask.png'], 255 - masks['land_combined_mask.png'])

    # Visual-use masks derive from the approved raw occupancy. Distance remains
    # the primary spatial signal; broad fields only modulate its strength/width.
    visual_distance = distance_transform_edt(masks['water_area_mask.png'] > 0).astype(np.float32)
    rng = np.random.default_rng(VISUAL_SEED)
    shore_field = broad_field(rng, canvas, VISUAL_SHORE_GRID)
    shore_strength = 0.025 + (VISUAL_SHORE_MAX_STRENGTH - 0.025) * smoothstep(shore_field)
    visual_shore = (1.0 - smoothstep(visual_distance / VISUAL_SHORE_MAX_PX)) * shore_strength
    visual_shore[land] = 0.0
    depth_field = broad_field(rng, canvas, VISUAL_DEPTH_GRID)
    shifted_distance = visual_distance + (depth_field - 0.5) * VISUAL_DEPTH_DISTANCE_SHIFT_PX
    visual_depth = smoothstep((shifted_distance - VISUAL_DEPTH_START_PX) /
                              (VISUAL_DEPTH_FULL_PX - VISUAL_DEPTH_START_PX))
    visual_depth *= 0.70 + 0.24 * depth_field
    visual_depth[visual_distance <= VISUAL_DEPTH_START_PX] = 0.0
    visual_depth[land] = 0.0
    visual_masks = {
        'shore_shallow_visual_mask.png': np.rint(visual_shore * 255).astype(np.uint8),
        'open_water_depth_visual_mask.png': np.rint(visual_depth * 255).astype(np.uint8),
    }
    for name, pixels in visual_masks.items():
        Image.fromarray(pixels, 'L').save(HERE / name, optimize=True)

    review = HERE / 'visual_review'
    review.mkdir(exist_ok=True)
    for name, pixels in visual_masks.items():
        preview_name = name.replace('_mask.png', '_mask_preview.png')
        Image.fromarray(pixels, 'L').resize((1200, 900), Image.Resampling.LANCZOS).save(
            review / preview_name, optimize=True)

    # Low-opacity review tint over the same production-land composition.
    visual_rgb = np.asarray(garden.convert('RGB'), dtype=np.float32).copy()
    depth_amount = (visual_depth * 0.16)[:, :, None]
    shore_amount = (visual_shore * 0.23)[:, :, None]
    visual_rgb = visual_rgb * (1 - depth_amount) + blue * depth_amount
    visual_rgb = visual_rgb * (1 - shore_amount) + cyan * shore_amount
    visual_overlay = Image.fromarray(
        np.rint(np.clip(visual_rgb, 0, 255)).astype(np.uint8), 'RGB')
    visual_draw = ImageDraw.Draw(visual_overlay)
    visual_draw.rectangle((16, 16, 930, 76), fill=(20, 32, 37))
    visual_draw.text((30, 28), 'CYAN subtle shallow   |   BLUE open depth',
                     fill='white', font=font(27))
    visual_overlay.save(review / 'water_visual_masks_validation_overlay.png', optimize=True)

    with Image.open(raw_validation) as raw_image:
        raw_panel = raw_image.convert('RGB').resize((1200, 900), Image.Resampling.LANCZOS)
    visual_panel = visual_overlay.resize((1200, 900), Image.Resampling.LANCZOS)
    compare = Image.new('RGB', (2400, 970), '#20282b')
    compare.paste(raw_panel, (0, 70))
    compare.paste(visual_panel, (1200, 70))
    compare_draw = ImageDraw.Draw(compare)
    compare_draw.text((20, 17), 'RAW MATHEMATICAL', fill='white', font=font(34))
    compare_draw.text((1220, 17), 'VISUAL-USE', fill='white', font=font(34))
    compare.save(review / 'water_visual_masks_split_compare.png', optimize=True)

    assert all(pixels.shape == (height, width) and pixels.dtype == np.uint8
               for pixels in visual_masks.values())
    assert not np.any(visual_masks['shore_shallow_visual_mask.png'][land])
    assert not np.any(visual_masks['open_water_depth_visual_mask.png'][land])
    assert np.max(visual_masks['shore_shallow_visual_mask.png']) < 255
    assert not np.any(visual_shore[visual_distance >= VISUAL_SHORE_MAX_PX])
    print(f'Generated {len(masks)} masks at {width}x{height}; '
          f'shore fade={SHORE_FADE_PX:g}px; depth={DEPTH_START_PX:g}-{DEPTH_FULL_PX:g}px')
    print(f'Generated visual masks: shore <= {VISUAL_SHORE_MAX_PX:g}px, '
          f'max={int(visual_masks["shore_shallow_visual_mask.png"].max())}/255, '
          f'seed={VISUAL_SEED}')


if __name__ == '__main__':
    main()
