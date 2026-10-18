import { launchHeadlessChrome, createCDPClient } from './browserAutomation.mjs';

async function main() {
  const proc = await launchHeadlessChrome();
  const cdp = await createCDPClient();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Page.navigate', { url: 'http://localhost:8081/mailbox' });
  await new Promise((r) => setTimeout(r, 2000));

  const res = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const letter = document.querySelector('[aria-label="Expanded Reading Letter"]');
      const shadow = letter.querySelector('div[style*="box-shadow"]');
      // Hide shadowPlate
      const shadowPlate = letter.children[0];
      shadowPlate.style.display = 'none';

      // Apply drop-shadow to letter
      letter.style.filter = 'drop-shadow(0 14px 28px rgba(22, 14, 8, 0.38)) drop-shadow(0 2px 6px rgba(0, 0, 0, 0.12))';
      
      return { success: true };
    })()`,
    returnByValue: true
  });

  const { result } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  import('node:fs').then(fs => {
    fs.writeFileSync('test_dropshadow_proof.png', Buffer.from(result.data, 'base64'));
    console.log('Saved test_dropshadow_proof.png');
  });

  await new Promise((r) => setTimeout(r, 500));
  cdp.ws.close();
  proc.kill();
}

main().catch(console.error);
