import assert from "node:assert/strict";
import test from "node:test";

import { app } from "../../server.js";

test("OPTIONS /auth/session responds to both development Vite origins", async (t) => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousOrigins = process.env.CORS_ALLOWED_ORIGINS;
  process.env.NODE_ENV = "development";
  delete process.env.CORS_ALLOWED_ORIGINS;
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(async () => {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousOrigins === undefined) delete process.env.CORS_ALLOWED_ORIGINS;
    else process.env.CORS_ALLOWED_ORIGINS = previousOrigins;
    await new Promise((resolve) => server.close(resolve));
  });

  for (const origin of ["http://localhost:5173", "http://127.0.0.1:5173"]) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/auth/session`, {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization,content-type"
      }
    });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("access-control-allow-origin"), origin);
    assert.match(response.headers.get("access-control-allow-methods"), /POST/);
    assert.match(response.headers.get("access-control-allow-headers"), /authorization/i);
  }
});
