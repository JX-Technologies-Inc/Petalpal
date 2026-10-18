import { launchHeadlessChrome, createCDPClient } from '../test/browserAutomation.mjs';

async function main() {
  try {
    const res = await fetch('http://127.0.0.1:9222/json/version');
    if (!res.ok) throw new Error();
  } catch {
    await launchHeadlessChrome();
  }
  const cdp = await createCDPClient();
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 800, deviceScaleFactor: 1.5, mobile: false });
  await cdp.send('Page.navigate', { url: 'http://localhost:8081/login-preview' });
  await new Promise(r => setTimeout(r, 2000));
  const res = await cdp.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const el = document.querySelector('[data-testid="login-envelope"]');
      const content = el.children[5];
      return {
        el: {
          width: el.offsetWidth,
          clientWidth: el.clientWidth,
          paddingLeft: window.getComputedStyle(el).paddingLeft,
          paddingRight: window.getComputedStyle(el).paddingRight,
          alignItems: window.getComputedStyle(el).alignItems,
        },
        content: {
          width: content.offsetWidth,
          clientWidth: content.clientWidth,
          styleWidth: content.style.width,
          computedWidth: window.getComputedStyle(content).width,
          maxWidth: window.getComputedStyle(content).maxWidth,
          minWidth: window.getComputedStyle(content).minWidth,
          boxSizing: window.getComputedStyle(content).boxSizing,
          classes: content.className
        }
      };
    })()`
  });
  console.log(JSON.stringify(res.result.result.value, null, 2));
  process.exit(0);
}

main().catch(console.error);
