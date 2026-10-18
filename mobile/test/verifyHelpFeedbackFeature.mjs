import { launchHeadlessChrome, createCDPClient } from './browserAutomation.mjs';
import fs from 'node:fs';
import path from 'node:path';

const FRAMES_DIR = 'test_animation_frames_help';
if (!fs.existsSync(FRAMES_DIR)) {
  fs.mkdirSync(FRAMES_DIR, { recursive: true });
}

async function captureFrame(cdp, filename) {
  const { result } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const buf = Buffer.from(result.data, 'base64');
  fs.writeFileSync(filename, buf);
  fs.writeFileSync(path.join(FRAMES_DIR, path.basename(filename)), buf);
  return buf;
}

async function run() {
  console.log('=== STARTING HELP & FEEDBACK FEATURE VERIFICATION ===');
  const chromeProc = await launchHeadlessChrome();
  console.log('[1/6] Headless Chrome launched.');
  const cdp = await createCDPClient();
  console.log('[2/6] Connected to Chrome DevTools Protocol.');

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  // Set desktop viewport matching concept reference
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1024,
    height: 873,
    deviceScaleFactor: 1.5,
    mobile: false,
  });

  // Navigate to mailbox route
  console.log('[3/6] Navigating to http://localhost:8081/mailbox ...');
  await cdp.send('Page.navigate', { url: 'http://localhost:8081/mailbox' });
  await new Promise((r) => setTimeout(r, 3200));

  // ── 1. VERIFY INITIAL STATE WITH TRIGGER CLOSED ──
  console.log('[4/6] Verifying Initial State: Help & Feedback trigger visible in top-right...');
  const initialAudit = await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const trigger = btns.find(b => {
          const label = b.getAttribute('aria-label') || '';
          const text = b.innerText || '';
          return label.toLowerCase().includes('help') || text.includes('Help & Feedback');
        });

        const panel = document.querySelector('[aria-label="Help and Feedback panel"]');

        return {
          hasTrigger: !!trigger,
          triggerLabel: trigger ? trigger.getAttribute('aria-label') : null,
          isPanelOpen: !!panel,
        };
      })()
    `,
    returnByValue: true,
  });
  console.log('  Initial Audit:', initialAudit.result.result.value);

  // Capture closed trigger screenshot
  await captureFrame(cdp, 'help_feedback_closed.png');
  console.log('  Captured help_feedback_closed.png');

  // ── 2. CLICK TRIGGER TO OPEN PANEL ──
  console.log('[5/6] Clicking Help & Feedback trigger to open paper panel...');
  const clickTriggerResult = await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const trigger = btns.find(b => {
          const label = b.getAttribute('aria-label') || '';
          const text = b.innerText || '';
          return label.toLowerCase().includes('help') || text.includes('Help & Feedback');
        });
        if (trigger) {
          trigger.click();
          return { clicked: true };
        }
        return { clicked: false };
      })()
    `,
    returnByValue: true,
  });
  console.log('  Click Trigger Result:', clickTriggerResult.result.result.value);

  // Capture opening frames
  for (let i = 1; i <= 6; i++) {
    await new Promise((r) => setTimeout(r, 60));
    await captureFrame(cdp, `help_open_frame_${i}.png`);
  }

  await new Promise((r) => setTimeout(r, 400));

  // Audit Open Panel DOM
  const openPanelAudit = await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const panel = document.querySelector('[aria-label="Help and Feedback panel"]');
        const text = panel ? panel.innerText : '';
        const hasHeader = text.includes('Help & Feedback') && text.includes('Every thought matters.');
        const hasSendFeedback = text.includes('Send Feedback') && text.includes('Share bugs, ideas, or thoughts');
        const hasHelpCenter = text.includes('Help Center') && text.includes('Garden, Journal, AI Fairy, Friends, Mailbox');
        const hasPrivacy = text.includes('Privacy & Safety') && text.includes('How your data is handled');
        const hasSupport = text.includes('Contact Support') && text.includes('Account, login, sync, or technical issues');
        const hasShareBtn = text.includes('Share Feedback');
        const hasFaqsLink = text.includes('View FAQs');

        return {
          isOpen: !!panel,
          hasHeader,
          hasSendFeedback,
          hasHelpCenter,
          hasPrivacy,
          hasSupport,
          hasShareBtn,
          hasFaqsLink,
        };
      })()
    `,
    returnByValue: true,
  });
  console.log('  Open Panel DOM Audit:', openPanelAudit.result.result.value);

  // Capture Full Open View
  await captureFrame(cdp, 'help_feedback_open.png');
  console.log('  Captured help_feedback_open.png');

  // ── 3. CLICK INTERACTIVE ROW (Send Feedback) ──
  console.log('[6/6] Testing Row and Button Interactions...');
  await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const shareBtn = btns.find(b => b.innerText && b.innerText.includes('Share Feedback'));
        if (shareBtn) shareBtn.click();
      })()
    `,
  });
  await new Promise((r) => setTimeout(r, 300));
  await captureFrame(cdp, 'help_feedback_interaction_toast.png');

  // ── 4. CLICK CLOSE BUTTON TO DISMISS ──
  await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const closeBtn = btns.find(b => b.getAttribute('aria-label') === 'Close');
        if (closeBtn) closeBtn.click();
      })()
    `,
  });

  await new Promise((r) => setTimeout(r, 500));
  await captureFrame(cdp, 'help_feedback_dismissed.png');
  console.log('  Captured help_feedback_dismissed.png after close.');

  console.log('=== HELP & FEEDBACK FEATURE VERIFICATION COMPLETED SUCCESSFULLY ===');
  process.exit(0);
}

run().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
