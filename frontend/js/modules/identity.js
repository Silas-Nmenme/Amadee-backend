// Pinned browser distribution of @netlify/identity; shared across account pages.
export function loadIdentity() {
  return import('https://esm.sh/@netlify/identity@2.0.0?bundle');
}

export function routeAuthCallback() {
  const hash = window.location.hash;
  if (/^#(?:recovery_token|invite_token)=/.test(hash)) {
    window.location.replace('/reset-password.html' + hash);
    return true;
  }
  if (/^#(?:confirmation_token|access_token|email_change_token)=/.test(hash)) {
    window.location.replace('/signin.html' + hash);
    return true;
  }
  return false;
}
