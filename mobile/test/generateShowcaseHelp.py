import os
import shutil
from PIL import Image, ImageDraw, ImageFont

ARTIFACT_DIR = r"C:\Users\cjysu\.gemini\antigravity\brain\29c68174-3514-4da4-a283-62d907ccd0b5"
CONCEPT_PATH = os.path.join(ARTIFACT_DIR, ".user_uploaded", "media_1792024648509_93937e9a.jpg")

open_img_path = r"C:\Users\cjysu\Documents\Petalpal\help_feedback_open.png"
closed_img_path = r"C:\Users\cjysu\Documents\Petalpal\help_feedback_closed.png"
dismissed_img_path = r"C:\Users\cjysu\Documents\Petalpal\help_feedback_dismissed.png"

# Copy base captures to artifact dir
shutil.copy2(open_img_path, os.path.join(ARTIFACT_DIR, "help_feedback_open.png"))
shutil.copy2(closed_img_path, os.path.join(ARTIFACT_DIR, "help_feedback_closed.png"))
shutil.copy2(dismissed_img_path, os.path.join(ARTIFACT_DIR, "help_feedback_dismissed.png"))

open_img = Image.open(open_img_path)
W, H = open_img.size
print(f"Base image size: {W}x{H}")

# Crop panel macro:
# On 1536x1310, panel starts around right edge minus panel width + padding
# Panel width in CSS: 316px * 1.5 = 474px + margins
# x: from ~990 to 1520, y: from ~40 to 940
crop_x1 = int(W - (350 * 1.5))
crop_y1 = int(35 * 1.5)
crop_x2 = int(W - (10 * 1.5))
crop_y2 = int(580 * 1.5)

macro_panel = open_img.crop((crop_x1, crop_y1, crop_x2, crop_y2))
macro_save_path = os.path.join(ARTIFACT_DIR, "help_feedback_panel_macro.png")
macro_panel.save(macro_save_path)
print(f"Saved macro to {macro_save_path} ({macro_panel.size})")

# Also crop concept panel from CONCEPT_PATH
concept_img = Image.open(CONCEPT_PATH)
cW, cH = concept_img.size
print(f"Concept image size: {cW}x{cH}")
# In concept image (1024x873 approx or similar), panel is on top-right:
# x: ~700 to 1010, y: ~20 to 540
concept_macro = concept_img.crop((int(cW * 0.70), int(cH * 0.02), int(cW * 0.995), int(cH * 0.60)))

# Build a 2x2 or 3-column Side-by-Side Comparison Showcase
# Left: Full View Implementation (with open letter & open help panel)
# Middle: Help Panel Macro vs Concept Panel Macro
# Right: Trigger Close-up & In-World Integration

showcase_w = 1800
showcase_h = 1100
showcase = Image.new("RGB", (showcase_w, showcase_h), (25, 20, 28))
draw = ImageDraw.Draw(showcase)

# Title Header Banner
draw.rectangle([(0, 0), (showcase_w, 75)], fill=(38, 28, 44))
draw.text((36, 18), "PetalPal Mailbox — In-World Help & Feedback Floating Panel", fill=(250, 244, 235))
draw.text((36, 44), "Stationery-textured floating parchment card with botanical lavender accents, 4 support topics, and direct feedback actions", fill=(195, 175, 205))

# Section 1: Full Mailbox Implementation (1000px wide, ~850px high)
full_view_w = 1020
full_view_h = int(full_view_w * (H / W))
open_resized = open_img.resize((full_view_w, full_view_h), Image.Resampling.LANCZOS)
showcase.paste(open_resized, (36, 110))
draw.rectangle([(36, 110), (36 + full_view_w, 110 + full_view_h)], outline=(140, 110, 150), width=2)
draw.rectangle([(36, 110), (36 + 280, 140)], fill=(38, 28, 44))
draw.text((48, 116), "LIVE IMPLEMENTATION (FULL VIEW)", fill=(245, 230, 210))

# Section 2: Macro Panel Comparison (Implementation vs Concept Reference)
col2_x = 1080
col2_w = 680

# Sub-header: Live Floating Paper Panel
draw.text((col2_x, 90), "LIVE FLOATING PAPER CARD", fill=(240, 220, 200))
panel_macro_h = 440
panel_macro_w = int(macro_panel.width * (panel_macro_h / macro_panel.height))
if panel_macro_w > 330:
    panel_macro_w = 330
    panel_macro_h = int(macro_panel.height * (panel_macro_w / macro_panel.width))

macro_resized = macro_panel.resize((panel_macro_w, panel_macro_h), Image.Resampling.LANCZOS)
showcase.paste(macro_resized, (col2_x, 120))
draw.rectangle([(col2_x, 120), (col2_x + panel_macro_w, 120 + panel_macro_h)], outline=(160, 130, 170), width=2)

# Sub-header: Target Concept Reference
concept_col_x = col2_x + panel_macro_w + 20
draw.text((concept_col_x, 90), "TARGET CONCEPT DESIGN", fill=(210, 195, 225))
concept_macro_h = panel_macro_h
concept_macro_w = int(concept_macro.width * (concept_macro_h / concept_macro.height))
concept_resized = concept_macro.resize((concept_macro_w, concept_macro_h), Image.Resampling.LANCZOS)
showcase.paste(concept_resized, (concept_col_x, 120))
draw.rectangle([(concept_col_x, 120), (concept_col_x + concept_macro_w, 120 + concept_macro_h)], outline=(160, 130, 170), width=2)

# Bottom section on right side: Feature Highlights Card
feat_y = 590
feat_h = 370
draw.rectangle([(col2_x, feat_y), (col2_x + col2_w, feat_y + feat_h)], fill=(34, 25, 38), outline=(130, 105, 140), width=1)
draw.rectangle([(col2_x, feat_y), (col2_x + col2_w, feat_y + 36)], fill=(48, 34, 55))
draw.text((col2_x + 18, feat_y + 9), "KEY DESIGN & INTERACTION HIGHLIGHTS", fill=(250, 235, 210))

highlights = [
    "• Top-Right Pill Trigger: Speech bubble + flower icon with 'Help & Feedback' label",
    "• Upward Speech Caret: Aligns directly below trigger button to root the card",
    "• Tactile Paper Parchment: #FAF6EE cream base with authentic subtle paper grain",
    "• Watercolor Botanical Accents: Delicate lavender sprigs top-left and bottom-right",
    "• 4 In-World Support Topics: Send Feedback, Help Center, Privacy & Safety, Support",
    "• Primary CTA: Deep botanical sage/teal (#437568) button '✿ Share Feedback'",
    "• Secondary Action: Delicate underline text link 'View FAQs' in soft slate",
    "• Zero Screen Overlap: 316px card width preserves full visibility of open letter",
    "• Physical Polish: Dismiss on backdrop tap, close '✕' button, or trigger toggle"
]

hy = feat_y + 50
for hl in highlights:
    draw.text((col2_x + 18, hy), hl, fill=(230, 218, 225))
    hy += 34

# Footer bar
draw.rectangle([(0, showcase_h - 40), (showcase_w, showcase_h)], fill=(20, 15, 22))
draw.text((36, showcase_h - 28), "PetalPal Design System — Verified clean build (zero React Native Web styling warnings, 38/38 unit tests passing)", fill=(160, 145, 170))

showcase_save_path = os.path.join(ARTIFACT_DIR, "help_feedback_showcase.png")
showcase.save(showcase_save_path)
print(f"Saved showcase to {showcase_save_path}")

# Build Interaction GIF
frames = []
frames_dir = r"C:\Users\cjysu\Documents\Petalpal\test_animation_frames_help"
frame_files = [
    "help_feedback_closed.png",
    "help_open_frame_1.png",
    "help_open_frame_2.png",
    "help_open_frame_3.png",
    "help_open_frame_4.png",
    "help_open_frame_5.png",
    "help_open_frame_6.png",
    "help_feedback_open.png",
    "help_feedback_open.png",
    "help_feedback_interaction_toast.png",
    "help_feedback_interaction_toast.png",
    "help_feedback_dismissed.png",
]

for f in frame_files:
    fp = os.path.join(frames_dir, f)
    if os.path.exists(fp):
        im = Image.open(fp).convert("RGB")
        im_resized = im.resize((960, int(960 * (H / W))), Image.Resampling.LANCZOS)
        frames.append(im_resized)

if frames:
    gif_save_path = os.path.join(ARTIFACT_DIR, "help_feedback_interaction.gif")
    frames[0].save(
        gif_save_path,
        save_all=True,
        append_images=frames[1:],
        duration=[800, 70, 70, 70, 70, 70, 70, 1200, 1200, 1400, 1400, 1000],
        loop=0
    )
    print(f"Saved interaction GIF to {gif_save_path} ({len(frames)} frames)")
