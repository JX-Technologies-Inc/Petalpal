import { launchHeadlessChrome, createCDPClient } from './browserAutomation.mjs';
import fs from 'node:fs';

async function main() {
  const proc = await launchHeadlessChrome();
  const cdp = await createCDPClient();
  await cdp.send('Page.navigate', { url: 'http://localhost:8081/mailbox' });
  await new Promise((r) => setTimeout(r, 2000));

  // 1. Fold to stack
  await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const stackBtn = btns.find(b => b.innerText && b.innerText.includes('Stack'));
        if (stackBtn) {
          stackBtn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
          stackBtn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
          stackBtn.click();
        }
      })()
    `,
  });
  await new Promise((r) => setTimeout(r, 1400));

  // 2. Click Read button
  await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const readBtn = btns.find(b => b.innerText && b.innerText.includes('Read'));
        if (readBtn) {
          readBtn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
          readBtn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
          readBtn.click();
        }
      })()
    `,
  });

  // Wait 680ms (right in the middle of Stage C extracting: 580ms - 960ms!)
  await new Promise((r) => setTimeout(r, 680));
  const { result } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('test_animation_frames/stageC_exact_extracting.png', Buffer.from(result.data, 'base64'));
  console.log('Saved stageC_exact_extracting.png!');

  cdp.ws.close();
  proc.kill();
}

main().catch(console.error);
