import { launchHeadlessChrome, createCDPClient } from './browserAutomation.mjs';

async function main() {
  const chromeProc = await launchHeadlessChrome();
  const cdp = await createCDPClient();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Page.navigate', { url: 'http://localhost:8081/fairy-loading-test' });
  await new Promise((r) => setTimeout(r, 3500));

  const info = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      window.__SEEK_FAIRY(2150);
      return new Promise((resolve) => {
        setTimeout(() => {
          const el = document.querySelector('[data-testid="fairy-pose-01-head-blink-image"]');
          const img = el?.querySelector('img') || el;
          resolve({
            outerHTML: el ? el.outerHTML : null,
            imgSrc: el?.src || img?.src,
            imgComplete: img?.complete,
            naturalWidth: img?.naturalWidth,
            naturalHeight: img?.naturalHeight,
            style: el ? el.getAttribute('style') : null,
            computedStyle: el ? {
              display: window.getComputedStyle(el).display,
              visibility: window.getComputedStyle(el).visibility,
              opacity: window.getComputedStyle(el).opacity,
              zIndex: window.getComputedStyle(el).zIndex,
              width: window.getComputedStyle(el).width,
              height: window.getComputedStyle(el).height,
              position: window.getComputedStyle(el).position,
            } : null
          });
        }, 300);
      });
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });

  console.log(JSON.stringify(info.result.result.value, null, 2));

  cdp.ws.close();
  chromeProc.kill();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
