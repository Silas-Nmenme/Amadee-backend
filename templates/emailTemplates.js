
const BRAND = "Amadee-Stiches";

const WEBSITE_URL =
  process.env.STOREFRONT_URL || "http://localhost:5500";

/* -------------------------------------------------------------------------- */
/* HTML HELPERS                                                               */
/* -------------------------------------------------------------------------- */

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

function formatNaira(amount = 0) {
  return `₦${Number(amount || 0).toLocaleString("en-NG")}`;
}

function emailLayout({ title, preheader, content }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;background:#f5f2ed;font-family:Arial,sans-serif;color:#25221f">
  <div style="display:none;max-height:0;overflow:hidden">
    ${escapeHtml(preheader)}
  </div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
    style="background:#f5f2ed;padding:28px 12px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
          style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden">

          <tr>
            <td style="background:#211c19;padding:28px 24px;text-align:center">
              <div style="color:#fff;font-size:23px;font-weight:bold;letter-spacing:1px">
                ${BRAND}
              </div>
              <div style="color:#d8c7ad;font-size:11px;letter-spacing:2px;margin-top:8px">
                MADE WITH CARE
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:30px 24px;line-height:1.7">
              <h1 style="font-size:23px;line-height:1.3;margin:0 0 18px">
                ${escapeHtml(title)}
              </h1>

              ${content}

              <p style="font-size:14px;margin-top:28px">
                With care,<br>
                <strong>The ${BRAND} Team</strong>
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 24px;background:#f8f6f2;text-align:center;color:#716a62;font-size:12px;line-height:1.7">
              <a href="${escapeHtml(WEBSITE_URL)}" style="color:#5b4030">
                Visit our store
              </a>
              <p style="margin:8px 0 0">
                If you need help, contact our customer support team.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function button(label, url = WEBSITE_URL) {
  return `<p style="margin:24px 0">
    <a href="${escapeHtml(url)}"
      style="display:inline-block;background:#211c19;color:#fff;padding:13px 22px;border-radius:5px;text-decoration:none;font-weight:bold">
      ${escapeHtml(label)}
    </a>
  </p>`;
}

/* -------------------------------------------------------------------------- */
/* EMAIL VERIFICATION                                                         */
/* -------------------------------------------------------------------------- */

export function verificationEmail({ name, otp, minutes }) {
  const safeName = escapeHtml(name);
  const safeOtp = escapeHtml(otp);
  const expiry = Number(minutes) || 10;

  return {
    subject: "Verify your email | Amadee-Stiches",

    text: `Hello ${name}, your verification code is ${otp}. It expires in ${expiry} minutes. If you did not create this account, ignore this email.`,

    html: emailLayout({
      title: "Welcome to Amadee-Stiches",
      preheader: "Verify your email address to activate your account.",

      content: `
        <p>Hello ${safeName},</p>
        <p>Thank you for creating an account. Use the code below to verify your email:</p>

        <div style="background:#f5f2ed;padding:18px;text-align:center;font-size:30px;font-weight:bold;letter-spacing:8px">
          ${safeOtp}
        </div>

        <p>This code expires in <strong>${expiry} minutes</strong>.</p>
        <p>If you did not create this account, you can ignore this email.</p>
      `,
    }),
  };
}

/* -------------------------------------------------------------------------- */
/* PASSWORD RESET                                                             */
/* -------------------------------------------------------------------------- */

export function passwordResetEmail({ otp }) {
  const safeOtp = escapeHtml(otp);

  return {
    subject: "Your password reset code | Amadee-Stiches",

    text: `Your password reset code is ${otp}. It expires in 10 minutes. If you did not request a password reset, ignore this email.`,

    html: emailLayout({
      title: "Reset your password",
      preheader: "Your password reset code expires in 10 minutes.",

      content: `
        <p>We received a request to reset your password.</p>

        <div style="background:#f5f2ed;padding:18px;text-align:center;font-size:30px;font-weight:bold;letter-spacing:8px">
          ${safeOtp}
        </div>

        <p>This code expires in <strong>10 minutes</strong>.</p>
        <p>Never share it with anyone. If you did not request this, you can ignore this email.</p>
      `,
    }),
  };
}

/* -------------------------------------------------------------------------- */
/* ORDER RECEIVED                                                             */
/* -------------------------------------------------------------------------- */

export function orderReceivedEmail(order) {
  const customerName = order.customer?.name || "Customer";
  const orderId = order.orderId || "Pending";
  const items = Array.isArray(order.items) ? order.items : [];

  const rows = items.map((item) => `
    <tr>
      <td style="padding:10px 4px;border-bottom:1px solid #eee">
        ${escapeHtml(item.name)} × ${Number(item.quantity || 0)}
        <br>
        <small>
          Size: ${escapeHtml(item.size || "Not specified")}
          · Colour: ${escapeHtml(item.colour || "Not specified")}
        </small>
      </td>
      <td align="right" style="padding:10px 4px;border-bottom:1px solid #eee">
        ${formatNaira(item.lineTotal)}
      </td>
    </tr>
  `).join("");

  const paymentNote =
    order.paymentMethod === "paystack"
      ? "Your order is awaiting verified online payment."
      : order.paymentMethod === "bank_transfer"
        ? "Your order has been received. It will remain unpaid until the transfer is verified."
        : "Your order has been received. Our team will contact you to confirm the next steps.";

  const total = Number(order.total || 0);
  const deliveryFee = Number(order.deliveryFee || 0);

  return {
    subject: `Order received: ${orderId} | Amadee-Stiches`,

    text: [
      `Hello ${customerName},`,
      `We received your order ${orderId}.`,
      `Total: NGN ${total.toLocaleString("en-NG")}.`,
      `Payment status: ${order.paymentStatus || "pending"}.`,
      paymentNote,
    ].join("\n"),

    html: emailLayout({
      title: "We've received your order",
      preheader: `Order ${orderId} has been received.`,

      content: `
        <p>Hello ${escapeHtml(customerName)},</p>
        <p>Thank you for choosing us. Your order reference is:</p>

        <p style="font-size:20px;font-weight:bold">
          ${escapeHtml(orderId)}
        </p>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          ${rows}

          <tr>
            <td style="padding:16px 4px"><strong>Delivery</strong></td>
            <td align="right">${formatNaira(deliveryFee)}</td>
          </tr>

          <tr>
            <td style="padding:12px 4px"><strong>Total</strong></td>
            <td align="right" style="font-size:19px;font-weight:bold">
              ${formatNaira(total)}
            </td>
          </tr>
        </table>

        <p>${escapeHtml(paymentNote)}</p>

        <p>
          Payment status:
          <strong>${escapeHtml(order.paymentStatus || "pending")}</strong>
        </p>

        ${button("Visit our store")}
      `,
    }),
  };
}

/* -------------------------------------------------------------------------- */
/* PAYMENT CONFIRMED                                                          */
/* -------------------------------------------------------------------------- */

export function paymentConfirmedEmail(order) {
  const customerName = order.customer?.name || "Customer";
  const orderId = order.orderId || "Pending";
  const total = Number(order.total || 0);

  return {
    subject: `Payment confirmed: ${orderId} | Amadee-Stiches`,

    text: [
      `Hello ${customerName},`,
      `Payment for order ${orderId} has been confirmed.`,
      `Amount paid: NGN ${total.toLocaleString("en-NG")}.`,
      "We'll keep you updated as your outfit moves through production.",
    ].join("\n"),

    html: emailLayout({
      title: "Payment confirmed",
      preheader: `Payment for order ${orderId} has been verified.`,

      content: `
        <p>Hello ${escapeHtml(customerName)},</p>
        <p>We've successfully verified your payment.</p>

        <p>
          Order reference:
          <strong>${escapeHtml(orderId)}</strong>
        </p>

        <p>
          Amount paid:
          <strong>${formatNaira(total)}</strong>
        </p>

        <p>We'll keep you updated as your outfit moves through production.</p>

        ${button("Visit our store")}
      `,
    }),
  };
}

/* -------------------------------------------------------------------------- */
/* ORDER STATUS UPDATE                                                        */
/* -------------------------------------------------------------------------- */

export function orderStatusEmail({ order, status }) {
  const customerName = order.customer?.name || "Customer";
  const orderId = order.orderId || "Pending";

  const labels = {
    received: "Order received",
    confirmed: "Order confirmed",
    in_production: "Your outfit is in production",
    ready: "Your outfit is ready",
    dispatched: "Your order has been dispatched",
    completed: "Your order is complete",
    cancelled: "Your order has been cancelled",
  };

  const title = labels[status] || "Your order status has changed";

  return {
    subject: `${title} | ${orderId} | Amadee-Stiches`,

    text: [
      `Hello ${customerName},`,
      `There is an update on your Amadee-Stiches order ${orderId}.`,
      `Current status: ${title}.`,
    ].join("\n"),

    html: emailLayout({
      title,
      preheader: `An update about order ${orderId}.`,

      content: `
        <p>Hello ${escapeHtml(customerName)},</p>
        <p>There is an update on your Amadee-Stiches order.</p>

        <p>
          Order reference:
          <strong>${escapeHtml(orderId)}</strong>
        </p>

        <p>
          Current status:
          <strong>${escapeHtml(title)}</strong>
        </p>

        ${button("Visit our store")}
      `,
    }),
  };
}

/* -------------------------------------------------------------------------- */
/* NEWSLETTER WELCOME                                                         */
/* -------------------------------------------------------------------------- */

export function newsletterWelcomeEmail(email) {
  const safeEmail = escapeHtml(email);

  return {
    subject: "Welcome to the Amadee-Stiches newsletter",

    text: `Thank you for subscribing, ${email}. You'll receive updates from Amadee-Stiches.`,

    html: emailLayout({
      title: "You're on the list",
      preheader: "Thank you for subscribing to our updates.",

      content: `
        <p>Thank you for subscribing to Amadee-Stiches.</p>
        <p>Look out for updates about our latest designs, collections, and offers.</p>
        <p>Subscription email: <strong>${safeEmail}</strong></p>

        ${button("Explore the collection")}
      `,
    }),
  };
}
