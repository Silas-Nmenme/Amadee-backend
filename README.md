# Amadee-backend

## Frontend/API integration

The static storefront in `frontend/` sends production API requests to its own
`/api` path. `frontend/vercel.json` proxies that path to
`https://amadee-backend.vercel.app/api`, keeping the HttpOnly session cookie
first-party in mobile browsers. Deploy the `frontend/` directory as the Vercel
project root for this rewrite to apply. Local development defaults to
`http://localhost:3000/api`. Set `window.AMADEE_API_URL` before loading the
frontend modules to override either API base URL. The backend permits the
production storefront origin, `https://amadee.vercel.app`, and uses credentialed
CORS for the session cookie. Deployments on another host need the equivalent
same-origin `/api` proxy configured there.
The session cookie defaults to `SameSite=Lax`; keep the API proxy same-origin.
Set `JWT_COOKIE_SAME_SITE=None` only for a deployment that intentionally uses a
cross-site API, since mobile browser privacy protections may block its cookie.

Configure additional exact origins with `FRONTEND_ORIGINS` as a comma-separated
list; the legacy `FRONTEND_ORIGIN` setting is also supported. Localhost origins
are allowed only outside production. Do not configure wildcard origins when
credentials are enabled.
Set `OTP_SECRET` to a random secret of at least 32 characters for keyed OTP
hashing; `JWT_SECRET` is used as a fallback when `OTP_SECRET` is not set.

The storefront uses the backend's email/OTP/JWT authentication, product,
order, review, contact, newsletter, and account-preference endpoints. Cart and
wishlist selections sync to the signed-in account; guest selections are kept
locally and merged on the first sign-in. Order creation requires authentication,
and customers can only see orders associated with their account. The bundled
product list remains available when the backend catalogue is empty; checkout
requires sign-in even when the storefront offers a WhatsApp order-request
fallback.

Emails use the configured SMTP settings (`SMTP_HOST`, `SMTP_PORT`,
`SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and optional `MAIL_FROM`). Set
`SHOP_OWNER_EMAIL` to receive new account, order, payment, contact, newsletter,
and review notifications. The responsive email templates load the official
store logo from `${STOREFRONT_URL}/assets/images/logo.svg` (default:
`https://amadee.vercel.app/assets/images/logo.svg`). Customer verification and
password-reset delivery remains required for those flows. Password reset is
enabled by default; set `PASSWORD_RESET_ENABLED=false` only to disable it.
Reset-email delivery errors are logged with SMTP diagnostics (without message
content or credentials). Order, payment,
contact, newsletter, review, and account-notice delivery failures are logged
without undoing the related action.

Signed-in customers can manage their profile and view their complete, account-
scoped order history with item images and order details at `frontend/account.html`.
Orders submitted with a valid session are associated with that customer.
Administrators can manage orders, inventory, catalogue
products, promo campaigns, subscribers, and summary metrics at
`frontend/admin.html`; the backend enforces administrator authorization on each
management endpoint.

The order dashboard also supports shipment tracking and customer cancellation
or return requests. Customers can request cancellation before dispatch and
request a return after completion; the backend verifies ownership and order
eligibility. Administrators can review requests, update carrier/tracking
details, and notify customers by email. For paid orders, a refund can only be
recorded after an administrator completes it with the payment provider or bank
and supplies the completed refund reference; the dashboard does not initiate
money transfers. Order tracking and request records are available in the
customer's account-scoped order history.

The lifecycle endpoints are `POST /api/orders/:orderId/requests` for an
authenticated customer's request, `PATCH /api/orders/:orderId/tracking` for
admin tracking updates, `PATCH /api/orders/:orderId/requests/:requestId` for
admin approval or rejection, and
`POST /api/orders/:orderId/requests/:requestId/refund` to record a completed
manual refund. These admin endpoints require administrator authorization.
To bootstrap the single administrator, configure a random
`ADMIN_REGISTRATION_KEY` of at least 32 characters in the backend environment.
Send `POST /api/auth/register-admin` with the same JSON body as normal signup:
`{ "name", "email", "password" }`, and provide the setup key in the
`x-admin-registration-key` header. Generate a key locally with
`node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`
and store it only in the backend environment and your private Postman
environment. The new administrator can use any email and must complete emailed
OTP verification before signing in. The setup key is never sent from the
browser. A database-backed `AdminBootstrap` record makes the setup one-time;
ordinary `/api/auth/signup` registrations cannot create admin accounts.

Admins can create and edit percentage or fixed-amount promo campaigns, limit
redemptions, set expiry and minimum-order conditions, restrict eligible product
codes, and publish announcements. Campaign management is available at
`/api/admin/promos`; customers can preview a code at `/api/promos/validate`,
and authenticated order creation revalidates the code and reserves its usage
limit using server-side catalogue prices. Each signed-in customer can redeem a
campaign only once; repeat attempts return `this code as been used already by you.`.
Active published announcements are
available at `/api/promos/active` and appear on the home page, signed-in account
dashboard, and cart.

For local development, set `ADMIN_REGISTRATION_KEY` in `.env` and restart the
API. For Vercel, add it to the project's Environment Variables and redeploy.
Remove the key from the backend environment after successful registration.

Product image uploads use Cloudinary. Configure `CLOUDINARY_CLOUD_NAME`,
`CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in the backend environment
(never in frontend code), then redeploy/restart the API. Administrators can
upload up to 10 JPG, PNG, WebP, or AVIF images per request (8 MB each); saved
product records keep both each secure image URL and its Cloudinary public ID.
Removed images are deleted from Cloudinary when an edited product is saved.
Product deactivation remains a soft-delete and retains its images.
