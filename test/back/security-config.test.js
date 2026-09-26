import assert from "node:assert/strict";
import test from "node:test";

import { isAllowedOrigin, trustProxySetting } from "../../lib/security-config.js";

test("CORS only allows explicitly configured origins", () => {
  const env = { CORS_ALLOWED_ORIGINS: "https://app.example, http://localhost:5173" };
  assert.equal(isAllowedOrigin(undefined, env), true);
  assert.equal(isAllowedOrigin("https://app.example", env), true);
  assert.equal(isAllowedOrigin("https://evil.example", env), false);
});

test("development allows both local Vite origins without changing production policy", () => {
  for (const origin of ["http://localhost:5173", "http://127.0.0.1:5173"]) {
    assert.equal(isAllowedOrigin(origin, { NODE_ENV: "development" }), true);
    assert.equal(isAllowedOrigin(origin, { NODE_ENV: "production" }), false);
  }
  assert.equal(isAllowedOrigin("http://evil.example:5173", { NODE_ENV: "development" }), false);
  assert.equal(isAllowedOrigin("*", { NODE_ENV: "development" }), false);
});

test("trust proxy is disabled unless explicitly configured", () => {
  assert.equal(trustProxySetting({}), false);
  assert.equal(trustProxySetting({ TRUST_PROXY: "2" }), 2);
  assert.equal(trustProxySetting({ TRUST_PROXY: "loopback,10.0.0.0/8" }), "loopback,10.0.0.0/8");
  assert.throws(() => trustProxySetting({ TRUST_PROXY: "true" }));
  assert.throws(() => trustProxySetting({ TRUST_PROXY: "https://untrusted.example" }));
});
