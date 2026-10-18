import { launchHeadlessChrome, createCDPClient } from './browserAutomation.mjs';

async function main() {
  const chromeProc = await launchHeadlessChrome();
  const cdp = await createCDPClient();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Page.navigate', { url: 'http://localhost:8081/fairy-loading-test' });
  await new Promise((r) => setTimeout(r, 3500));

  const rects = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      window.__SEEK_FAIRY(2150);
      return new Promise((resolve) => {
        setTimeout(() => {
          const head = document.querySelector('[data-testid="fairy-pose-01-head-image"]');
          const blink = document.querySelector('[data-testid="fairy-pose-01-head-blink-image"]');
          const headContainer = document.querySelector('[data-testid="fairy-pose-01-head-container"]');
          const hands = document.querySelector('[data-testid="fairy-pose-01-hands-image"]');

          const getR = (el) => el ? {
            x: el.getBoundingClientRect().x,
            y: el.getBoundingClientRect().y,
            width: el.getBoundingClientRect().width,
            height: el.getBoundingClientRect().height,
          } : null;

          resolve({
            headContainerRect: getR(headContainer),
            headRect: getR(head),
            blinkRect: getR(blink),
            handsRect: getR(hands),
          });
        }, 400);
      });
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });

  console.log(JSON.stringify(rects.result.result.value, null, 2));

  cdp.ws.close();
  chromeProc.kill();
}

main().catch(console.error);
