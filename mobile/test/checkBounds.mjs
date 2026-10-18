import { launchHeadlessChrome, createCDPClient } from './browserAutomation.mjs';

async function main() {
  const chromeProc = await launchHeadlessChrome();
  const cdp = await createCDPClient();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Page.navigate', { url: 'http://localhost:8081/fairy-loading-test' });
  await new Promise((r) => setTimeout(r, 3000));

  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 600,
    height: 960,
    deviceScaleFactor: 1,
    mobile: false,
  });

  await cdp.send('Runtime.evaluate', { expression: 'window.__SEEK_FAIRY(16500);' });
  await new Promise((r) => setTimeout(r, 400));

  const res = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const p3 = document.querySelector('[data-testid="fairy-pose-03-container"]');
      const card = document.querySelector('[data-testid="loading-invitation-card"]');
      const r = p3 ? p3.getBoundingClientRect() : null;
      const cr = card ? card.getBoundingClientRect() : null;
      return { p3Rect: r, cardRect: cr, windowWidth: window.innerWidth };
    })()`,
    returnByValue: true,
  });

  console.log('DOM bounds at width 600:', res.result.result.value);

  // Take screenshot at width 600
  const { result } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const fs = await import('node:fs');
  fs.writeFileSync('C:/Users/cjysu/.gemini/antigravity/brain/079854b1-4128-4356-9182-9fbbd80c86b5/test_width600_p3.png', Buffer.from(result.data, 'base64'));

  cdp.ws.close();
  chromeProc.kill();
}

main().catch(console.error);
