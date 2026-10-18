import { launchHeadlessChrome, createCDPClient } from './browserAutomation.mjs';

async function main() {
  const proc = await launchHeadlessChrome();
  const cdp = await createCDPClient();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Page.navigate', { url: 'http://localhost:8081/mailbox' });
  await new Promise((r) => setTimeout(r, 2000));

  const check = async (label) => {
    const res = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const letter = document.querySelector('[aria-label="Expanded Reading Letter"]');
        const rLetter = letter ? letter.getBoundingClientRect() : null;
        const shadow = letter ? letter.children[0] : null;
        const rShadow = shadow ? shadow.getBoundingClientRect() : null;
        const sheet = letter ? letter.children[1] : null;
        const rSheet = sheet ? sheet.getBoundingClientRect() : null;
        const csSheet = sheet ? window.getComputedStyle(sheet) : null;
        const csShadow = shadow ? window.getComputedStyle(shadow) : null;
        return {
          label: "${label}",
          letter: rLetter ? { top: rLetter.top, bottom: rLetter.bottom, height: rLetter.height } : null,
          shadow: rShadow ? { top: rShadow.top, bottom: rShadow.bottom, height: rShadow.height, boxShadow: csShadow.boxShadow } : null,
          sheet: rSheet ? { top: rSheet.top, bottom: rSheet.bottom, height: rSheet.height, bg: csSheet.backgroundColor } : null
        };
      })()`,
      returnByValue: true
    });
    return res.result.result.value;
  };

  console.log('LETTER 1:', JSON.stringify(await check('letter 1'), null, 2));

  // click envelope 2
  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelectorAll('[aria-label^="Envelope from"]')[1].click()`
  });
  await new Promise((r) => setTimeout(r, 2000));
  console.log('LETTER 2:', JSON.stringify(await check('letter 2'), null, 2));

  cdp.ws.close();
  proc.kill();
}

main().catch(console.error);
