import { launchHeadlessChrome, createCDPClient } from '../test/browserAutomation.mjs';

async function measure() {
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
      const content = el.children[5];
      const elStyle = window.getComputedStyle(el);
      const contentStyle = window.getComputedStyle(content);
      return {
        el: {
          paddingTop: elStyle.paddingTop,
          paddingBottom: elStyle.paddingBottom,
          paddingLeft: elStyle.paddingLeft,
          paddingRight: elStyle.paddingRight,
          width: elStyle.width,
          height: elStyle.height,
          display: elStyle.display,
          flexDirection: elStyle.flexDirection,
          alignItems: elStyle.alignItems,
          justifyContent: elStyle.justifyContent,
        },
        content: {
          width: contentStyle.width,
          height: contentStyle.height,
          marginTop: contentStyle.marginTop,
          display: contentStyle.display,
          flexDirection: contentStyle.flexDirection,
          flex: contentStyle.flex,
          boxSizing: contentStyle.boxSizing,
        }
      };
    })()`
  });
  console.log('Result:', JSON.stringify(res, null, 2));
  process.exit(0);
}

measure().catch(e => { console.error(e); process.exit(1); });
