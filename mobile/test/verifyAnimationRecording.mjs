import { launchHeadlessChrome, createCDPClient } from './browserAutomation.mjs';
import fs from 'node:fs';
import path from 'node:path';

const FRAMES_DIR = 'test_animation_frames';
if (!fs.existsSync(FRAMES_DIR)) {
  fs.mkdirSync(FRAMES_DIR, { recursive: true });
}

async function captureFrame(cdp, filename) {
  const { result } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const buf = Buffer.from(result.data, 'base64');
  fs.writeFileSync(path.join(FRAMES_DIR, filename), buf);
  return buf;
}

async function run() {
  console.log('=== STARTING BROWSER ANIMATION VERIFICATION ===');
  const chromeProc = await launchHeadlessChrome();
  console.log('[1/7] Headless Chrome launched.');
  const cdp = await createCDPClient();
  console.log('[2/7] Connected to Chrome DevTools Protocol.');

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  // Navigate to mailbox route
  console.log('[3/7] Navigating to http://localhost:8081/mailbox ...');
  await cdp.send('Page.navigate', { url: 'http://localhost:8081/mailbox' });
  await new Promise((r) => setTimeout(r, 2500));

  // 1. Initial State: Close to stack first so we can verify the full 4-stage opening sequence from scratch
  console.log('[4/7] Folding into resting stack (State 1)...');
  await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const stackBtn = btns.find(b => b.innerText && b.innerText.includes('Stack'));
        if (stackBtn) {
          stackBtn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
          stackBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
          stackBtn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
          stackBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
          stackBtn.click();
        }
      })()
    `,
  });
  // Wait for closing animation to complete
  await new Promise((r) => setTimeout(r, 1400));
  await captureFrame(cdp, 'stage0_stack_resting.png');
  console.log('  Saved stage0_stack_resting.png');

  // ── TEST FLOW 1: OPENING SEQUENCE (Stages A, B, C, D) ──
  console.log('[5/7] Triggering Letter Opening from Stack...');
  await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const readBtn = btns.find(b => b.innerText && b.innerText.includes('Read'));
        if (readBtn) {
          readBtn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
          readBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
          readBtn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
          readBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
          readBtn.click();
        }
      })()
    `,
  });

  // Sample frames across Stage A (Lifting: ~260ms)
  await new Promise((r) => setTimeout(r, 150));
  await captureFrame(cdp, 'stageA_envelope_lifting.png');
  console.log('  Saved stageA_envelope_lifting.png (~150ms: envelope elevated)');

  // Sample frames across Stage B (Flap Opening: 260ms - 580ms)
  await new Promise((r) => setTimeout(r, 260));
  await captureFrame(cdp, 'stageB_flap_opening.png');
  console.log('  Saved stageB_flap_opening.png (~410ms: flap hinging backward)');

  // Sample frames across Stage C (Paper Extracting: 580ms - 960ms)
  await new Promise((r) => setTimeout(r, 340));
  await captureFrame(cdp, 'stageC_paper_extracting.png');
  console.log('  Saved stageC_paper_extracting.png (~750ms: paper sliding out of pocket)');

  // Sample frames across Stage D (Paper Unfolding: 960ms - 1420ms)
  await new Promise((r) => setTimeout(r, 400));
  await captureFrame(cdp, 'stageD_paper_unfolding.png');
  console.log('  Saved stageD_paper_unfolding.png (~1150ms: paper unfolding along creases)');

  // Settle (Reading: >1420ms)
  await new Promise((r) => setTimeout(r, 400));
  await captureFrame(cdp, 'reading_settled.png');
  console.log('  Saved reading_settled.png (~1550ms: reading letter settled)');

  // ── TEST FLOW 2: CLOSING REVERSE SEQUENCE ──
  console.log('[6/7] Triggering Letter Closing Reverse Sequence...');
  await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const foldBtn = btns.find(b => b.innerText && b.innerText.includes('Fold Mail'));
        if (foldBtn) {
          foldBtn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
          foldBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
          foldBtn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
          foldBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
          foldBtn.click();
        }
      })()
    `,
  });

  // Sample closing frames
  await new Promise((r) => setTimeout(r, 180));
  await captureFrame(cdp, 'close_1_folding.png');
  console.log('  Saved close_1_folding.png (~180ms: paper folding down)');

  await new Promise((r) => setTimeout(r, 320));
  await captureFrame(cdp, 'close_2_inserting.png');
  console.log('  Saved close_2_inserting.png (~500ms: paper sliding into pocket)');

  await new Promise((r) => setTimeout(r, 300));
  await captureFrame(cdp, 'close_3_flap_closing.png');
  console.log('  Saved close_3_flap_closing.png (~800ms: flap closing)');

  await new Promise((r) => setTimeout(r, 350));
  await captureFrame(cdp, 'close_4_stack_settled.png');
  console.log('  Saved close_4_stack_settled.png (~1150ms: envelope settled back in stack)');

  // ── TEST FLOW 3: SEAMLESS SWITCHING (A -> B) ──
  console.log('[7/7] Testing Letter Switching while in Reading Mode...');
  // Open 1st letter again
  await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const readBtn = btns.find(b => b.innerText && b.innerText.includes('Read'));
        if (readBtn) {
          readBtn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
          readBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
          readBtn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
          readBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
          readBtn.click();
        }
      })()
    `,
  });
  await new Promise((r) => setTimeout(r, 1600));

  // Now click a background envelope to switch
  await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const peekingEnvelopes = Array.from(document.querySelectorAll('[aria-label^="Envelope from"]'));
        if (peekingEnvelopes.length > 0) {
          const el = peekingEnvelopes[0];
          el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
          el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
          el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
          el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
          el.click();
        }
      })()
    `,
  });

  await new Promise((r) => setTimeout(r, 350));
  await captureFrame(cdp, 'switch_1_closing_a.png');
  console.log('  Saved switch_1_closing_a.png (Letter A folding/closing)');

  await new Promise((r) => setTimeout(r, 650));
  await captureFrame(cdp, 'switch_2_extracting_b.png');
  console.log('  Saved switch_2_extracting_b.png (Letter B emerging)');

  await new Promise((r) => setTimeout(r, 1400));
  await captureFrame(cdp, 'switch_3_settled_b.png');
  console.log('  Saved switch_3_settled_b.png (Letter B settled in reading view)');

  cdp.ws.close();
  chromeProc.kill();
  console.log('=== BROWSER VERIFICATION COMPLETE! ===');
}

run().catch((err) => {
  console.error('Error during verification:', err);
  process.exit(1);
});
