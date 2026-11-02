# Amadee-backend

## Frontend/API integration

The static storefront in `frontend/` sends production API requests to
`https://amadee-backend.vercel.app/api`. Local development defaults to
`http://localhost:3000/api`. Set `window.AMADEE_API_URL` before loading the
frontend modules to override either API base URL. The backend permits the
production storefront origin, `https://amadee.vercel.app`, and uses credentialed
CORS for the HttpOnly session cookie.

Configure additional exact origins with `FRONTEND_ORIGINS` as a comma-separated
list; the legacy `FRONTEND_ORIGIN` setting is also supported. Localhost origins
are allowed only outside production. Do not configure wildcard origins when
credentials are enabled.
Set `OTP_SECRET` to a random secret of at least 32 characters for keyed OTP
hashing; `JWT_SECRET` is used as a fallback when `OTP_SECRET` is not set.

The storefront uses the backend's email/OTP/JWT authentication, product,
order, review, contact, and newsletter endpoints. Cart and wishlist selections
remain in browser storage because the backend does not expose those endpoints.
The bundled product list remains available when the backend catalogue is empty;
online order submission is enabled for products returned by the backend.

Signed-in customers can manage their profile and view order history at
`frontend/account.html`. Orders submitted with a valid session are associated
with that customer. Administrators can manage orders, inventory, catalogue
products, subscribers, and summary metrics at `frontend/admin.html`; the
backend enforces administrator authorization on each management endpoint.
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

For local development, set `ADMIN_REGISTRATION_KEY` in `.env` and restart the
API. For Vercel, add it to the project's Environment Variables and redeploy.
Remove the key from the backend environment after successful registration.
