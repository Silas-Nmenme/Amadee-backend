import { api } from './utils.js';

export function initPublicForms() {
  for (const form of document.querySelectorAll('form[name="contact"], form[name="newsletter"]')) {
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const button = form.querySelector('[type="submit"]');
      if (button.disabled || !form.reportValidity()) return;
      const status = form.querySelector('.form-status');
      button.disabled = true;
      form.setAttribute('aria-busy', 'true');
      status.textContent = 'Sending…';
      try {
        const data = Object.fromEntries(new FormData(form));
        await api(`/${form.name}`, { method: 'POST', body: JSON.stringify(data) });
        form.reset();
        status.textContent = form.name === 'newsletter' ? 'Thank you. Your request for collection updates has been received.' : 'Thank you. Your message has been received.';
      } catch (error) {
        status.textContent = error.message || 'We couldn’t send this. Please try again or contact us on WhatsApp.';
      } finally {
        button.disabled = false;
        form.removeAttribute('aria-busy');
      }
    });
  }
}
