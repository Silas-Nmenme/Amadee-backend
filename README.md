# Amadee-backend

## Frontend/API integration

The static storefront in `frontend/` uses `https://amadee-backend.vercel.app/api`
by default. Set `window.AMADEE_API_URL` before loading the frontend modules to
override the backend origin or API base URL.

The API always permits the production storefront origin,
`https://amadeestiches.netlify.app`. Configure additional exact origins with
`FRONTEND_ORIGINS` as a comma-separated list; the legacy `FRONTEND_ORIGIN`
setting is also supported. Localhost origins are allowed only outside
production. Do not configure wildcard origins when credentials are enabled.

The cart and wishlist are stored in the visitor's browser because the backend
does not expose cart or wishlist endpoints. Account sign-in currently uses
Netlify Identity; the backend's separate OTP/JWT authentication routes are not
used by the storefront.
