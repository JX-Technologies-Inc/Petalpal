import { launchHeadlessChrome, createCDPClient } from '../test/browserAutomation.mjs';

async function run() {
  const chromeProc = await launchHeadlessChrome();
  try {
    const cdp = await createCDPClient();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Page.navigate', { url: 'http://localhost:8081/player-preview' });
    await new Promise(r => setTimeout(r, 4000));

    // Expose a helper or inspect camera values
    const debugInfo = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        // Find canvas size and container size
        const canvas = document.querySelector('canvas');
        const container = canvas ? canvas.parentElement : null;
        const rect = canvas ? canvas.getBoundingClientRect() : null;
        return {
          windowInnerWidth: window.innerWidth,
          windowInnerHeight: window.innerHeight,
          canvasRect: rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : null
        };
      })()`,
      returnByValue: true
    });
    console.log('Debug info:', debugInfo.result.result.value);

    // Let's compute screenX, screenY for worldX=712.2, worldY=381.3
    const { canvasRect } = debugInfo.result.result.value;
    const vpW = canvasRect.width;
    const vpH = canvasRect.height;
    const fit = Math.min(vpW / 2400, vpH / 1800);
    const baseX = (vpW - 2400 * fit) / 2;
    const baseY = (vpH - 1800 * fit) / 2;

    // Minimum zoom from constrainGardenCamera:
    // minimumZoom = Math.max(1, Math.max(vpW / 2400, vpH / 1800) / fit);
    // Since fit = Math.min(vpW/2400, vpH/1800), minimumZoom = Math.max(vpW/2400, vpH/1800) / Math.min(vpW/2400, vpH/1800)
    const minZoom = Math.max(1, Math.max(vpW / 2400, vpH / 1800) / fit);
    const camX = vpW / 2 - baseX - 1200 * fit * minZoom;
    const camY = vpH / 2 - baseY - 750.5 * fit * minZoom;

    const screenX = baseX + camX + 712.2 * fit * minZoom;
    const screenY = baseY + camY + 381.3 * fit * minZoom;

    const clientX = canvasRect.left + screenX;
    const clientY = canvasRect.top + screenY;

    console.log(`Calculated Mailbox Center:`);
    console.log(`  fit: ${fit}, minZoom: ${minZoom}`);
    console.log(`  baseX: ${baseX}, baseY: ${baseY}, camX: ${camX}, camY: ${camY}`);
    console.log(`  screenX: ${screenX}, screenY: ${screenY}`);
    console.log(`  clientX: ${clientX}, clientY: ${clientY}`);

    // Let's test clicking exactly at this clientX, clientY!
    console.log(`Dispatching mouse click at (${clientX}, ${clientY})...`);
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: clientX,
      y: clientY,
      button: 'left',
      clickCount: 1,
    });
    await new Promise(r => setTimeout(r, 60));
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: clientX,
      y: clientY,
      button: 'left',
      clickCount: 1,
    });

    console.log('Waiting for route change or fairy walk...');
    for (let t = 0; t < 25; t++) {
      await new Promise(r => setTimeout(r, 300));
      const res = await cdp.send('Runtime.evaluate', { expression: 'window.location.pathname', returnByValue: true });
      if (res.result.result.value === '/mailbox') {
        console.log(`SUCCESS! Navigated to /mailbox at step ${t}!`);
        return;
      }
    }
    console.log('Did not navigate in time.');
  } finally {
    chromeProc.kill();
  }
}

run().catch(console.error);
