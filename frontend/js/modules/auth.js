import { api } from './utils.js';

export async function initAuth() {
  const button = document.getElementById('open-auth');
  if (!button) return;

  button.href = './signin.html';
  try {
    const { user } = await api('/auth/me');
    button.textContent = user.role === 'admin' ? 'Admin dashboard' : 'My account';
    button.href = user.role === 'admin' ? './admin.html' : './account.html';
  } catch {
    // Keep the sign-in link available when no valid backend session exists.
  }
}
