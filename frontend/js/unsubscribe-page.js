import { api } from './modules/utils.js';

const form = document.getElementById('unsubscribe-form');
const status = document.getElementById('unsubscribe-status');
const token = new URLSearchParams(window.location.search).get('token') || '';

if (token) {
  form.elements.token.value = token;
  form.hidden = false;
  status.textContent = 'Confirm that you want to stop receiving collection updates.';
} else {
  status.textContent = 'This unsubscribe link is missing or invalid.';
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const button = form.querySelector('[type="submit"]');
  if (button.disabled) return;
  button.disabled = true;
  status.textContent = 'Updating your email preferences…';
  try {
    const result = await api('/newsletter/unsubscribe', {
      method: 'POST',
      body: JSON.stringify({ token: form.elements.token.value }),
    });
    status.textContent = result.message;
    form.hidden = true;
  } catch (error) {
    status.textContent = error.message || 'Your preferences could not be updated. Please try again.';
    button.disabled = false;
  }
});