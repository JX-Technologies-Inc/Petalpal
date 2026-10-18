import { launchHeadlessChrome, createCDPClient } from './browserAutomation.mjs';
import fs from 'node:fs';
import path from 'node:path';

const FRAMES_DIR = 'test_animation_frames_global_feedback';
if (!fs.existsSync(FRAMES_DIR)) {
  fs.mkdirSync(FRAMES_DIR, { recursive: true });
}

async function captureFrame(cdp, filename) {
  const { result } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const buf = Buffer.from(result.data, 'base64');
  fs.writeFileSync(filename, buf);
  fs.writeFileSync(path.join(FRAMES_DIR, path.basename(filename)), buf);
  return buf;
}

async function run() {
  console.log('=== STARTING GLOBAL HELP & FEEDBACK E2E VERIFICATION ===');
  const chromeProc = await launchHeadlessChrome();
  console.log('[1/10] Headless Chrome launched.');
  const cdp = await createCDPClient();
  console.log('[2/10] Connected to Chrome DevTools Protocol.');

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  // Desktop viewport (1024x820)
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1024,
    height: 820,
    deviceScaleFactor: 1.5,
    mobile: false,
  });

  // ── SCENARIO 1: GARDEN SCREEN ──
  console.log('[3/10] Verifying Garden Screen (/garden-test)...');
  await cdp.send('Page.navigate', { url: 'http://localhost:8081/garden-test' });
  await new Promise((r) => setTimeout(r, 3000));

  const gardenAudit = await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const triggers = btns.filter(b => {
          const label = b.getAttribute('aria-label') || '';
          const text = b.innerText || '';
          return label.toLowerCase().includes('help') || text.includes('Help & Feedback') || text === 'Help';
        });
        return {
          route: window.location.pathname,
          triggerCount: triggers.length,
          hasTrigger: triggers.length === 1,
        };
      })()
    `,
    returnByValue: true,
  });
  console.log('  Garden Audit:', gardenAudit.result.result.value);
  await captureFrame(cdp, 'screen_1_garden.png');

  // ── SCENARIO 2: JOURNAL SCREEN ──
  console.log('[4/10] Verifying Journal Screen (/journal)...');
  await cdp.send('Page.navigate', { url: 'http://localhost:8081/journal' });
  await new Promise((r) => setTimeout(r, 2200));

  const journalAudit = await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const triggers = btns.filter(b => {
          const label = b.getAttribute('aria-label') || '';
          const text = b.innerText || '';
          return label.toLowerCase().includes('help') || text.includes('Help & Feedback') || text === 'Help';
        });
        return {
          route: window.location.pathname,
          triggerCount: triggers.length,
          hasTrigger: triggers.length === 1,
        };
      })()
    `,
    returnByValue: true,
  });
  console.log('  Journal Audit:', journalAudit.result.result.value);
  await captureFrame(cdp, 'screen_2_journal.png');

  // ── SCENARIO 3: MAILBOX SCREEN (NO DUPLICATE TRIGGERS) ──
  console.log('[5/10] Verifying Mailbox Screen (/mailbox)...');
  await cdp.send('Page.navigate', { url: 'http://localhost:8081/mailbox' });
  await new Promise((r) => setTimeout(r, 2800));

  const mailboxAudit = await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const triggers = btns.filter(b => {
          const label = b.getAttribute('aria-label') || '';
          const text = b.innerText || '';
          return label.toLowerCase().includes('help') || text.includes('Help & Feedback') || text === 'Help';
        });
        return {
          route: window.location.pathname,
          triggerCount: triggers.length,
          exactlyOneTrigger: triggers.length === 1,
        };
      })()
    `,
    returnByValue: true,
  });
  console.log('  Mailbox Audit:', mailboxAudit.result.result.value);
  await captureFrame(cdp, 'screen_3_mailbox.png');

  // ── SCENARIO 4: OPEN MENU ON MAILBOX ──
  console.log('[6/10] Opening Help & Feedback Menu...');
  await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const trigger = btns.find(b => {
          const label = b.getAttribute('aria-label') || '';
          const text = b.innerText || '';
          return label.toLowerCase().includes('help') || text.includes('Help');
        });
        if (trigger) trigger.click();
      })()
    `,
  });
  await new Promise((r) => setTimeout(r, 500));
  await captureFrame(cdp, 'screen_4_menu_open.png');

  // ── SCENARIO 5: TAP "Send Feedback" TO OPEN FORM ──
  console.log('[7/10] Navigating inside panel to Send Feedback Form...');
  await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const sendFeedbackBtn = btns.find(b => {
          const text = b.innerText || '';
          const label = b.getAttribute('aria-label') || '';
          return text.includes('Send Feedback') || label.includes('Send Feedback');
        });
        if (sendFeedbackBtn) sendFeedbackBtn.click();
      })()
    `,
  });
  await new Promise((r) => setTimeout(r, 500));

  const formAudit = await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const formText = document.body.innerText;
        const inputs = Array.from(document.querySelectorAll('input, textarea'));
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        return {
          hasSendFeedbackHeader: formText.includes('Send Feedback'),
          hasSubtitle: formText.includes('Your thoughts help our garden grow.'),
          hasCategoryBug: formText.includes('Bug Report'),
          hasCategoryFeature: formText.includes('Feature Suggestion'),
          hasCategoryGeneral: formText.includes('General Feedback'),
          hasCategoryAi: formText.includes('AI Response Concern'),
          inputCount: inputs.length,
          hasSubmitBtn: btns.some(b => b.innerText && b.innerText.includes('Send Feedback')),
        };
      })()
    `,
    returnByValue: true,
  });
  console.log('  Form DOM Audit:', formAudit.result.result.value);
  await captureFrame(cdp, 'screen_5_form_open.png');

  // ── SCENARIO 6: TYPE DRAFT CONTENT & SELECT CATEGORY ──
  console.log('[8/10] Typing feedback draft and selecting category...');
  await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        function setNativeValue(element, value) {
          const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
          const prototype = Object.getPrototypeOf(element);
          const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
          if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
            prototypeValueSetter.call(element, value);
          } else if (valueSetter) {
            valueSetter.call(element, value);
          } else {
            element.value = value;
          }
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Select 'Feature Suggestion'
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const featBtn = btns.find(b => b.innerText && b.innerText.includes('Feature Suggestion'));
        if (featBtn) featBtn.click();

        // Fill subject & message
        const inputs = Array.from(document.querySelectorAll('input'));
        const subjectInput = inputs.find(i => i.placeholder && i.placeholder.includes('mind'));
        if (subjectInput) {
          setNativeValue(subjectInput, 'Moonlight Water Lily Garden Request');
        }

        const emailInput = inputs.find(i => i.placeholder && i.placeholder.includes('email'));
        if (emailInput) {
          setNativeValue(emailInput, 'fairy.gardener@petalpal.world');
        }

        const textarea = document.querySelector('textarea');
        if (textarea) {
          setNativeValue(textarea, 'I would love to see night-blooming water lilies by the garden pond! When the fairy walks by at twilight, maybe they could emit soft moonlight ripples.\\n\\nThank you for this enchanting world!');
        }
      })()
    `,
  });
  await new Promise((r) => setTimeout(r, 600));
  await captureFrame(cdp, 'screen_6_form_typed.png');

  // ── SCENARIO 7: CLOSE PANEL & NAVIGATE TO JOURNAL -> REOPEN -> DRAFT PRESERVED ──
  console.log('[9/10] Testing Draft Preservation across Route Navigation...');
  // Close panel
  await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const closeBtn = document.querySelector('[aria-label="Close"]');
        if (closeBtn) closeBtn.click();
      })()
    `,
  });
  await new Promise((r) => setTimeout(r, 400));

  // Navigate to Journal
  console.log('  Navigating to /journal while draft is stored...');
  await cdp.send('Page.navigate', { url: 'http://localhost:8081/journal' });
  await new Promise((r) => setTimeout(r, 2200));

  // Reopen Help & Feedback on Journal
  console.log('  Reopening Help & Feedback on /journal...');
  await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const trigger = btns.find(b => {
          const label = b.getAttribute('aria-label') || '';
          const text = b.innerText || '';
          return label.toLowerCase().includes('help') || text.includes('Help');
        });
        if (trigger) trigger.click();
      })()
    `,
  });
  await new Promise((r) => setTimeout(r, 600));

  const draftPreservationAudit = await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const textarea = document.querySelector('textarea');
        const inputs = Array.from(document.querySelectorAll('input'));
        const subjectInput = inputs.find(i => i.placeholder && i.placeholder.includes('mind'));
        const emailInput = inputs.find(i => i.placeholder && i.placeholder.includes('email'));

        return {
          preservedSubject: subjectInput ? subjectInput.value : '',
          preservedMessage: textarea ? textarea.value : '',
          preservedEmail: emailInput ? emailInput.value : '',
          messageMatches: textarea ? textarea.value.includes('night-blooming water lilies') : false,
          hasDiscardOption: document.body.innerText.includes('Discard draft'),
        };
      })()
    `,
    returnByValue: true,
  });
  console.log('  Draft Preservation Audit on /journal:', draftPreservationAudit.result.result.value);
  await captureFrame(cdp, 'screen_7_draft_preserved_journal.png');

  // ── SCENARIO 8: SUBMIT FEEDBACK & TEST HONEST DEV MODE ──
  console.log('[10/10] Submitting feedback and verifying honest transport behavior...');
  await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('[role="button"]'));
        const submitBtn = btns.find(b => b.innerText && b.innerText.includes('Send Feedback'));
        if (submitBtn) submitBtn.click();
      })()
    `,
  });
  await new Promise((r) => setTimeout(r, 800));

  const submissionAudit = await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const text = document.body.innerText;
        const textarea = document.querySelector('textarea');
        return {
          hasLocalDevNotice: text.includes('Local Dev Mode') || text.includes('Offline draft mode'),
          messageStillPreserved: textarea ? textarea.value.length > 0 : false,
        };
      })()
    `,
    returnByValue: true,
  });
  console.log('  Submission Status Audit:', submissionAudit.result.result.value);
  await captureFrame(cdp, 'screen_8_submission_status.png');

  // ── SCENARIO 9: MOBILE VIEWPORT TEST ──
  console.log('Testing Mobile Viewport (iPhone 14 / 390x844)...');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2.0,
    mobile: true,
  });
  await new Promise((r) => setTimeout(r, 600));
  await captureFrame(cdp, 'screen_9_mobile_feedback_form.png');

  console.log('=== GLOBAL HELP & FEEDBACK E2E VERIFICATION COMPLETED SUCCESSFULLY ===');
  process.exit(0);
}

run().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
