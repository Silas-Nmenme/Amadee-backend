import { api } from './utils.js';

export async function initAuth() {
  const buttons = document.querySelectorAll('#open-auth, [data-auth-link]');
  if (!buttons.length) return;

  buttons.forEach(button => {
    button.textContent = 'Sign in';
    button.href = './signin.html';
  });
  try {
    const { user } = await api('/auth/me');
    buttons.forEach(button => {
      button.textContent = user.role === 'admin' ? 'Admin dashboard' : 'My account';
      button.href = user.role === 'admin' ? './admin.html' : './account.html';
    });
  } catch {
    // Keep the sign-in links available when no valid backend session exists.
  }
}
