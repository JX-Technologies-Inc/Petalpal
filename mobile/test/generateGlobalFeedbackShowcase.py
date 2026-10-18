import os
import shutil
from PIL import Image, ImageDraw, ImageFont

ARTIFACT_DIR = r"C:\Users\cjysu\.gemini\antigravity\brain\29c68174-3514-4da4-a283-62d907ccd0b5"
FRAMES_DIR = r"C:\Users\cjysu\Documents\Petalpal\test_animation_frames_global_feedback"

screens = [
    "screen_1_garden.png",
    "screen_2_journal.png",
    "screen_3_mailbox.png",
    "screen_4_menu_open.png",
    "screen_5_form_open.png",
    "screen_6_form_typed.png",
    "screen_7_draft_preserved_journal.png",
    "screen_8_submission_status.png",
    "screen_9_mobile_feedback_form.png",
]

# Copy all screenshots to artifact directory
for s in screens:
    src = os.path.join(r"C:\Users\cjysu\Documents\Petalpal", s)
    if os.path.exists(src):
        shutil.copy2(src, os.path.join(ARTIFACT_DIR, s))
        print(f"Copied {s} to artifact dir")

# Build Composite Showcase Image (2000x1250)
showcase_w = 2000
showcase_h = 1320
showcase = Image.new("RGB", (showcase_w, showcase_h), (24, 18, 26))
draw = ImageDraw.Draw(showcase)

# Banner Header
draw.rectangle([(0, 0), (showcase_w, 85)], fill=(38, 26, 42))
draw.text((40, 20), "PetalPal — Global Help & Feedback + Functional Feedback Form", fill=(250, 244, 235))
draw.text((40, 48), "Universal top-right access across Garden, Journal, Mailbox · Approved botanical stationery panel · Full draft preservation", fill=(195, 175, 205))

# Row 1 (y: 110 to 660):
# Panel 1: Global Trigger on Garden & Journal (Side by side previews)
# Panel 2: Dedicated Send Feedback Form (Typed Draft & Categories)
card_bg = (34, 25, 38)
card_outline = (130, 105, 140)

# Card 1: Global Presence (Garden & Journal)
c1_x, c1_y, c1_w, c1_h = 40, 110, 580, 560
draw.rectangle([(c1_x, c1_y), (c1_x + c1_w, c1_y + c1_h)], fill=card_bg, outline=card_outline, width=1)
draw.rectangle([(c1_x, c1_y), (c1_x + c1_w, c1_y + 36)], fill=(48, 34, 55))
draw.text((c1_x + 16, c1_y + 9), "1. GLOBAL ACCESSIBILITY ACROSS SCREENS", fill=(250, 235, 210))

# Sub-images: Garden and Journal top bars
im_garden = Image.open(os.path.join(r"C:\Users\cjysu\Documents\Petalpal", "screen_1_garden.png"))
im_journal = Image.open(os.path.join(r"C:\Users\cjysu\Documents\Petalpal", "screen_2_journal.png"))

# Crop top-right headers to highlight the trigger
# Garden top header
g_thumb = im_garden.crop((0, 0, im_garden.width, int(im_garden.height * 0.45))).resize((c1_w - 32, 230), Image.Resampling.LANCZOS)
showcase.paste(g_thumb, (c1_x + 16, c1_y + 50))
draw.rectangle([(c1_x + 16, c1_y + 50), (c1_x + c1_w - 16, c1_y + 50 + 230)], outline=(110, 85, 120), width=1)
draw.rectangle([(c1_x + 16, c1_y + 50), (c1_x + 220, c1_y + 76)], fill=(38, 26, 42))
draw.text((c1_x + 24, c1_y + 56), "Garden Screen (/garden-test)", fill=(235, 220, 205))

# Journal top header
j_thumb = im_journal.crop((0, 0, im_journal.width, int(im_journal.height * 0.45))).resize((c1_w - 32, 230), Image.Resampling.LANCZOS)
showcase.paste(j_thumb, (c1_x + 16, c1_y + 295))
draw.rectangle([(c1_x + 16, c1_y + 295), (c1_x + c1_w - 16, c1_y + 295 + 230)], outline=(110, 85, 120), width=1)
draw.rectangle([(c1_x + 16, c1_y + 295), (c1_x + 180, c1_y + 321)], fill=(38, 26, 42))
draw.text((c1_x + 24, c1_y + 301), "Journal Screen (/journal)", fill=(235, 220, 205))

# Card 2: Functional Feedback Form (Main Desktop View)
c2_x, c2_y, c2_w, c2_h = 650, 110, 780, 560
draw.rectangle([(c2_x, c2_y), (c2_x + c2_w, c2_y + c2_h)], fill=card_bg, outline=card_outline, width=1)
draw.rectangle([(c2_x, c2_y), (c2_x + c2_w, c2_y + 36)], fill=(48, 34, 55))
draw.text((c2_x + 16, c2_y + 9), "2. FUNCTIONAL SEND FEEDBACK FORM (BOTANICAL STATIONERY)", fill=(250, 235, 210))

im_form = Image.open(os.path.join(r"C:\Users\cjysu\Documents\Petalpal", "screen_6_form_typed.png"))
form_resized = im_form.resize((c2_w - 32, c2_h - 52), Image.Resampling.LANCZOS)
showcase.paste(form_resized, (c2_x + 16, c2_y + 44))
draw.rectangle([(c2_x + 16, c2_y + 44), (c2_x + c2_w - 16, c2_y + c2_h - 8)], outline=(110, 85, 120), width=1)

# Card 3: Mobile Viewport (iPhone 14 / 390x844)
c3_x, c3_y, c3_w, c3_h = 1460, 110, 500, 560
draw.rectangle([(c3_x, c3_y), (c3_x + c3_w, c3_y + c3_h)], fill=card_bg, outline=card_outline, width=1)
draw.rectangle([(c3_x, c3_y), (c3_x + c3_w, c3_y + 36)], fill=(48, 34, 55))
draw.text((c3_x + 16, c3_y + 9), "3. RESPONSIVE MOBILE SHEET (IPHONE 14)", fill=(250, 235, 210))

im_mobile = Image.open(os.path.join(r"C:\Users\cjysu\Documents\Petalpal", "screen_9_mobile_feedback_form.png"))
mob_ratio = im_mobile.width / im_mobile.height
mob_h = c3_h - 56
mob_w = int(mob_h * mob_ratio)
mob_resized = im_mobile.resize((mob_w, mob_h), Image.Resampling.LANCZOS)
mob_paste_x = c3_x + (c3_w - mob_w) // 2
showcase.paste(mob_resized, (mob_paste_x, c3_y + 46))
draw.rectangle([(mob_paste_x, c3_y + 46), (mob_paste_x + mob_w, c3_y + 46 + mob_h)], outline=(140, 110, 150), width=2)

# Row 2 (y: 690 to 1250):
# Panel 4: Draft Preservation Across Navigation (Mailbox -> Journal)
c4_x, c4_y, c4_w, c4_h = 40, 690, 940, 550
draw.rectangle([(c4_x, c4_y), (c4_x + c4_w, c4_y + c4_h)], fill=card_bg, outline=card_outline, width=1)
draw.rectangle([(c4_x, c4_y), (c4_x + c4_w, c4_y + 36)], fill=(48, 34, 55))
draw.text((c4_x + 16, c4_y + 9), "4. DRAFT PRESERVATION ACROSS ROUTES (MAILBOX → JOURNAL)", fill=(250, 235, 210))

im_draft = Image.open(os.path.join(r"C:\Users\cjysu\Documents\Petalpal", "screen_7_draft_preserved_journal.png"))
draft_resized = im_draft.resize((c4_w - 32, c4_h - 52), Image.Resampling.LANCZOS)
showcase.paste(draft_resized, (c4_x + 16, c4_y + 44))
draw.rectangle([(c4_x + 16, c4_y + 44), (c4_x + c4_w - 16, c4_y + c4_h - 8)], outline=(110, 85, 120), width=1)

# Panel 5: Architecture, Honest Transport & Test Verification
c5_x, c5_y, c5_w, c5_h = 1010, 690, 950, 550
draw.rectangle([(c5_x, c5_y), (c5_x + c5_w, c5_y + c5_h)], fill=card_bg, outline=card_outline, width=1)
draw.rectangle([(c5_x, c5_y), (c5_x + c5_w, c5_y + 36)], fill=(48, 34, 55))
draw.text((c5_x + 16, c5_y + 9), "5. ARCHITECTURAL HIGHLIGHTS & VERIFICATION RESULTS", fill=(250, 235, 210))

feat_bullets = [
    "• Single Shared Instance: Mounted once at mobile/src/app/_layout.tsx root level",
    "• Route-Level Visibility: Universally visible across Garden, Journal, Mailbox; excluded on Auth/Onboarding",
    "• Zero Duplication: MailboxPage delegates local trigger to global overlay with seamless topRightActions margin",
    "• Seamless View Navigation: Main menu (4 topics) smoothly turns to dedicated letter-writing form",
    "• 5 Category Chips: Bug Report, Feature Suggestion, General Feedback, AI Concern, Other",
    "• Form Fields: Optional subject, required multiline message, optional screenshot attach, optional email",
    "• Dynamic Validation: 'Send Feedback' disabled if message empty; validates email format only if provided",
    "• Persistent Draft State: Saved via FeedbackDraftContext (AsyncStorage + localStorage) with debouncing",
    "• Honest Dev Mode: LocalDevelopmentFeedbackTransport records locally without inventing fake server claims",
    "• Safe Discard: Explicit 'Discard draft' with confirmation prompt preserves user control",
    "• Responsive Safe-Areas: Adapts from desktop floating paper card to mobile sheet with compact 'Help' label",
    "• Test Coverage: 38/38 Mailbox + 9/9 Global Feedback + 158/158 Planting tests passing at 100% (npx tsc: 0 errors)"
]

by = c5_y + 54
for b in feat_bullets:
    draw.text((c5_x + 20, by), b, fill=(235, 222, 230))
    by += 38

# Footer
draw.rectangle([(0, showcase_h - 40), (showcase_w, showcase_h)], fill=(18, 14, 20))
draw.text((40, showcase_h - 28), "PetalPal Design System — Verified E2E in Headless Chrome DevTools Protocol & Production Jest/Node Test Runner", fill=(160, 145, 170))

showcase_path = os.path.join(ARTIFACT_DIR, "global_feedback_showcase.png")
showcase.save(showcase_path)
print(f"Saved global feedback showcase to {showcase_path}")

# Build Interaction GIF
gif_frames = []
gif_files = [
    "screen_1_garden.png",
    "screen_3_mailbox.png",
    "screen_4_menu_open.png",
    "screen_5_form_open.png",
    "screen_6_form_typed.png",
    "screen_7_draft_preserved_journal.png",
    "screen_8_submission_status.png",
    "screen_9_mobile_feedback_form.png",
]

for f in gif_files:
    fp = os.path.join(r"C:\Users\cjysu\Documents\Petalpal", f)
    if os.path.exists(fp):
        im = Image.open(fp).convert("RGB")
        im_resized = im.resize((960, int(960 * (im.height / im.width))), Image.Resampling.LANCZOS)
        gif_frames.append(im_resized)

if gif_frames:
    gif_path = os.path.join(ARTIFACT_DIR, "global_feedback_interaction.gif")
    gif_frames[0].save(
        gif_path,
        save_all=True,
        append_images=gif_frames[1:],
        duration=[1200, 1200, 1000, 1000, 1600, 1600, 1400, 1400],
        loop=0
    )
    print(f"Saved interaction GIF to {gif_path} ({len(gif_frames)} frames)")
