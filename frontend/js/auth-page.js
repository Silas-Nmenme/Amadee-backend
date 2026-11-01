import { loadIdentity } from './modules/identity.js';

const page = document.body.dataset.authPage;
const form = document.getElementById('auth-form');
const submit = form.querySelector('[type="submit"]');
const status = document.getElementById('auth-status');
const actions = document.getElementById('account-actions');
let identity;
let inviteToken;
let ready = false;

function message(text, error = false) {
  status.textContent = text;
  status.dataset.error = String(error);
  status.hidden = false;
  status.focus();
}

function showAccount(text) {
  message(text);
  form.hidden = true;
  actions.hidden = false;
}

function showError(error) {
  const text = error?.status === 401
    ? 'We couldn’t sign you in. Check your email and password, or request a new reset link.'
    : error?.name === 'MissingIdentityError'
      ? 'Account services are temporarily unavailable. Please try again later.'
      : error?.message || 'Something went wrong. Please try again.';
  message(text, true);
}

for (const toggle of document.querySelectorAll('.password-toggle')) {
  toggle.addEventListener('click', () => {
    const input = document.getElementById(toggle.getAttribute('aria-controls'));
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    toggle.textContent = show ? 'Hide' : 'Show';
    toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });
}

const confirm = form.elements.confirmPassword;
if (confirm) {
  const check = () => confirm.setCustomValidity(confirm.value !== form.elements.password.value ? 'Passwords must match.' : '');
  confirm.addEventListener('input', check);
  form.elements.password.addEventListener('input', check);
}
if (form.elements.name) {
  form.elements.name.addEventListener('input', () => {
    form.elements.name.setCustomValidity(form.elements.name.value.trim() ? '' : 'Enter your full name.');
  });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!ready || submit.disabled || !form.reportValidity()) return;
  const data = new FormData(form);
  const originalLabel = submit.textContent;
  submit.disabled = true;
  submit.textContent = 'Please wait…';
  form.setAttribute('aria-busy', 'true');
  status.hidden = true;
  try {
    if (page === 'signin') {
      await identity.login(data.get('email').trim(), data.get('password'));
      form.reset();
      showAccount('You’re signed in. Welcome back to Amadee-Stiches.');
    } else if (page === 'signup') {
      const user = await identity.signup(data.get('email').trim(), data.get('password'), { full_name: data.get('name').trim() });
      form.reset();
      if (user.confirmedAt) showAccount('Your account is ready. Welcome to Amadee-Stiches.');
      else {
        form.hidden = true;
        message('Check your inbox for a confirmation link to finish creating your account. Check your spam folder too.');
      }
    } else if (page === 'forgot-password') {
      await identity.requestPasswordRecovery(data.get('email').trim());
      form.reset();
      message('If an account exists for that email, a reset link is on its way. Check your inbox and spam folder.');
    } else if (page === 'reset-password') {
      if (inviteToken) await identity.acceptInvite(inviteToken, data.get('password'));
      else {
        if (!await identity.getUser()) throw new Error('Your reset session has expired. Request a new reset link.');
        await identity.updateUser({ password: data.get('password') });
      }
      inviteToken = null;
      form.reset();
      showAccount('Your password has been saved. You can continue shopping.');
      document.getElementById('reset-help').hidden = true;
    }
  } catch (error) {
    showError(error);
  } finally {
    submit.disabled = false;
    submit.textContent = originalLabel;
    form.removeAttribute('aria-busy');
  }
});

document.getElementById('sign-out').addEventListener('click', async (event) => {
  event.target.disabled = true;
  try {
    await identity.logout();
    window.location.assign('/signin.html');
  } catch (error) {
    showError(error);
    event.target.disabled = false;
  }
});

async function init() {
  // Move recovery links before consuming them, including links sent to the site root.
  if (page !== 'reset-password' && /^#(?:recovery_token|invite_token)=/.test(location.hash)) {
    location.replace('/reset-password.html' + location.hash);
    return;
  }
  try {
    identity = await loadIdentity();
    const callback = await identity.handleAuthCallback();
    if (callback?.type === 'invite') inviteToken = callback.token;
    const user = await identity.getUser();
    if (page === 'reset-password') {
      if (!inviteToken && !user) {
        form.hidden = true;
        document.getElementById('reset-help').hidden = false;
        message('Open the reset link in your email to choose a new password. If it has expired, request a new link.', true);
        return;
      }
    } else if (user && page !== 'forgot-password') {
      showAccount(callback?.type === 'confirmation' ? 'Your email is confirmed. You’re signed in.' : 'You’re already signed in. Welcome back.');
    }
    ready = true;
    submit.disabled = false;
  } catch (error) {
    showError(error);
    if (page === 'reset-password') {
      form.hidden = true;
      document.getElementById('reset-help').hidden = false;
    } else if (identity) {
      // An expired confirmation link must not prevent a fresh sign-in attempt.
      ready = true;
      submit.disabled = false;
    } else {
      message('Account services couldn’t load. Check your connection and reload this page.', true);
    }
  }
}

init();
