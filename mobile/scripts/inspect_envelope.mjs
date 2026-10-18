import { launchHeadlessChrome, createCDPClient } from '../test/browserAutomation.mjs';

async function main() {
  try {
    const res = await fetch('http://127.0.0.1:9222/json/version');
    if (!res.ok) throw new Error();
  } catch {
    await launchHeadlessChrome();
  }
  const cdp = await createCDPClient();
  await cdp.send('Page.navigate', { url: 'http://localhost:8081/login-preview' });
  await new Promise(r => setTimeout(r, 2000));
  const res = await cdp.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const el = document.querySelector('[data-testid="login-envelope"]');
      const children = Array.from(el.children).map((c, i) => {
        const r = c.getBoundingClientRect();
        const cs = window.getComputedStyle(c);
        return {
          index: i,
          tag: c.tagName,
          className: c.className,
          position: cs.position,
          top: cs.top,
          left: cs.left,
          width: cs.width,
          height: cs.height,
          rect: { x: r.x, y: r.y, width: r.width, height: r.height }
        };
      });
      return {
        parentRect: el.getBoundingClientRect(),
        children
      };
    })()`
  });
  console.log(JSON.stringify(res, null, 2));
  process.exit(0);
}

main().catch(console.error);
