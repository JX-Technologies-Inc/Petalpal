import { launchHeadlessChrome, createCDPClient } from './browserAutomation.mjs';
import fs from 'node:fs';
import path from 'node:path';

const FRAMES_DIR = 'test_animation_frames_unread';
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
  console.log('=== STARTING REFINED UNREAD/READ VISIBILITY VERIFICATION ===');
  const chromeProc = await launchHeadlessChrome();
  console.log('[1/6] Headless Chrome launched.');
  const cdp = await createCDPClient();
  console.log('[2/6] Connected to Chrome DevTools Protocol.');

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  // Navigate to mailbox route
  console.log('[3/6] Navigating to http://localhost:8081/mailbox ...');
  await cdp.send('Page.navigate', { url: 'http://localhost:8081/mailbox' });
  await new Promise((r) => setTimeout(r, 3000));

  // ── 1. AUDIT INITIAL STATE ──
  console.log('[4/6] Verifying Initial State: Mixed unread/read envelopes, NO Letter Guide, NO emojis...');
  const initialAudit = await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const textContent = document.body.innerText;
        const hasMeadowFairy = textContent.includes('Meadow Fairy');
        const hasGuideCard = textContent.includes('Letter Guide');
        const starElements = document.querySelectorAll('[aria-label="Unread letter magic sparkle"]');
        const budElements = Array.from(document.querySelectorAll('*')).filter(el => el.children.length === 0 && el.textContent === '🌱');
        const petalElements = Array.from(document.querySelectorAll('*')).filter(el => el.children.length === 0 && el.textContent === '🍂');

        return {
          hasMeadowFairy,
          hasGuideCard,
          starCount: starElements.length,
          budCount: budElements.length,
          petalCount: petalElements.length,
        };
      })()
    `,
    returnByValue: true,
  });
  console.log('  Initial DOM Audit:', initialAudit.result.result.value);

  // Capture Initial Reading View (mixed read/unread envelopes with no legend)
  await captureFrame(cdp, 'refined_initial_mixed_reading.png');
  console.log('  Captured refined_initial_mixed_reading.png');

  // ── 2. TEST OPENING UNREAD LETTER (Letter 1: Your Garden) ──
  console.log('[5/6] Clicking unread letter "Your Garden" to trigger deterministic read transition...');
  const clickResult = await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const buttons = Array.from(document.querySelectorAll('[role="button"]'));
        const gardenBtn = buttons.find(b => {
          const label = b.getAttribute('aria-label') || '';
          return label.includes('Your Garden') || label.includes('Your garden');
        });
        if (gardenBtn) {
          gardenBtn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
          gardenBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
          gardenBtn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
          gardenBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
          gardenBtn.click();
          return { clicked: true, label: gardenBtn.getAttribute('aria-label') };
        }
        return { clicked: false };
      })()
    `,
    returnByValue: true,
  });
  console.log('  Click Result:', clickResult.result.result.value);

  // Capture intermediate frames during opening choreography
  for (let i = 1; i <= 8; i++) {
    await new Promise((r) => setTimeout(r, 220));
    await captureFrame(cdp, `refined_transition_frame_${i}.png`);
  }

  // Wait for opening to complete and settle
  await new Promise((r) => setTimeout(r, 1200));
  await captureFrame(cdp, 'refined_letter1_opened.png');
  console.log('  Captured refined_letter1_opened.png');

  // Audit DOM after Letter 1 opened
  const postOpenAudit = await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const textContent = document.body.innerText;
        const hasGardenLetter = textContent.includes('Your Garden');
        const starElements = document.querySelectorAll('[aria-label="Unread letter magic sparkle"]');
        const hasGuideCard = textContent.includes('Letter Guide');

        return {
          hasGardenLetter,
          hasGuideCard,
          starCount: starElements.length,
        };
      })()
    `,
    returnByValue: true,
  });
  console.log('  Post-Open DOM Audit:', postOpenAudit.result.result.value);

  // ── 3. FOLD TO STACK MODE AUDIT ──
  console.log('[6/6] Toggling to Stack mode...');
  await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const stackBtn = btns.find(b => b.innerText && b.innerText.includes('Stack'));
        if (stackBtn) stackBtn.click();
      })()
    `,
  });
  await new Promise((r) => setTimeout(r, 1400));
  await captureFrame(cdp, 'refined_stack_mode_all_envelopes.png');
  console.log('  Captured refined_stack_mode_all_envelopes.png');

  // ── 4. MOBILE VIEWPORT TEST (iPhone 14: 390x844) ──
  console.log('  Testing Mobile Viewport (iPhone 14: 390x844)...');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });
  // Switch back to reading mode to inspect mobile reading layout
  await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const readBtn = btns.find(b => b.innerText && b.innerText.includes('Read'));
        if (readBtn) readBtn.click();
      })()
    `,
  });
  await new Promise((r) => setTimeout(r, 1600));
  await captureFrame(cdp, 'refined_mobile_iphone14.png');
  console.log('  Captured refined_mobile_iphone14.png');

  try {
    chromeProc.kill();
  } catch {}

  console.log('\n=== REFINED UNREAD/READ VISIBILITY VERIFICATION COMPLETED ===\n');
}

run().catch((err) => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
