import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9222;

export async function launchHeadlessChrome() {
  const args = [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=430,932',
    'about:blank',
  ];

  const chromeProc = spawn(CHROME_PATH, args, { stdio: 'ignore' });

  // Wait for debug port to be available
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 200));
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) {
        return chromeProc;
      }
    } catch {}
  }
  throw new Error('Chrome failed to start on port ' + PORT);
}

export async function createCDPClient() {
  let tab;
  try {
    const listRes = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    const tabs = await listRes.json();
    tab = tabs.find((t) => t.type === 'page') || tabs[0];
  } catch {}

  if (!tab) {
    const newRes = await fetch(`http://127.0.0.1:${PORT}/json/new`, { method: 'PUT' });
    tab = await newRes.json();
  }
  const wsUrl = tab.webSocketDebuggerUrl;

  const ws = new WebSocket(wsUrl);
  let id = 1;
  const callbacks = new Map();

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  const eventListeners = new Map();

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && callbacks.has(msg.id)) {
      callbacks.get(msg.id)(msg);
      callbacks.delete(msg.id);
    } else if (msg.method && eventListeners.has(msg.method)) {
      for (const listener of eventListeners.get(msg.method)) {
        listener(msg.params);
      }
    }
  };

  const on = (method, handler) => {
    if (!eventListeners.has(method)) {
      eventListeners.set(method, new Set());
    }
    eventListeners.get(method).add(handler);
  };

  const send = (method, params = {}) => {
    return new Promise((resolve) => {
      const currentId = id++;
      callbacks.set(currentId, resolve);
      ws.send(JSON.stringify({ id: currentId, method, params }));
    });
  };

  return { ws, send, on, tab };
}
