import assert from "node:assert/strict";
import test from "node:test";

import { logout } from "../controllers/authController.js";

test("logout increments the session version before clearing the cookie", async () => {
  let saved = false;
  let clearedCookie;
  const req = {
    user: {
      sessionVersion: 4,
      async save() { saved = true; },
    },
  };
  const res = {
    clearCookie(name, options) { clearedCookie = { name, options }; },
    json(body) { this.body = body; return this; },
  };

  await logout(req, res, error => { throw error; });

  assert.equal(saved, true);
  assert.equal(req.user.sessionVersion, 5);
  assert.equal(clearedCookie.name, process.env.JWT_COOKIE_NAME || "amadee_session");
  assert.equal(res.body.success, true);
});