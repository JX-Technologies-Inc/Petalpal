import os
import shutil
from PIL import Image, ImageDraw, ImageFont

ARTIFACT_DIR = r"C:\Users\cjysu\.gemini\antigravity\brain\29c68174-3514-4da4-a283-62d907ccd0b5"
FRAMES_DIR = r"C:\Users\cjysu\Documents\Petalpal\test_animation_frames_garden_mailbox"

screens = [
    "screen_1_garden_initial.png",
    "screen_2_fairy_walking.png",
    "screen_3_fairy_retrieval.png",
    "screen_4_mailbox_reading.png",
    "screen_5_returned_idle.png",
]

# Copy all screenshots to artifact directory
for s in screens:
    src = os.path.join(FRAMES_DIR, s)
    if os.path.exists(src):
        dst = os.path.join(ARTIFACT_DIR, s)
        shutil.copy2(src, dst)
        print(f"Copied {s} to artifact dir")

# Build Composite Showcase Image (2200x1350)
showcase_w = 2200
showcase_h = 1380
showcase = Image.new("RGB", (showcase_w, showcase_h), (20, 24, 22))
draw = ImageDraw.Draw(showcase)

# Banner Header
draw.rectangle([(0, 0), (showcase_w, 95)], fill=(30, 48, 38))
draw.text((45, 22), "PetalPal — Production Garden Mailbox Integration & Complete Interaction Loop", fill=(250, 246, 238))
draw.text((45, 54), "Tap Mailbox -> Fairy Walks Across Garden -> Retrieval & Presentation Hold -> Smooth Handoff to /mailbox -> Return to Idle", fill=(190, 220, 198))

# We display 5 primary panels:
# Top row (3 panels): Step 1 (Initial Idle), Step 2 (Walking), Step 3 (Retrieval & Hold)
# Bottom row (2 panels): Step 4 (Mailbox Stationery Page), Step 5 (Returned to Garden Idle at Mailbox)

card_bg = (28, 36, 32)
card_outline = (75, 110, 85)

# Panel 1: Step 1 Initial Garden (x: 45, y: 120, w: 680, h: 560)
# Panel 2: Step 2 Fairy Walking (x: 760, y: 120, w: 680, h: 560)
# Panel 3: Step 3 Mail Retrieval (x: 1475, y: 120, w: 680, h: 560)

row1_panels = [
    ("1. TAP MAILBOX IN GARDEN", "Fairy idle on lawn · User taps Mailbox landmark or action", "screen_1_garden_initial.png", 45),
    ("2. FAIRY WALKS TO MAILBOX", "Autonomous pathfinding along garden roads · Busy lock active", "screen_2_fairy_walking.png", 760),
    ("3. RETRIEVAL & PRESENTATION", "Mailbox reach -> Turn toward camera -> Unfold -> 800ms hold", "screen_3_fairy_retrieval.png", 1475),
]

for title, sub, filename, px in row1_panels:
    py = 120
    pw = 680
    ph = 560
    draw.rectangle([(px, py), (px + pw, py + ph)], fill=card_bg, outline=card_outline, width=1)
    draw.rectangle([(px, py), (px + pw, py + 48)], fill=(36, 56, 44))
    draw.text((px + 16, py + 12), title, fill=(255, 245, 225))
    draw.text((px + 16, py + 30), sub, fill=(180, 210, 190))

    img_path = os.path.join(FRAMES_DIR, filename)
    if os.path.exists(img_path):
        im = Image.open(img_path)
        # crop and fit
        thumb = im.resize((pw - 24, ph - 64), Image.Resampling.LANCZOS)
        showcase.paste(thumb, (px + 12, py + 54))
        draw.rectangle([(px + 12, py + 54), (px + pw - 12, py + ph - 10)], outline=(60, 90, 70), width=1)

# Row 2 (2 large panels):
# Panel 4: Step 4 /mailbox Open Stationery (x: 45, y: 710, w: 1030, h: 630)
# Panel 5: Step 5 Return to Garden (x: 1125, y: 710, w: 1030, h: 630)

row2_panels = [
    ("4. SEAMLESS TRANSITION TO /mailbox", "Opens directly into approved floating stationery · Read/unread distinction · Global Help & Feedback", "screen_4_mailbox_reading.png", 45),
    ("5. RETURN TO GARDEN VIA '← Garden'", "Fairy rests idle at mailboxExitAnchor (1050, 1010) · No teleportation, reset, or loop", "screen_5_returned_idle.png", 1125),
]

for title, sub, filename, px in row2_panels:
    py = 710
    pw = 1030
    ph = 630
    draw.rectangle([(px, py), (px + pw, py + ph)], fill=card_bg, outline=card_outline, width=1)
    draw.rectangle([(px, py), (px + pw, py + 48)], fill=(36, 56, 44))
    draw.text((px + 20, py + 12), title, fill=(255, 245, 225))
    draw.text((px + 20, py + 30), sub, fill=(180, 210, 190))

    img_path = os.path.join(FRAMES_DIR, filename)
    if os.path.exists(img_path):
        im = Image.open(img_path)
        thumb = im.resize((pw - 30, ph - 68), Image.Resampling.LANCZOS)
        showcase.paste(thumb, (px + 15, py + 56))
        draw.rectangle([(px + 15, py + 56), (px + pw - 15, py + ph - 12)], outline=(60, 90, 70), width=1)

showcase_out = os.path.join(ARTIFACT_DIR, "garden_mailbox_showcase.png")
showcase.save(showcase_out, "PNG", quality=95)
print(f"Showcase image saved to {showcase_out}")

# Build Animated GIF (1000x620)
gif_w = 1000
gif_h = 620
gif_frames = []

ordered_screens = [
    ("screen_1_garden_initial.png", "Step 1: Tap Mailbox Landmark", 1600),
    ("screen_2_fairy_walking.png", "Step 2: Fairy Navigates Across Garden", 2000),
    ("screen_3_fairy_retrieval.png", "Step 3: Mail Retrieval & Presentation Hold", 2200),
    ("screen_4_mailbox_reading.png", "Step 4: Transition into /mailbox Stationery", 2400),
    ("screen_5_returned_idle.png", "Step 5: Return to Garden · Idle at Mailbox", 2200),
]

durations = []
for filename, caption, duration in ordered_screens:
    p = os.path.join(FRAMES_DIR, filename)
    if os.path.exists(p):
        im = Image.open(p).convert("RGB")
        frame = im.resize((gif_w, gif_h), Image.Resampling.LANCZOS)
        fdraw = ImageDraw.Draw(frame)
        
        # Caption banner
        fdraw.rectangle([(0, gif_h - 48), (gif_w, gif_h)], fill=(20, 32, 25))
        fdraw.text((24, gif_h - 34), caption, fill=(245, 235, 215))
        
        gif_frames.append(frame)
        durations.append(duration)

if gif_frames:
    gif_out = os.path.join(ARTIFACT_DIR, "garden_mailbox_interaction.gif")
    gif_frames[0].save(
        gif_out,
        save_all=True,
        append_images=gif_frames[1:],
        duration=durations,
        loop=0,
        optimize=True,
    )
    print(f"Animated GIF saved to {gif_out}")
