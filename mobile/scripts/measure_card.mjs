import { launchHeadlessChrome, createCDPClient } from '../test/browserAutomation.mjs';

async function measure() {
  let chromeProc;
  try {
    const res = await fetch('http://127.0.0.1:9222/json/version');
    if (!res.ok) throw new Error();
  } catch {
    chromeProc = await launchHeadlessChrome();
  }

  const cdp = await createCDPClient();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  // Desktop
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 800, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Page.navigate', { url: 'http://localhost:8081/login-preview' });
  await new Promise(r => setTimeout(r, 2500));

  const resDesktop = await cdp.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const el = document.querySelector('[data-testid="login-envelope"]');
      if (!el) return 'Not found';
      const rect = el.getBoundingClientRect();
      const images = Array.from(el.querySelectorAll('img')).map(img => img.getBoundingClientRect());
      const content = el.children[5];
      const children = content ? Array.from(content.children).map(c => ({
        tag: c.tagName,
        text: c.innerText ? c.innerText.slice(0, 20) : '',
        rect: c.getBoundingClientRect()
      })) : [];
      return JSON.stringify({ el: rect, images, content: content?.getBoundingClientRect(), children }, null, 2);
    })()`
  });
  console.log('=== Desktop Measurements ===\n', JSON.stringify(resDesktop));

  // Mobile
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 412, height: 892, deviceScaleFactor: 1, mobile: true });
  await new Promise(r => setTimeout(r, 1000));
  const resMobile = await cdp.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const el = document.querySelector('[data-testid="login-envelope"]');
      if (!el) return 'Not found';
      const rect = el.getBoundingClientRect();
      const images = Array.from(el.querySelectorAll('img')).map(img => img.getBoundingClientRect());
      const content = el.children[5];
      const children = content ? Array.from(content.children).map(c => ({
        tag: c.tagName,
        text: c.innerText ? c.innerText.slice(0, 20) : '',
        rect: c.getBoundingClientRect()
      })) : [];
      return JSON.stringify({ el: rect, images, content: content?.getBoundingClientRect(), children }, null, 2);
    })()`
  });
  console.log('=== Mobile Measurements ===\n', resMobile.result.value);

  process.exit(0);
}

measure().catch(err => {
  console.error(err);
  process.exit(1);
});
