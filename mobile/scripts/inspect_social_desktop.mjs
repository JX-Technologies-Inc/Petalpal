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
  await new Promise(r => setTimeout(r, 2500));
  const res = await cdp.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const btns = all.filter(b => b.innerText && b.innerText.includes('Continue'));
      return btns.map(b => ({
        tag: b.tagName,
        text: b.innerText,
        rect: b.getBoundingClientRect(),
        scrollWidth: b.scrollWidth,
        clientWidth: b.clientWidth
      }));
    })()`
  });
  console.log(JSON.stringify(res.result.result.value, null, 2));
  process.exit(0);
}

main().catch(console.error);
