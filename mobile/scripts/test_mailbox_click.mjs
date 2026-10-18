import { launchHeadlessChrome, createCDPClient } from '../test/browserAutomation.mjs';

async function run() {
  const chromeProc = await launchHeadlessChrome();
  try {
    const cdp = await createCDPClient();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    console.log('Navigating to http://localhost:8081/player-preview ...');
    await cdp.send('Page.navigate', { url: 'http://localhost:8081/player-preview' });
    await new Promise(r => setTimeout(r, 4000));

    // Get canvas bounds and header height
    const layout = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const canvas = document.querySelector('canvas');
        const rect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0, width: 430, height: 650 };
        return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
      })()`,
      returnByValue: true
    });
    console.log('Canvas layout:', layout.result.result.value);
    const { left, top, width, height } = layout.result.result.value;

    // The mailbox in screen_2 is near the treehouse entrance:
    // x around 70px, y around 350px
    const targetX = left + 75;
    const targetY = top + 355;
    console.log(`Clicking at screen position: (${targetX}, ${targetY})`);

    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: targetX,
      y: targetY,
      button: 'left',
      clickCount: 1,
    });
    await new Promise(r => setTimeout(r, 50));
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: targetX,
      y: targetY,
      button: 'left',
      clickCount: 1,
    });

    console.log('Waiting to observe fairy walking and mailbox navigation...');
    let transitioned = false;
    for (let t = 0; t < 30; t++) {
      await new Promise(r => setTimeout(r, 350));
      const res = await cdp.send('Runtime.evaluate', {
        expression: 'window.location.pathname',
        returnByValue: true,
      });
      const pathname = res.result.result.value;
      if (pathname === '/mailbox') {
        transitioned = true;
        console.log(`Navigated to /mailbox at check ${t}!`);
        break;
      }
    }

    if (!transitioned) {
      console.log('Target (75, 355) did not transition. Trying slightly different offset (85, 360)...');
      await cdp.send('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x: left + 85,
        y: top + 360,
        button: 'left',
        clickCount: 1,
      });
      await new Promise(r => setTimeout(r, 50));
      await cdp.send('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x: left + 85,
        y: top + 360,
        button: 'left',
        clickCount: 1,
      });
      for (let t = 0; t < 30; t++) {
        await new Promise(r => setTimeout(r, 350));
        const res = await cdp.send('Runtime.evaluate', {
          expression: 'window.location.pathname',
          returnByValue: true,
        });
        if (res.result.result.value === '/mailbox') {
          transitioned = true;
          console.log(`Navigated to /mailbox at check ${t}!`);
          break;
        }
      }
    }

    console.log('Result transitioned to mailbox:', transitioned);
  } finally {
    chromeProc.kill();
  }
}

run().catch(console.error);
