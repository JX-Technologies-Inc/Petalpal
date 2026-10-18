import { launchHeadlessChrome, createCDPClient } from './browserAutomation.mjs';
import fs from 'node:fs';

async function testViewport(width, height, name) {
  const proc = await launchHeadlessChrome();
  const cdp = await createCDPClient();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 2,
    mobile: true
  });
  await cdp.send('Page.navigate', { url: 'http://localhost:8081/mailbox' });
  await new Promise((r) => setTimeout(r, 2000));

  const { result } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`test_mobile_${name}.png`, Buffer.from(result.data, 'base64'));
  console.log(`Saved test_mobile_${name}.png`);

  const metrics = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const letter = document.querySelector('[aria-label="Expanded Reading Letter"]');
      const letterRect = letter ? letter.getBoundingClientRect() : null;
      const header = document.querySelector('[aria-label="Back to Garden"]')?.parentElement;
      const headerRect = header ? header.getBoundingClientRect() : null;
      const title = Array.from(document.querySelectorAll('*')).find(e => e.innerText && e.innerText.includes('A Note from Your Garden'));
      const titleRect = title ? title.getBoundingClientRect() : null;
      return { letterRect, headerRect, titleRect, windowHeight: window.innerHeight };
    })()`,
    returnByValue: true
  });
  console.log(`Metrics for ${name}:`, JSON.stringify(metrics.result.result.value, null, 2));

  cdp.ws.close();
  proc.kill();
}

async function main() {
  await testViewport(390, 844, 'iphone14');
  await testViewport(375, 667, 'iphonese');
}

main().catch(console.error);
