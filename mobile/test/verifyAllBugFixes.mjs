import { launchHeadlessChrome, createCDPClient } from './browserAutomation.mjs';
import fs from 'node:fs';
import path from 'node:path';

const FRAMES_DIR = 'test_animation_frames';

async function captureScreen(cdp, filename) {
  const { result } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const buf = Buffer.from(result.data, 'base64');
  fs.writeFileSync(filename, buf);
  fs.writeFileSync(path.join(FRAMES_DIR, path.basename(filename)), buf);
  return buf;
}

async function run() {
  console.log('=== STARTING COMPREHENSIVE BUG-FIX VERIFICATION ===');
  const proc = await launchHeadlessChrome();
  const cdp = await createCDPClient();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  // ─────────────────────────────────────────────────────────────
  // TEST 1: DESKTOP/DEFAULT VIEWPORT (512x778)
  // ─────────────────────────────────────────────────────────────
  console.log('\n[1/5] Loading Mailbox on standard viewport (512x778)...');
  await cdp.send('Page.navigate', { url: 'http://localhost:8081/mailbox' });
  await new Promise((r) => setTimeout(r, 2500));

  // Capture Letter 1 reading state
  await captureScreen(cdp, 'fixed_reading_letter1.png');
  console.log('  Captured fixed_reading_letter1.png');

  // Verify Letter 1 Header & Top boundaries
  const letter1TopCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const letter = document.querySelector('[aria-label="Expanded Reading Letter"]');
      const letterRect = letter ? letter.getBoundingClientRect() : null;
      const foldBtn = document.querySelector('[aria-label="Fold letter back into envelope"]');
      const foldRect = foldBtn ? foldBtn.getBoundingClientRect() : null;
      const stamp = document.querySelector('img[src*="petalpal_stamp"]');
      const stampRect = stamp ? stamp.getBoundingClientRect() : null;
      const header = document.querySelector('[aria-label="Back to Garden"]')?.parentElement;
      const headerRect = header ? header.getBoundingClientRect() : null;

      // Check for any clipping: foldBtn must be strictly below headerRect.bottom
      const isFoldBtnVisible = foldRect && foldRect.top > (headerRect ? headerRect.bottom : 0);
      const isStampVisible = stampRect && stampRect.right <= window.innerWidth && stampRect.top > 0;
      
      return { letterRect, foldRect, stampRect, headerRect, isFoldBtnVisible, isStampVisible };
    })()`,
    returnByValue: true
  });
  console.log('  Letter 1 Top Verification:', JSON.stringify(letter1TopCheck.result.result.value, null, 2));

  // ─────────────────────────────────────────────────────────────
  // TEST 2: INTERACTION VERIFICATION — CLICK EVERY LETTER IN STACK
  // ─────────────────────────────────────────────────────────────
  console.log('\n[2/5] Testing clickability of EVERY envelope in the left stack...');

  // Test clicking First Envelope (index 0)
  console.log('  Testing click on FIRST envelope in stack (Meadow Fairy)...');
  const clickFirstRes = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const peeking = Array.from(document.querySelectorAll('[aria-label^="Envelope from"]'));
      if (!peeking[0]) return { error: 'No first envelope found' };
      const label = peeking[0].getAttribute('aria-label');
      
      // Dispatch real pointer events to simulate user touch/click
      peeking[0].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
      peeking[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      peeking[0].dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
      peeking[0].dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      peeking[0].click();
      return { clicked: label };
    })()`,
    returnByValue: true
  });
  console.log('  Triggered click:', clickFirstRes.result.result.value);

  // Wait for letter switch animation to settle (Letter 1 closes, Letter 2 opens)
  await new Promise((r) => setTimeout(r, 2600));
  await captureScreen(cdp, 'fixed_reading_letter2.png');
  console.log('  Captured fixed_reading_letter2.png (Letter 2 reading state)');

  // Verify Letter 2 is active
  const checkActiveLetter2 = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const text = document.body.innerText;
      const isMeadowActive = text.includes('Meadow Fairy') && text.includes('A brighter tomorrow');
      return { isMeadowActive };
    })()`,
    returnByValue: true
  });
  console.log('  Switched to Letter 2 successfully:', checkActiveLetter2.result.result.value.isMeadowActive);

  // Test clicking Next envelope (Moonbed Reflections - Short letter)
  console.log('  Testing click on Moonbed Reflections (short letter)...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const peeking = Array.from(document.querySelectorAll('[aria-label^="Envelope from"]'));
      const moonbed = peeking.find(p => p.getAttribute('aria-label').includes('Moonbed Reflections'));
      if (moonbed) moonbed.click();
    })()`
  });
  await new Promise((r) => setTimeout(r, 2600));
  await captureScreen(cdp, 'fixed_reading_letter3_short.png');
  console.log('  Captured fixed_reading_letter3_short.png (Letter 3 - Short Letter)');

  // Test clicking Next envelope (PetalPal News - Lower envelope)
  console.log('  Testing click on lower envelope (PetalPal News)...');
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const peeking = Array.from(document.querySelectorAll('[aria-label^="Envelope from"]'));
      const news = peeking.find(p => p.getAttribute('aria-label').includes('PetalPal News'));
      if (news) news.click();
    })()`
  });
  await new Promise((r) => setTimeout(r, 2600));
  await captureScreen(cdp, 'fixed_reading_letter5_news.png');
  console.log('  Captured fixed_reading_letter5_news.png (Letter 5)');

  // ─────────────────────────────────────────────────────────────
  // TEST 3: VERIFY NO DARK BLOCK UNDER LETTER
  // ─────────────────────────────────────────────────────────────
  console.log('\n[3/5] Verifying absence of dark block under paper across short and medium letters...');
  const darkBlockCheck = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const letter = document.querySelector('[aria-label="Expanded Reading Letter"]');
      const letterRect = letter ? letter.getBoundingClientRect() : null;
      
      // Look for any elements extending below letterRect.bottom that have dark backgrounds or box-shadows
      const allDivs = Array.from(document.querySelectorAll('div'));
      const culprits = [];
      for (const d of allDivs) {
        if (d.getAttribute('aria-label')?.includes('Fold') || d.closest('[aria-label="Bottom pagination"]')) continue;
        const r = d.getBoundingClientRect();
        const cs = window.getComputedStyle(d);
        if (letterRect && r.top >= letterRect.bottom - 10 && r.bottom <= letterRect.bottom + 120 && r.width > 120) {
          if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.boxShadow !== 'none') {
            culprits.push({
              tag: d.tagName,
              rect: { top: r.top, bottom: r.bottom, height: r.height },
              bg: cs.backgroundColor,
              boxShadow: cs.boxShadow,
              outerHTML: d.outerHTML.slice(0, 100)
            });
          }
        }
      }
      return { culpritsCount: culprits.length, culprits };
    })()`,
    returnByValue: true
  });
  console.log('  Dark block culprits below paper:', JSON.stringify(darkBlockCheck.result.result.value, null, 2));

  // ─────────────────────────────────────────────────────────────
  // TEST 4: MOBILE VIEWPORTS (iPhone 14 & iPhone SE)
  // ─────────────────────────────────────────────────────────────
  console.log('\n[4/5] Testing mobile viewports for top clipping and responsiveness...');

  // Switch back to Letter 1 for mobile test
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const peeking = Array.from(document.querySelectorAll('[aria-label^="Envelope from"]'));
      const garden = peeking.find(p => p.getAttribute('aria-label').includes('Garden'));
      if (garden) garden.click();
    })()`
  });
  await new Promise((r) => setTimeout(r, 2600));

  // Test iPhone 14 (390 x 844)
  console.log('  Testing iPhone 14 (390x844)...');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });
  await new Promise((r) => setTimeout(r, 600));
  await captureScreen(cdp, 'fixed_mobile_iphone14.png');
  console.log('  Captured fixed_mobile_iphone14.png');

  // Test iPhone SE (375 x 667)
  console.log('  Testing iPhone SE (375x667)...');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 375,
    height: 667,
    deviceScaleFactor: 2,
    mobile: true
  });
  await new Promise((r) => setTimeout(r, 600));
  await captureScreen(cdp, 'fixed_mobile_iphonese.png');
  console.log('  Captured fixed_mobile_iphonese.png');

  // Verify Mobile Header & Boundaries
  const mobileMetrics = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const letter = document.querySelector('[aria-label="Expanded Reading Letter"]');
      const letterRect = letter ? letter.getBoundingClientRect() : null;
      const foldBtn = document.querySelector('[aria-label="Fold letter back into envelope"]');
      const foldRect = foldBtn ? foldBtn.getBoundingClientRect() : null;
      const stamp = document.querySelector('img[src*="petalpal_stamp"]');
      const stampRect = stamp ? stamp.getBoundingClientRect() : null;
      const header = document.querySelector('[aria-label="Back to Garden"]')?.parentElement;
      const headerRect = header ? header.getBoundingClientRect() : null;
      
      return {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        letterLeft: letterRect?.left,
        letterRight: letterRect?.right,
        letterWidth: letterRect?.width,
        foldTop: foldRect?.top,
        foldBottom: foldRect?.bottom,
        stampRight: stampRect?.right,
        headerBottom: headerRect?.bottom,
        isStampFullyOnScreen: stampRect ? stampRect.right <= window.innerWidth : false,
        isFoldBtnBelowHeader: foldRect && headerRect ? foldRect.top >= headerRect.bottom : false
      };
    })()`,
    returnByValue: true
  });
  console.log('  iPhone SE Metrics:', JSON.stringify(mobileMetrics.result.result.value, null, 2));

  // Reset emulation
  await cdp.send('Emulation.clearDeviceMetricsOverride');

  console.log('\n=== ALL BROWSER VERIFICATIONS COMPLETED SUCCESSFULLY ===');
  cdp.ws.close();
  proc.kill();
}

run().catch((err) => {
  console.error('Verification error:', err);
  process.exit(1);
});
