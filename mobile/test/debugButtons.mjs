import { launchHeadlessChrome, createCDPClient } from './browserAutomation.mjs';

async function main() {
  const proc = await launchHeadlessChrome();
  const cdp = await createCDPClient();
  await cdp.send('Page.navigate', { url: 'http://localhost:8081/mailbox' });
  await new Promise((r) => setTimeout(r, 2000));

  const clickRes = await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const stackBtn = btns.find(b => b.innerText && b.innerText.includes('Stack'));
        if (!stackBtn) return 'STACK_BTN_NOT_FOUND';
        
        stackBtn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
        stackBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        stackBtn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
        stackBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        stackBtn.click();
        return 'CLICKED_STACK';
      })()
    `,
    returnByValue: true,
  });
  console.log('Click result:', clickRes.result.result.value);

  // Wait 1.5 seconds for closing animation
  await new Promise((r) => setTimeout(r, 1500));

  const checkRes = await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        return btns.map(b => b.innerText.trim());
      })()
    `,
    returnByValue: true,
  });
  console.log('Buttons after click:', checkRes.result.result.value);

  cdp.ws.close();
  proc.kill();
}

main().catch(console.error);
