import { api } from './modules/utils.js';

const page = document.body.dataset.authPage;
const form = document.getElementById('auth-form');
const submit = form.querySelector('[type="submit"]');
const status = document.getElementById('auth-status');
const verificationPanel = document.getElementById('verification-panel');
let ready = false;

function message(text, error = false) {
  status.textContent = text;
  status.dataset.error = String(error);
  status.hidden = false;
  status.focus();
}

function dashboardForRole(role) {
  if (role === 'admin') return './admin.html';
  if (role === 'customer') return './account.html';
  throw new Error('Your account role is not recognized. Please contact support.');
}

function redirectToDashboard(user) {
  window.location.assign(dashboardForRole(user?.role));
}

function showVerification(email, text) {
  form.hidden = true;
  verificationPanel.hidden = false;
  verificationPanel.elements.email.value = email;
  message(text);
}

function strongPassword(password) {
  return password.length >= 10 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password);
}

function setBusy(button, busy, label) {
  button.disabled = busy;
  if (label) button.textContent = busy ? 'Please wait…' : label;
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
  const check = () => confirm.setCustomValidity(
    confirm.value !== form.elements.password.value ? 'Passwords must match.' : ''
  );
  confirm.addEventListener('input', check);
  form.elements.password.addEventListener('input', check);
}

if (form.elements.name) {
  form.elements.name.addEventListener('input', () => {
    form.elements.name.setCustomValidity(
      form.elements.name.value.trim() ? '' : 'Enter your full name.'
    );
  });
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (confirm) {
    confirm.setCustomValidity(
      confirm.value !== form.elements.password.value ? 'Passwords must match.' : ''
    );
  }
  if (!ready || submit.disabled || !form.reportValidity()) return;

  const values = Object.fromEntries(new FormData(form));
  const originalLabel = submit.textContent;
  setBusy(submit, true, originalLabel);
  form.setAttribute('aria-busy', 'true');
  status.hidden = true;

  try {
    if (page === 'signin') {
      const { user } = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: values.email.trim(),
          password: values.password,
        }),
      });
      form.reset();
      redirectToDashboard(user);
    } else if (page === 'signup') {
      if (!strongPassword(values.password)) {
        throw new Error('Use at least 10 characters, including an uppercase letter, a lowercase letter, and a number.');
      }
      const result = await api('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          name: values.name.trim(),
          email: values.email.trim(),
          password: values.password,
        }),
      });
      showVerification(
        result.email || values.email.trim(),
        result.message || 'Check your email for the six-digit verification code.'
      );
    } else if (page === 'forgot-password') {
      const result = await api('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: values.email.trim() }),
      });
      form.reset();
      const resetLink = document.getElementById('reset-link');
      resetLink.href = `/reset-password.html?email=${encodeURIComponent(values.email.trim())}`;
      resetLink.hidden = false;
      message(result.message || 'If the account exists, password reset instructions will be sent.');
    } else if (page === 'reset-password') {
      if (!strongPassword(values.password)) {
        throw new Error('Use at least 10 characters, including an uppercase letter, a lowercase letter, and a number.');
      }
      const result = await api('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          email: values.email.trim(),
          otp: values.otp.trim(),
          password: values.password,
        }),
      });
      form.reset();
      message(result.message || 'Password updated. Please sign in again.');
      document.getElementById('reset-help').hidden = false;
    }
  } catch (error) {
    message(error.message || 'Something went wrong. Please try again.', true);
  } finally {
    setBusy(submit, false, originalLabel);
    form.removeAttribute('aria-busy');
  }
});

if (verificationPanel) {
  verificationPanel.addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.submitter;
    if (!button || button.disabled) return;
    const values = Object.fromEntries(new FormData(verificationPanel));
    if (button.name === 'resend') {
      setBusy(button, true);
      try {
        const result = await api('/auth/resend-otp', {
          method: 'POST',
          body: JSON.stringify({ email: values.email.trim() }),
        });
        message(result.message || 'If the account requires verification, a new code has been sent.');
      } catch (error) {
        message(error.message, true);
      } finally {
        setBusy(button, false);
      }
      return;
    }

    if (!verificationPanel.reportValidity()) return;
    setBusy(button, true);
    try {
      const result = await api('/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({
          email: values.email.trim(),
          otp: values.otp.trim(),
        }),
      });
      verificationPanel.hidden = true;
      message(result.message || 'Email verified. You can now sign in.');
      window.setTimeout(() => window.location.assign('./signin.html'), 1200);
    } catch (error) {
      message(error.message || 'The verification code could not be confirmed.', true);
    } finally {
      setBusy(button, false);
    }
  });
}

async function init() {
  if (page === 'reset-password') {
    const email = new URLSearchParams(window.location.search).get('email');
    if (email) form.elements.email.value = email;
  }

  try {
    const { user } = await api('/auth/me');
    if ((page === 'signin' || page === 'signup') && user) {
      redirectToDashboard(user);
    }
  } catch (error) {
    if (error.status !== 401) {
      message(`We could not check your existing session: ${error.message}`, true);
    }
  }

  ready = true;
  if (!form.hidden) submit.disabled = false;
}

init();
