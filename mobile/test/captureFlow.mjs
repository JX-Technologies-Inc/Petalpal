import { launchHeadlessChrome, createCDPClient } from './browserAutomation.mjs';
import fs from 'node:fs';

async function main() {
  const proc = await launchHeadlessChrome();
  const cdp = await createCDPClient();
  await cdp.send('Page.enable');
  await cdp.send('Page.navigate', { url: 'http://localhost:8081/mailbox' });
  await new Promise((r) => setTimeout(r, 2000));

  // 1. Initial Reading View
  let { result } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('snap_1_reading.png', Buffer.from(result.data, 'base64'));
  console.log('Saved snap_1_reading.png');

  // 2. Click Mode Toggle (top right Stack button)
  await cdp.send('Runtime.evaluate', {
    expression: `
      const btns = Array.from(document.querySelectorAll('[role="button"]'));
      const stackBtn = btns.find(b => b.innerText && b.innerText.includes('Stack'));
      if (stackBtn) stackBtn.click();
    `,
  });

  await new Promise((r) => setTimeout(r, 600));
  result = (await cdp.send('Page.captureScreenshot', { format: 'png' })).result;
  fs.writeFileSync('snap_2_stack.png', Buffer.from(result.data, 'base64'));
  console.log('Saved snap_2_stack.png');

  cdp.ws.close();
  proc.kill();
}

main().catch(console.error);
