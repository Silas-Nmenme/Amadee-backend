const BRAND = "Amadee-Stiches";
const WEBSITE_URL = (
  process.env.STOREFRONT_URL || "https://amadee.vercel.app"
).replace(/\/+$/, "");
const LOGO_URL = `${WEBSITE_URL}/assets/images/logo.svg`;
const TEAL = "#168da0";
const DEEP_TEAL = "#0e5965";
const GOLD = "#f3c84b";
const GREEN = "#21864c";

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
  const value = Number(amount);
  return `₦${(Number.isFinite(value) ? value : 0).toLocaleString("en-NG")}`;
}

function emailLayout({ title, preheader, content }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>${escapeHtml(title)}</title>
  <style>
    body,table,td,p,a { font-family:Arial,Helvetica,sans-serif; }
    @media screen and (max-width:620px) {
      .email-shell { width:100% !important; }
      .email-body { padding:26px 20px !important; }
      .email-gutter { padding:18px 10px !important; }
      .email-title { font-size:25px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f2f7f5;color:#1c292a;font-family:Arial,Helvetica,sans-serif">
  <div style="display:none;font-size:1px;color:#f2f7f5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">
    ${escapeHtml(preheader)}
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f2f7f5">
    <tr>
      <td class="email-gutter" align="center" style="padding:36px 16px">
        <table class="email-shell" role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 12px 36px rgba(9,47,53,.10)">
          <tr>
            <td style="height:7px;background:${TEAL};background-image:linear-gradient(90deg,${TEAL} 0%,${GREEN} 68%,${GOLD} 100%);font-size:0;line-height:0">&nbsp;</td>
          </tr>
          <tr>
            <td align="center" style="padding:27px 24px 23px;background:#ffffff">
              <a href="${escapeHtml(WEBSITE_URL)}" style="display:inline-block;text-decoration:none;color:${DEEP_TEAL}">
                <img src="${escapeHtml(LOGO_URL)}" width="56" height="56" alt="${BRAND} logo" style="display:block;width:56px;height:56px;margin:0 auto 9px;border:0">
                <span style="font-size:19px;font-weight:700;letter-spacing:.3px">${BRAND}</span>
              </a>
              <div style="margin-top:7px;color:#647476;font-size:10px;font-weight:bold;letter-spacing:2px">MADE WITH CARE · TAILORED FOR YOU</div>
            </td>
          </tr>
          <tr>
            <td class="email-body" style="padding:34px 42px 38px;line-height:1.65">
              <h1 class="email-title" style="margin:0 0 17px;color:${DEEP_TEAL};font-size:29px;line-height:1.25">${escapeHtml(title)}</h1>
              ${content}
              <p style="margin:30px 0 0;color:#43595b;font-size:14px">With care,<br><strong>The ${BRAND} Team</strong></p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:22px 24px;background:#e7f5f5;border-top:1px solid #dcebe8;color:#52686a;font-size:12px;line-height:1.7">
              <a href="${escapeHtml(WEBSITE_URL)}" style="color:${DEEP_TEAL};font-weight:bold;text-decoration:none">Visit our official website</a>
              <p style="margin:7px 0 0">Questions? Reply to this email and our team will be happy to help.</p>
              <p style="margin:5px 0 0;color:#718183">© ${new Date().getFullYear()} ${BRAND}</p>
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
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0">
    <tr><td bgcolor="${TEAL}" style="border-radius:8px">
      <a href="${escapeHtml(url)}" style="display:inline-block;padding:13px 22px;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none;border:1px solid ${TEAL};border-radius:8px">${escapeHtml(label)}</a>
    </td></tr>
  </table>`;
}

function infoPanel(content, background = "#e7f5f5") {
  return `<div style="margin:20px 0;padding:17px 19px;background:${background};border-left:4px solid ${TEAL};border-radius:8px">${content}</div>`;
}

function detailTable(rows) {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:18px 0;border-collapse:collapse">${rows.map(([label, value]) => `<tr>
    <td style="padding:9px 5px;border-bottom:1px solid #e8efed;color:#647476;font-size:13px">${escapeHtml(label)}</td>
    <td align="right" style="padding:9px 5px;border-bottom:1px solid #e8efed;color:#1c292a;font-size:13px;font-weight:bold">${escapeHtml(value)}</td>
  </tr>`).join("")}</table>`;
}

function orderItemRows(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  return items.map((item) => {
    const quantity = Number(item.quantity) || 0;
    const variants = [
      item.size ? `Size: ${item.size}` : "",
      item.colour ? `Colour: ${item.colour}` : "",
    ].filter(Boolean).join(" · ");

    return `<tr>
      <td style="padding:12px 5px;border-bottom:1px solid #e8efed;color:#1c292a;font-size:13px">
        <strong>${escapeHtml(item.name || "Item")} × ${quantity}</strong>
        ${variants ? `<br><span style="color:#718183;font-size:12px">${escapeHtml(variants)}</span>` : ""}
      </td>
      <td align="right" style="padding:12px 5px;border-bottom:1px solid #e8efed;color:#1c292a;font-size:13px;font-weight:bold">${formatNaira(item.lineTotal)}</td>
    </tr>`;
  }).join("");
}

function orderSummary(order) {
  const rows = [
    ["Subtotal", formatNaira(order.subtotal)],
    ...(order.promoCode ? [["Promo code", `${order.promoCode}${order.promoCampaignName ? ` (${order.promoCampaignName})` : ""}`]] : []),
    ["Discount", formatNaira(order.discount)],
    ["Delivery", formatNaira(order.deliveryFee)],
    ["Total", formatNaira(order.total)],
  ];
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse">
    ${orderItemRows(order)}
    ${rows.map(([label, value], index) => `<tr>
      <td style="padding:${index === rows.length - 1 ? "13px 5px" : "8px 5px"};${index === rows.length - 1 ? `border-top:2px solid ${TEAL};` : ""}color:${index === rows.length - 1 ? DEEP_TEAL : "#647476"};font-size:${index === rows.length - 1 ? "15px" : "13px"};font-weight:${index === rows.length - 1 ? "bold" : "normal"}">${label}</td>
      <td align="right" style="padding:${index === rows.length - 1 ? "13px 5px" : "8px 5px"};${index === rows.length - 1 ? `border-top:2px solid ${TEAL};` : ""}color:${index === rows.length - 1 ? DEEP_TEAL : "#1c292a"};font-size:${index === rows.length - 1 ? "17px" : "13px"};font-weight:bold">${value}</td>
    </tr>`).join("")}
  </table>`;
}

function plainOrderSummary(order) {
  const items = (order.items || []).map((item) =>
    `${item.name} × ${Number(item.quantity) || 0}: ${formatNaira(item.lineTotal)}`
  );
  return [
    ...items,
    `Subtotal: ${formatNaira(order.subtotal)}`,
    ...(order.promoCode ? [`Promo code: ${order.promoCode}${order.promoCampaignName ? ` (${order.promoCampaignName})` : ""}`] : []),
    `Discount: ${formatNaira(order.discount)}`,
    `Delivery: ${formatNaira(order.deliveryFee)}`,
    `Total: ${formatNaira(order.total)}`,
  ].join("\n");
}

export function verificationEmail({ name, otp, minutes }) {
  const expiry = Number(minutes) || 10;
  return {
    subject: `Verify your email | ${BRAND}`,
    text: `Hello ${name}, your verification code is ${otp}. It expires in ${expiry} minutes. If you did not create this account, ignore this email.`,
    html: emailLayout({
      title: "Welcome to Amadee-Stiches",
      preheader: "Verify your email address to activate your account.",
      content: `<p>Hello ${escapeHtml(name)},</p>
        <p>Thank you for creating an account. Enter this code to verify your email address:</p>
        ${infoPanel(`<div style="color:${DEEP_TEAL};font-size:31px;font-weight:bold;letter-spacing:9px;text-align:center">${escapeHtml(otp)}</div>`)}
        <p>This code expires in <strong>${expiry} minutes</strong>. Never share it with anyone.</p>
        <p style="color:#647476;font-size:13px">If you did not create this account, you can ignore this email.</p>`,
    }),
  };
}

export function passwordResetEmail({ otp }) {
  return {
    subject: `Your password reset code | ${BRAND}`,
    text: `Your password reset code is ${otp}. It expires in 10 minutes. If you did not request a password reset, ignore this email.`,
    html: emailLayout({
      title: "Reset your password",
      preheader: "Your password reset code expires in 10 minutes.",
      content: `<p>We received a request to reset your password.</p>
        ${infoPanel(`<div style="color:${DEEP_TEAL};font-size:31px;font-weight:bold;letter-spacing:9px;text-align:center">${escapeHtml(otp)}</div>`, "#fbf4e6")}
        <p>This code expires in <strong>10 minutes</strong>. Never share it with anyone.</p>
        <p style="color:#647476;font-size:13px">If you did not request this, you can ignore this email.</p>`,
    }),
  };
}

export function passwordChangedEmail(user) {
  const name = user.name || "there";
  return {
    subject: `Your password was changed | ${BRAND}`,
    text: `Hello ${name}, your Amadee-Stiches password was changed. If you did not make this change, contact us immediately at ${WEBSITE_URL}.`,
    html: emailLayout({
      title: "Your password was changed",
      preheader: "A password change was made to your Amadee-Stiches account.",
      content: `<p>Hello ${escapeHtml(name)},</p>
        <p>This is a confirmation that your account password was changed.</p>
        ${infoPanel("<strong>If you made this change, no further action is needed.</strong>", "#e7f5f5")}
        <p>If you did not change your password, please contact our team immediately to secure your account.</p>
        ${button("Visit our store")}`,
    }),
  };
}

export function accountWelcomeEmail(user) {
  const name = user.name || "there";
  return {
    subject: `Your email is verified | ${BRAND}`,
    text: `Hello ${name}, your email is verified and your Amadee-Stiches account is ready. Visit ${WEBSITE_URL} to explore the collection.`,
    html: emailLayout({
      title: "Your account is ready",
      preheader: "Your email has been verified. Welcome to Amadee-Stiches.",
      content: `<p>Hello ${escapeHtml(name)},</p>
        <p>Your email address is verified and your account is ready. We’re delighted to have you with us.</p>
        ${infoPanel("<strong>Thoughtful Nigerian fashion, made with care.</strong>")}
        ${button("Explore the collection")}`,
    }),
  };
}

export function adminNewRegistrationEmail(user) {
  const name = user.name || "Customer";
  const email = user.email || "";
  const role = user.role || "customer";
  return {
    subject: `New ${role} registration | ${BRAND}`,
    text: `A new ${role} account was registered.\nName: ${name}\nEmail: ${email}\nVerification status: ${user.verified ? "verified" : "pending"}`,
    html: emailLayout({
      title: "New account registration",
      preheader: `${name} registered for an Amadee-Stiches account.`,
      content: `<p>A new account has been created.</p>
        ${detailTable([
          ["Name", name],
          ["Email", email],
          ["Account type", role],
          ["Email verified", user.verified ? "Yes" : "Pending"],
        ])}`,
    }),
  };
}

export function orderReceivedEmail(order) {
  const customerName = order.customer?.name || "Customer";
  const orderId = order.orderId || "Pending";
  const paymentNote = order.paymentMethod === "paystack"
    ? "Your order is awaiting verified online payment."
    : order.paymentMethod === "bank_transfer"
      ? "Your order has been received. It remains unpaid until the transfer is verified."
      : "Your order has been received. Our team will contact you to confirm the next steps.";

  return {
    subject: `Order received: ${orderId} | ${BRAND}`,
    text: [
      `Hello ${customerName},`,
      `We received your order ${orderId}.`,
      plainOrderSummary(order),
      `Payment method: ${order.paymentMethod || "Not specified"}`,
      `Payment status: ${order.paymentStatus || "pending"}`,
      paymentNote,
    ].join("\n"),
    html: emailLayout({
      title: "We’ve received your order",
      preheader: `Order ${orderId} has been received.`,
      content: `<p>Hello ${escapeHtml(customerName)},</p>
        <p>Thank you for choosing us. Your order reference is:</p>
        ${infoPanel(`<strong style="color:${DEEP_TEAL};font-size:19px">${escapeHtml(orderId)}</strong>`)}
        ${orderSummary(order)}
        ${detailTable([
          ["Payment method", order.paymentMethod || "Not specified"],
          ["Payment status", order.paymentStatus || "pending"],
          ["Delivery option", order.deliveryOption || "Not specified"],
        ])}
        <p>${escapeHtml(paymentNote)}</p>
        ${button("Visit our store")}`,
    }),
  };
}

export function adminNewOrderEmail(order) {
  const customer = order.customer || {};
  const orderId = order.orderId || "Pending";
  return {
    subject: `New order ${orderId} | ${BRAND}`,
    text: [
      `New order: ${orderId}`,
      `Customer: ${customer.name || "Customer"} (${customer.email || "No email"})`,
      `Phone: ${customer.phone || "Not provided"}`,
      `Address: ${customer.address || "Not provided"}`,
      `Delivery option: ${order.deliveryOption || "Not specified"}`,
      `Payment method: ${order.paymentMethod || "Not specified"}`,
      `Payment status: ${order.paymentStatus || "pending"}`,
      "",
      plainOrderSummary(order),
    ].join("\n"),
    html: emailLayout({
      title: "A new order has arrived",
      preheader: `New order ${orderId} from ${customer.name || "a customer"}.`,
      content: `<p>A customer has placed a new order.</p>
        ${infoPanel(`<strong style="color:${DEEP_TEAL};font-size:19px">${escapeHtml(orderId)}</strong>`)}
        ${detailTable([
          ["Customer", customer.name || "Customer"],
          ["Email", customer.email || "Not provided"],
          ["Phone", customer.phone || "Not provided"],
          ["Delivery address", customer.address || "Not provided"],
          ["Delivery option", order.deliveryOption || "Not specified"],
          ["Payment method", order.paymentMethod || "Not specified"],
          ["Payment status", order.paymentStatus || "pending"],
        ])}
        <h2 style="margin:24px 0 8px;color:${DEEP_TEAL};font-size:17px">Order details</h2>
        ${orderSummary(order)}`,
    }),
  };
}

export function paymentConfirmedEmail(order) {
  const customerName = order.customer?.name || "Customer";
  const orderId = order.orderId || "Pending";
  return {
    subject: `Payment confirmed: ${orderId} | ${BRAND}`,
    text: [
      `Hello ${customerName},`,
      `Payment for order ${orderId} has been confirmed.`,
      `Amount paid: ${formatNaira(order.total)}.`,
      `Payment reference: ${order.paymentReference || orderId}.`,
      "We’ll keep you updated as your outfit moves through production.",
    ].join("\n"),
    html: emailLayout({
      title: "Payment confirmed",
      preheader: `Payment for order ${orderId} has been verified.`,
      content: `<p>Hello ${escapeHtml(customerName)},</p>
        <p>We’ve successfully verified your payment. Thank you!</p>
        ${infoPanel(`<strong style="color:${GREEN};font-size:17px">Payment received</strong>`)}
        ${detailTable([
          ["Order reference", orderId],
          ["Amount paid", formatNaira(order.total)],
          ["Payment reference", order.paymentReference || orderId],
          ["Payment channel", order.paymentChannel || "Paystack"],
          ["Paid at", order.paidAt ? new Date(order.paidAt).toLocaleString("en-NG") : "Recently"],
        ])}
        <p>We’ll keep you updated as your outfit moves through production.</p>
        ${button("Visit our store")}`,
    }),
  };
}

export function adminPaymentConfirmedEmail(order) {
  const customer = order.customer || {};
  const orderId = order.orderId || "Unknown";
  return {
    subject: `Payment received for ${orderId} | ${BRAND}`,
    text: `Payment confirmed for order ${orderId}.\nCustomer: ${customer.name || "Customer"} (${customer.email || "No email"})\nAmount: ${formatNaira(order.total)}\nReference: ${order.paymentReference || orderId}\nChannel: ${order.paymentChannel || "Paystack"}`,
    html: emailLayout({
      title: "Payment received",
      preheader: `Payment confirmed for order ${orderId}.`,
      content: `<p>A customer payment has been verified.</p>
        ${detailTable([
          ["Order reference", orderId],
          ["Customer", customer.name || "Customer"],
          ["Email", customer.email || "Not provided"],
          ["Amount received", formatNaira(order.total)],
          ["Payment reference", order.paymentReference || orderId],
          ["Payment channel", order.paymentChannel || "Paystack"],
          ["Paid at", order.paidAt ? new Date(order.paidAt).toLocaleString("en-NG") : "Recently"],
        ])}`,
    }),
  };
}

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
  const note = order.statusHistory?.at(-1)?.note || "";
  return {
    subject: `${title} | ${orderId} | ${BRAND}`,
    text: [
      `Hello ${customerName},`,
      `There is an update on your order ${orderId}.`,
      `Current status: ${title}.`,
      ...(note ? [`Update: ${note}`] : []),
    ].join("\n"),
    html: emailLayout({
      title,
      preheader: `An update about order ${orderId}.`,
      content: `<p>Hello ${escapeHtml(customerName)},</p>
        <p>There is an update on your Amadee-Stiches order.</p>
        ${infoPanel(`<strong style="color:${DEEP_TEAL}">${escapeHtml(title)}</strong>`)}
        ${detailTable([
          ["Order reference", orderId],
          ["Current status", title],
        ])}
        ${note ? `<p>${escapeHtml(note)}</p>` : ""}
        ${status === "cancelled" ? "<p>If you have questions about this cancellation, reply to this email and our team will assist.</p>" : ""}
        ${button("Visit our store")}`,
    }),
  };
}

export function orderRequestEmail({ order, request, audience }) {
  const isAdmin = audience === "admin";
  const customerName = order.customer?.name || "Customer";
  const type = request.type === "return" ? "return" : "cancellation";
  const status = request.status || "pending";
  const title = isAdmin
    ? `Order ${type} request needs review`
    : status === "pending"
      ? `We received your ${type} request`
      : status === "refunded"
        ? "Your refund has been recorded"
        : `Your ${type} request was ${status}`;
  const details = [
    ["Order reference", order.orderId || "Unknown"],
    ["Request type", type],
    ["Request status", status],
    ["Reason", request.reason || "Not provided"],
    ...(request.reviewNote ? [["Shop response", request.reviewNote]] : []),
    ...(order.refundReference ? [["Refund reference", order.refundReference]] : []),
  ];

  return {
    subject: `${title} | ${order.orderId || "Order"} | ${BRAND}`,
    text: [
      isAdmin ? "A customer submitted an order request." : `Hello ${customerName},`,
      `Order: ${order.orderId || "Unknown"}`,
      `Request: ${type} (${status})`,
      `Reason: ${request.reason || "Not provided"}`,
      ...(request.reviewNote ? [`Shop response: ${request.reviewNote}`] : []),
      ...(order.refundReference ? [`Refund reference: ${order.refundReference}`] : []),
    ].join("\n"),
    html: emailLayout({
      title,
      preheader: `Order ${order.orderId || "Unknown"} · ${type} request · ${status}.`,
      content: `${isAdmin ? `<p>${escapeHtml(customerName)} submitted a ${type} request.</p>` : `<p>Hello ${escapeHtml(customerName)},</p>`}
        ${detailTable(details)}
        ${isAdmin ? `<p>Review this request in the administrator dashboard.</p>` : ""}
        ${button(isAdmin ? "Open admin dashboard" : "View your order")}`,
    }),
  };
}

export function orderTrackingEmail(order) {
  const customerName = order.customer?.name || "Customer";
  const tracking = order.tracking || {};
  const details = [
    ["Order reference", order.orderId || "Unknown"],
    ["Carrier", tracking.carrier || "Not specified"],
    ["Tracking number", tracking.trackingNumber || "Not specified"],
    ["Order status", String(order.orderStatus || "").replaceAll("_", " ")],
    ...(tracking.note ? [["Shop note", tracking.note]] : []),
  ];

  return {
    subject: `Shipment tracking updated | ${order.orderId || "Order"} | ${BRAND}`,
    text: [
      `Hello ${customerName},`,
      `Shipment tracking details for order ${order.orderId || "Unknown"} were updated.`,
      ...details.map(([label, value]) => `${label}: ${value}`),
      ...(tracking.trackingUrl ? [`Tracking link: ${tracking.trackingUrl}`] : []),
    ].join("\n"),
    html: emailLayout({
      title: "Shipment tracking updated",
      preheader: `New delivery information for order ${order.orderId || "Unknown"}.`,
      content: `<p>Hello ${escapeHtml(customerName)},</p>
        <p>There is new delivery information for your order.</p>
        ${detailTable(details)}
        ${tracking.trackingUrl ? button("Track your order", tracking.trackingUrl) : ""}`,
    }),
  };
}

export function contactNotificationEmail({ name, email, message, messageId }) {
  return {
    subject: `New customer enquiry | ${BRAND}`,
    text: `New customer enquiry\nName: ${name}\nEmail: ${email}\nMessage ID: ${messageId}\n\n${message}`,
    replyTo: email,
    html: emailLayout({
      title: "A customer got in touch",
      preheader: `New enquiry from ${name}.`,
      content: `<p>A new message was submitted through the store contact form.</p>
        ${detailTable([
          ["Name", name],
          ["Email", email],
          ["Message ID", messageId],
        ])}
        ${infoPanel(`<p style="margin:0;white-space:pre-wrap">${escapeHtml(message)}</p>`, "#fbf4e6")}
        <p style="color:#647476;font-size:13px">Reply directly to this email to contact the customer.</p>`,
    }),
  };
}

export function newsletterWelcomeEmail(email, unsubscribeToken = "") {
  const unsubscribeUrl = `${WEBSITE_URL}/unsubscribe.html?token=${encodeURIComponent(unsubscribeToken)}`;
  return {
    subject: `Welcome to the ${BRAND} newsletter`,
    text: `Thank you for subscribing, ${email}. You'll receive updates from Amadee-Stiches. Unsubscribe: ${unsubscribeUrl}`,
    html: emailLayout({
      title: "You’re on the list",
      preheader: "Thank you for subscribing to our updates.",
      content: `<p>Thank you for subscribing to Amadee-Stiches.</p>
        <p>Look out for updates about our latest designs, collections, and offers.</p>
        ${infoPanel(`<strong>${escapeHtml(email)}</strong>`)}
        ${button("Explore the collection")}
        <p style="color:#647476;font-size:12px">Prefer not to receive updates? <a href="${escapeHtml(unsubscribeUrl)}" style="color:${DEEP_TEAL}">Unsubscribe</a>.</p>`,
    }),
  };
}

export function newsletterNotificationEmail(email) {
  return {
    subject: `New newsletter subscriber | ${BRAND}`,
    text: `A new subscriber joined the newsletter: ${email}`,
    html: emailLayout({
      title: "A new subscriber joined",
      preheader: "A customer subscribed to store updates.",
      content: `<p>A new email address has subscribed to collection updates.</p>
        ${infoPanel(`<strong>${escapeHtml(email)}</strong>`)}`,
    }),
  };
}

export function reviewNotificationEmail(review) {
  const name = review.name || "Customer";
  return {
    subject: `New customer review awaiting moderation | ${BRAND}`,
    text: `A new review is awaiting moderation.\nName: ${name}\nRating: ${review.rating}/5\n\n${review.message}`,
    html: emailLayout({
      title: "A new review needs your attention",
      preheader: `${name} submitted a review for moderation.`,
      content: `<p>A customer review has been submitted and is waiting for approval.</p>
        ${detailTable([
          ["Customer", name],
          ["Rating", `${review.rating}/5`],
          ["Submitted", review.createdAt ? new Date(review.createdAt).toLocaleString("en-NG") : "Just now"],
        ])}
        ${infoPanel(`<p style="margin:0;white-space:pre-wrap">${escapeHtml(review.message)}</p>`, "#fbf4e6")}`,
    }),
  };
}
