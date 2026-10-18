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
  fs.writeFileSync(filename, buf);
  fs.writeFileSync(path.join(FRAMES_DIR, path.basename(filename)), buf);
  return buf;
}

async function run() {
  console.log('=== STARTING PHYSICAL POCKET LAYERING VERIFICATION ===');
  const chromeProc = await launchHeadlessChrome();
  console.log('[1/6] Headless Chrome launched.');
  const cdp = await createCDPClient();
  console.log('[2/6] Connected to Chrome DevTools Protocol.');

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  // Navigate to mailbox route
  console.log('[3/6] Navigating to http://localhost:8081/mailbox ...');
  await cdp.send('Page.navigate', { url: 'http://localhost:8081/mailbox' });
  await new Promise((r) => setTimeout(r, 2500));

  // Step 1: Fold to stack first so we can verify the full opening sequence from scratch
  console.log('[4/6] Folding into resting stack (State 1)...');
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
  await captureFrame(cdp, 'layering_1_resting_stack.png');
  console.log('  Captured layering_1_resting_stack.png');

  // Verify initial z-index / layer structure in DOM
  const layerAudit = await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const back = document.querySelector('[class*="envelopeBackWrapper"]');
        const front = document.querySelector('[class*="activeEnvelopeFrontWrapper"]');
        const flap = document.querySelector('[class*="flapPivotContainer"]');
        const paper = document.querySelector('[class*="paperSheetMotionWrapper"]');

        const getZ = el => el ? window.getComputedStyle(el).zIndex : null;
        return {
          backZ: getZ(back),
          frontZ: getZ(front),
          flapZ: getZ(flap),
          paperZ: getZ(paper),
        };
      })()
    `,
    returnByValue: true,
  });
  console.log('  Initial Layer z-index check:', layerAudit.result.result.value);

  // ── RECORDING OPENING SEQUENCE ──
  console.log('[5/6] Triggering Letter Opening & Recording Stages...');
  
  // Trigger open
  await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const readBtn = btns.find(b => b.innerText && b.innerText.includes('Read'));
        if (readBtn) readBtn.click();
      })()
    `,
  });

  // Stage A/B: Flap opening (~280ms) - Paper sitting partially inside envelope
  await new Promise((r) => setTimeout(r, 300));
  await captureFrame(cdp, 'layering_2_flap_open_paper_inside.png');
  console.log('  Captured layering_2_flap_open_paper_inside.png (Paper nestled inside pocket)');

  // Verify that paper is between back and front
  const insideCheck = await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const back = document.querySelector('[class*="envelopeBackWrapper"]');
        const front = document.querySelector('[class*="activeEnvelopeFrontWrapper"]');
        const paper = document.querySelector('[class*="paperSheetMotionWrapper"]');

        const backRect = back ? back.getBoundingClientRect() : null;
        const frontRect = front ? front.getBoundingClientRect() : null;
        const paperRect = paper ? paper.getBoundingClientRect() : null;

        // Front pocket should occlude bottom of paper: paper bottom > front top
        const isPaperInsidePocket = paperRect && frontRect && paperRect.bottom > frontRect.top + 30;
        return {
          paperTop: paperRect?.top,
          paperBottom: paperRect?.bottom,
          frontTop: frontRect?.top,
          frontBottom: frontRect?.bottom,
          isPaperInsidePocket,
        };
      })()
    `,
    returnByValue: true,
  });
  console.log('  Inside Pocket Check:', insideCheck.result.result.value);

  // Stage C: Extracting (~540ms) - Paper sliding UPWARD out of pocket
  await new Promise((r) => setTimeout(r, 260));
  await captureFrame(cdp, 'layering_3_opening_extracting.png');
  console.log('  Captured layering_3_opening_extracting.png (Paper emerging from pocket)');

  // Stage D: Unfolding (~880ms)
  await new Promise((r) => setTimeout(r, 340));
  await captureFrame(cdp, 'layering_4_unfolding.png');
  console.log('  Captured layering_4_unfolding.png (Paper unfolding)');

  // Settled Reading State (~1400ms)
  await new Promise((r) => setTimeout(r, 520));
  await captureFrame(cdp, 'layering_5_reading_settled.png');
  console.log('  Captured layering_5_reading_settled.png (Reading state settled)');

  // ── RECORDING CLOSING SEQUENCE ──
  console.log('[6/6] Triggering Letter Closing & Recording Pocket Return...');

  // Click Fold Mail
  await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const foldBtn = document.querySelector('[aria-label="Fold letter back into envelope"]');
        if (foldBtn) foldBtn.click();
      })()
    `,
  });

  // Step 1: Paper folding down to pocket width (~260ms)
  await new Promise((r) => setTimeout(r, 260));
  await captureFrame(cdp, 'layering_6_closing_fold.png');
  console.log('  Captured layering_6_closing_fold.png (Paper folded above envelope)');

  // Step 2: Paper inserting down INTO envelope pocket (~540ms)
  await new Promise((r) => setTimeout(r, 280));
  await captureFrame(cdp, 'layering_7_closing_inserting.png');
  console.log('  Captured layering_7_closing_inserting.png (Paper visibly entering inside pocket)');

  // Verify that paper is occluded by front pocket during insertion
  const insertCheck = await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const front = document.querySelector('[class*="activeEnvelopeFrontWrapper"]');
        const paper = document.querySelector('[class*="paperSheetMotionWrapper"]');

        const frontRect = front ? front.getBoundingClientRect() : null;
        const paperRect = paper ? paper.getBoundingClientRect() : null;

        const isPaperEnteringPocket = paperRect && frontRect && paperRect.bottom > frontRect.top + 20;
        return {
          paperTop: paperRect?.top,
          paperBottom: paperRect?.bottom,
          frontTop: frontRect?.top,
          frontBottom: frontRect?.bottom,
          isPaperEnteringPocket,
        };
      })()
    `,
    returnByValue: true,
  });
  console.log('  Inserting Pocket Check:', insertCheck.result.result.value);

  // Step 3: Flap closing over opening (~800ms)
  await new Promise((r) => setTimeout(r, 260));
  await captureFrame(cdp, 'layering_8_closing_flap.png');
  console.log('  Captured layering_8_closing_flap.png (Flap closing over envelope mouth)');

  // Step 4: Settled in stack (~1150ms)
  await new Promise((r) => setTimeout(r, 350));
  await captureFrame(cdp, 'layering_9_stack_settled.png');
  console.log('  Captured layering_9_stack_settled.png (Settled in resting stack)');

  cdp.ws.close();
  chromeProc.kill();
  console.log('\n=== PHYSICAL POCKET LAYERING VERIFICATION COMPLETED ===');
}

run().catch((err) => {
  console.error('Layering verification error:', err);
  process.exit(1);
});
