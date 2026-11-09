import assert from "node:assert/strict";
import test from "node:test";

import bcrypt from "bcryptjs";
import { login, logout } from "../controllers/authController.js";
import User from "../models/User.js";

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

test("successful login remains successful when the notification email is unavailable", async t => {
  const keys = ["JWT_SECRET", "SMTP_HOST", "SMTP_USER", "SMTP_PASS"];
  const previous = new Map(keys.map(key => [key, process.env[key]]));
  process.env.JWT_SECRET = "test-jwt-secret-that-is-at-least-32-chars";
  for (const key of keys.slice(1)) delete process.env[key];

  const user = {
    _id: "507f1f77bcf86cd799439011",
    name: "Customer Name",
    email: "customer@example.com",
    role: "customer",
    verified: true,
    sessionVersion: 0,
    async save() {},
  };
  const query = { select() { return this; } };
  t.mock.method(User, "findOne", () => Object.assign(query, { then: resolve => resolve(user) }));
  t.mock.method(bcrypt, "compare", async () => true);
  const res = {
    cookieName: "",
    cookie(name) { this.cookieName = name; return this; },
    json(body) { this.body = body; return this; },
  };
  const originalError = console.error;
  console.error = () => {};

  try {
    await login({
      body: { email: user.email, password: "valid-password" },
      ip: "203.0.113.5",
      get: name => name === "user-agent" ? "Mozilla/5.0 (iPhone) Version/17 Safari/605.1" : "",
    }, res, error => { throw error; });

    assert.equal(res.body.success, true);
    assert.equal(res.cookieName, process.env.JWT_COOKIE_NAME || "amadee_session");
  } finally {
    console.error = originalError;
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});