import assert from "node:assert/strict";
import test from "node:test";

import {
  accountWelcomeEmail,
  adminNewOrderEmail,
  adminNewRegistrationEmail,
  adminPaymentConfirmedEmail,
  contactNotificationEmail,
  newsletterNotificationEmail,
  newsletterWelcomeEmail,
  orderReceivedEmail,
  orderStatusEmail,
  passwordChangedEmail,
  passwordResetEmail,
  paymentConfirmedEmail,
  reviewNotificationEmail,
  verificationEmail,
} from "../templates/emailTemplates.js";
import { sendBestEffortMail } from "../services/mailer.js";

const user = {
  name: "<Customer>",
  email: "customer@example.com",
  role: "customer",
  verified: false,
};

const order = {
  orderId: "AS-TEST-123",
  customer: {
    name: "<Customer>",
    email: "customer@example.com",
    phone: "08000000000",
    address: "Lagos",
  },
  items: [{
    name: "Ankara dress",
    quantity: 2,
    size: "M",
    colour: "Blue",
    lineTotal: 20000,
  }],
  subtotal: 20000,
  discount: 0,
  promoCode: "",
  promoCampaignName: "",
  deliveryFee: 2000,
  total: 22000,
  paymentMethod: "paystack",
  paymentStatus: "paid",
  paymentReference: "PAY-123",
  paymentChannel: "card",
  paidAt: new Date("2026-11-02T12:00:00Z"),
  deliveryOption: "lagos",
  statusHistory: [{ note: "Your outfit is ready." }],
};

const templates = [
  ["verification", () => verificationEmail({ name: user.name, otp: "123456", minutes: 5 })],
  ["password reset", () => passwordResetEmail({ otp: "123456" })],
  ["password changed", () => passwordChangedEmail(user)],
  ["account welcome", () => accountWelcomeEmail(user)],
  ["new registration", () => adminNewRegistrationEmail(user)],
  ["order received", () => orderReceivedEmail(order)],
  ["admin new order", () => adminNewOrderEmail(order)],
  ["payment confirmed", () => paymentConfirmedEmail(order)],
  ["admin payment confirmed", () => adminPaymentConfirmedEmail(order)],
  ["order status", () => orderStatusEmail({ order, status: "ready" })],
  ["contact enquiry", () => contactNotificationEmail({
    name: user.name,
    email: user.email,
    message: "<Please call me>",
    messageId: "message-123",
  })],
  ["newsletter welcome", () => newsletterWelcomeEmail(user.email)],
  ["admin newsletter", () => newsletterNotificationEmail(user.email)],
  ["admin review", () => reviewNotificationEmail({
    name: user.name,
    rating: 5,
    message: "<Lovely work>",
    createdAt: new Date("2026-11-02T12:00:00Z"),
  })],
];

test("all notification templates contain responsive branded HTML and plain text", () => {
  for (const [name, createTemplate] of templates) {
    const template = createTemplate();

    assert.ok(template.subject, `${name}: missing subject`);
    assert.ok(template.text, `${name}: missing plain-text body`);
    assert.ok(template.html, `${name}: missing HTML body`);
    assert.match(template.html, /assets\/images\/logo\.svg/, `${name}: missing official logo`);
    assert.match(template.html, /@media screen and \(max-width:620px\)/, `${name}: missing mobile layout`);
    assert.match(template.html, /#168da0/, `${name}: missing brand color`);
    assert.doesNotMatch(template.html, /<Customer>/, `${name}: unsafe dynamic HTML`);
  }
});

test("order and notification templates render their database-backed details", () => {
  assert.match(orderReceivedEmail(order).html, /AS-TEST-123/);
  assert.match(orderReceivedEmail(order).html, /&lt;Customer&gt;/);
  assert.match(orderReceivedEmail(order).html, /Ankara dress/);
  assert.match(orderReceivedEmail(order).html, /₦22,000/);
  assert.match(adminNewOrderEmail(order).text, /customer@example\.com/);
  assert.match(paymentConfirmedEmail(order).html, /PAY-123/);
  assert.match(adminPaymentConfirmedEmail(order).html, /card/);
  assert.match(orderStatusEmail({ order, status: "cancelled" }).html, /cancelled/);
  assert.equal(contactNotificationEmail({
    name: "Customer",
    email: "customer@example.com",
    message: "Hello there",
    messageId: "message-123",
  }).replyTo, "customer@example.com");
});

test("order emails identify redeemed promotional codes", () => {
  const promoOrder = { ...order, promoCode: "STITCH10", promoCampaignName: "Stitch into savings" };
  assert.match(orderReceivedEmail(promoOrder).html, /STITCH10 \(Stitch into savings\)/);
  assert.match(adminNewOrderEmail(promoOrder).text, /Promo code: STITCH10/);
});

test("best-effort notifications report SMTP configuration failures without throwing", async () => {
  const keys = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"];
  const previous = new Map(keys.map((key) => [key, process.env[key]]));
  const originalError = console.error;
  const logged = [];

  for (const key of keys) delete process.env[key];
  console.error = (...args) => logged.push(args);

  try {
    const sent = await sendBestEffortMail({
      event: "Test notification",
      to: "customer@example.com",
      subject: "Test",
      text: "Test",
    });

    assert.equal(sent, false);
    assert.equal(logged.length, 1);
    assert.match(String(logged[0][0]), /Test notification email failed/);
  } finally {
    console.error = originalError;
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
