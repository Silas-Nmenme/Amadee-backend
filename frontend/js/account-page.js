import { loadIdentity, routeAuthCallback } from './modules/identity.js';
import { api, safeText } from './modules/utils.js';
const status = document.getElementById('account-status');
const profile = document.getElementById('profile-form');
const panel = document.getElementById('account-panel');
let identity;
const message = text => { status.textContent = text; };
async function loadReviews() {
  const list = document.getElementById('moderation-list');
  list.textContent = 'Loading pending reviews…';
  try {
    const { reviews } = await api('/reviews?pending=true');
    list.replaceChildren();
    if (!reviews.length) list.append(safeText('p', 'No reviews awaiting approval.'));
    for (const review of reviews) {
      const card = document.createElement('article'); card.className = 'review-card';
      card.append(safeText('h3', review.name), safeText('p', `${review.rating} / 5`), safeText('p', review.message));
      const actions = document.createElement('div'); actions.className = 'modal-actions';
      for (const [label, approved] of [['Publish review', true], ['Reject review', false]]) {
        const button = safeText('button', label, 'button button-outline'); button.type = 'button';
        button.onclick = async () => {
          actions.querySelectorAll('button').forEach(b => { b.disabled = true; });
          try { await api('/reviews', { method: 'PATCH', body: JSON.stringify({ id: review.id, approved }) }); message(approved ? 'Review published.' : 'Review rejected.'); await loadReviews(); }
          catch (error) { message(error.message); actions.querySelectorAll('button').forEach(b => { b.disabled = false; }); }
        };
        actions.append(button);
      }
      card.append(actions); list.append(card);
    }
  } catch (error) { list.textContent = error.message; }
}
profile.addEventListener('submit', async event => {
  event.preventDefault();
  const button = profile.querySelector('button');
  if (button.disabled || !profile.reportValidity()) return;
  const name = profile.elements.fullName.value.trim();
  if (!name) { message('Enter your full name.'); return; }
  button.disabled = true;
  try { await identity.updateUser({ data: { full_name: name } }); message('Your profile has been saved.'); }
  catch (error) { message(error.message); }
  finally { button.disabled = false; }
});
document.getElementById('account-signout').onclick = async event => {
  event.target.disabled = true;
  try { await identity.logout(); location.assign('/signin.html'); }
  catch (error) { message(error.message); event.target.disabled = false; }
};
document.getElementById('refresh-reviews').onclick = loadReviews;
async function start() {
  if (routeAuthCallback()) return;
  try {
    identity = await loadIdentity();
    await identity.handleAuthCallback();
    const user = await identity.getUser();
    if (!user) { message('Sign in to manage your account.'); document.getElementById('account-signin').hidden = false; return; }
    profile.elements.fullName.value = user.name || '';
    document.getElementById('account-email').textContent = user.email || '';
    panel.hidden = false; message('Welcome back. Make yourself at home.');
    if (user.roles?.includes('admin')) { document.getElementById('moderation').hidden = false; loadReviews(); }
  } catch { message('Your account couldn’t load. Please reload this page to try again.'); }
}
start();
