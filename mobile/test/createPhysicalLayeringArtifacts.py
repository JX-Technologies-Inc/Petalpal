import os
from PIL import Image, ImageDraw, ImageFont

ARTIFACT_DIR = r"C:\Users\cjysu\.gemini\antigravity\brain\29c68174-3514-4da4-a283-62d907ccd0b5"
FRAMES_DIR = r"C:\Users\cjysu\Documents\Petalpal\test_animation_frames"
os.makedirs(ARTIFACT_DIR, exist_ok=True)

# Load fonts
try:
    font_hero = ImageFont.truetype("arialbd.ttf", 20)
    font_title = ImageFont.truetype("arialbd.ttf", 15)
    font_bold = ImageFont.truetype("arialbd.ttf", 12)
    font_small = ImageFont.truetype("arial.ttf", 11)
except Exception:
    font_hero = font_title = font_bold = font_small = ImageFont.load_default()

# ── 1. LOAD SCREENSHOTS ──
f_stack = os.path.join(FRAMES_DIR, "layering_1_resting_stack.png")
f_inside = os.path.join(FRAMES_DIR, "layering_2_flap_open_paper_inside.png")
f_extract = os.path.join(FRAMES_DIR, "layering_3_opening_extracting.png")
f_reading = os.path.join(FRAMES_DIR, "layering_5_reading_settled.png")
f_closing_fold = os.path.join(FRAMES_DIR, "layering_6_closing_fold.png")
f_insert = os.path.join(FRAMES_DIR, "layering_7_closing_inserting.png")
f_flap = os.path.join(FRAMES_DIR, "layering_8_closing_flap.png")

img_stack = Image.open(f_stack)
img_inside = Image.open(f_inside)
img_extract = Image.open(f_extract)
img_reading = Image.open(f_reading)
img_closing_fold = Image.open(f_closing_fold)
img_insert = Image.open(f_insert)
img_flap = Image.open(f_flap)

# Save individual proofs to artifact dir
img_inside.save(os.path.join(ARTIFACT_DIR, "proof_paper_inside_pocket.png"))
img_extract.save(os.path.join(ARTIFACT_DIR, "proof_opening_extraction.png"))
img_insert.save(os.path.join(ARTIFACT_DIR, "proof_closing_insertion.png"))
img_flap.save(os.path.join(ARTIFACT_DIR, "proof_flap_closing.png"))
print("[1/3] Saved individual proof images to artifact directory.")

# ── 2. CREATE ANIMATED GIF (OPEN & CLOSE CYCLE) ──
gif_frames = [
    (img_stack, 1000),         # Resting stack
    (img_inside, 450),         # Flap open, paper inside pocket
    (img_extract, 500),        # Paper sliding out of pocket
    (img_reading, 1800),       # Unfolded full reading state
    (img_closing_fold, 450),   # Folded above opening
    (img_insert, 500),         # Paper sliding into pocket
    (img_flap, 450),           # Flap closing
    (img_stack, 900),          # Settled stack
]

# Scale frames down slightly for smooth GIF playback
gif_scaled = []
durations = []
for im, dur in gif_frames:
    # Resize to width 380
    w, h = im.size
    new_h = int(380 * h / w)
    resized = im.resize((380, new_h), Image.Resampling.LANCZOS).convert("P", palette=Image.Palette.ADAPTIVE)
    gif_scaled.append(resized)
    durations.append(dur)

gif_path = os.path.join(ARTIFACT_DIR, "physical_pocket_animation.gif")
gif_scaled[0].save(
    gif_path,
    save_all=True,
    append_images=gif_scaled[1:],
    duration=durations,
    loop=0,
    optimize=True
)
print(f"[2/3] Created animated GIF: {gif_path}")

# ── 3. CREATE COMPREHENSIVE 3-PANEL SHOWCASE CARD ──
# Crop focused envelope region from each key state
# Envelope region: x: 90 to 420, y: 150 to 570 (width ~330, height ~420)
crop_box = (90, 150, 422, 570)
c_inside = img_inside.crop(crop_box)
c_extract = img_extract.crop(crop_box)
c_insert = img_insert.crop(crop_box)

cw, ch = c_inside.size
target_w = 260
target_h = int(target_w * ch / cw)
c_inside_r = c_inside.resize((target_w, target_h), Image.Resampling.LANCZOS)
c_extract_r = c_extract.resize((target_w, target_h), Image.Resampling.LANCZOS)
c_insert_r = c_insert.resize((target_w, target_h), Image.Resampling.LANCZOS)

margin = 24
header_h = 90
card_w = target_w * 3 + margin * 4
card_h = header_h + target_h + 130

showcase = Image.new("RGB", (card_w, card_h), (22, 17, 14))
draw = ImageDraw.Draw(showcase)

# Header
draw.text((margin, 22), "PETALPAL MAILBOX — PHYSICAL POCKET LAYERING PROOF", fill=(255, 235, 195), font=font_hero)
draw.text((margin, 52), "True 5-Layer Envelope Architecture · Paper Sandwiched Strictly Between Back and Front Panels", fill=(195, 170, 145), font=font_bold)

# Paste 3 panels
panels = [
    ("1. PARTIALLY INSIDE POCKET", c_inside_r, 
     "Flap hinges back (-180°)\nTop of folded letter peeks out\nFront panel covers lower 102px\nPaper rests inside pocket"),
    ("2. OPENING: EXTRACTION", c_extract_r, 
     "Paper slides UP out of mouth\nFront pocket visibly occludes bottom\nEmerges in front of flap & lining\nZero sliding behind envelope"),
    ("3. CLOSING: INSERTION", c_insert_r, 
     "Paper slides DOWN into pocket\nBottom enters inside pocket throat\nFront pocket occludes paper as it enters\nFlap hinges shut over opening"),
]

for idx, (title, img, desc) in enumerate(panels):
    px = margin + idx * (target_w + margin)
    py = header_h + 10

    # Draw border around image
    showcase.paste(img, (px, py))
    draw.rectangle([(px - 1, py - 1), (px + target_w, py + target_h)], outline=(180, 140, 90), width=1)

    # Title
    draw.text((px, py + target_h + 10), title, fill=(245, 220, 170), font=font_title)
    
    # Description
    draw.text((px, py + target_h + 32), desc, fill=(190, 175, 160), font=font_small)

showcase_path = os.path.join(ARTIFACT_DIR, "physical_pocket_layering_showcase.png")
showcase.save(showcase_path)
print(f"[3/3] Created showcase comparison card: {showcase_path}")
