import { spawn } from "node:child_process";
import { resolveDatabaseUrl } from "../lib/database-isolation.js";

try {
  resolveDatabaseUrl({ ...process.env, NODE_ENV: "development" });
  if (!process.env.AUTH_E2E_TEST_EMAIL?.trim()) throw new Error("Dedicated E2E test email is not configured");
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const env = { ...process.env, NODE_ENV: "development" };
const children = [
  spawn(process.execPath, ["server.js"], { env, stdio: "inherit" }),
  spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5173", "--strictPort"], { env, cwd: "client", stdio: "inherit" })
];

function stop() {
  for (const child of children) child.kill("SIGTERM");
}
for (const child of children) {
  child.once("exit", (code) => {
    if (code && process.exitCode === undefined) process.exitCode = code;
    stop();
  });
}
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
