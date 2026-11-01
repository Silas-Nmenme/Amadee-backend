# Amadee-backend

## Frontend/API integration

The static storefront in `frontend/` sends production API requests to the
same-origin `/api` path. `netlify.toml` proxies those requests to
`https://amadee-backend.vercel.app/api`, allowing the backend's HttpOnly session
cookie to work from the Netlify site. Local development defaults to
`http://localhost:3000/api`. Set `window.AMADEE_API_URL` before loading the
frontend modules to override either API base URL.

The API always permits the production storefront origin,
`https://amadeestiches.netlify.app`. Configure additional exact origins with
`FRONTEND_ORIGINS` as a comma-separated list; the legacy `FRONTEND_ORIGIN`
setting is also supported. Localhost origins are allowed only outside
production. Do not configure wildcard origins when credentials are enabled.
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
To bootstrap the single administrator, configure `ADMIN_EMAIL` on the backend,
then send `POST /api/auth/register-admin` with the same JSON body as normal
signup: `{ "name", "email", "password" }`. The email must match `ADMIN_EMAIL`,
and the new administrator must complete the emailed OTP verification before
signing in. No extra registration-key header is needed. Ordinary
`/api/auth/signup` registrations cannot create admin accounts, and once an
admin exists the endpoint refuses further admin registrations.

For local development, set `ADMIN_EMAIL` in `.env` and restart the API. For
Vercel, add `ADMIN_EMAIL` to the project's Environment Variables for the
deployment environment being tested, then redeploy so the function receives
the updated setting. Keep the configured address private and do not accept an
admin email from the request as an authorization override.
