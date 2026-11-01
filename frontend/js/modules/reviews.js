import { api, byId, safeText } from './utils.js';
let allReviews = [], showAll = false;
function draw() {
  const list = byId('reviews-list');
  list.replaceChildren();
  if (!allReviews.length) list.append(safeText('p', 'No approved reviews yet. Be the first to share your experience.'));
  for (const review of (showAll ? allReviews : allReviews.slice(0, 3))) {
    const card = document.createElement('article'); card.className = 'review-card';
    card.append(safeText('p', `${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}`, 'review-stars'), safeText('h3', review.name), safeText('p', review.message), safeText('small', new Date(review.createdAt).toLocaleDateString('en-NG')));
    list.append(card);
  }
  byId('view-more-reviews').classList.toggle('hidden', allReviews.length <= 3);
  byId('view-more-reviews').textContent = showAll ? 'Show fewer reviews' : 'View more reviews';
}
async function load() {
  const list = byId('reviews-list');
  list.textContent = 'Loading reviews…';
  try { allReviews = (await api('/reviews')).reviews; draw(); }
  catch {
    list.replaceChildren(safeText('p', 'Reviews couldn’t load. Please try again.'));
    const retry = safeText('button', 'Retry reviews', 'button button-outline'); retry.type = 'button'; retry.onclick = load; list.append(retry);
  }
}
export function initReviews() {
  load();
  byId('view-more-reviews').onclick = () => { showAll = !showAll; draw(); };
  byId('review-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget, button = form.querySelector('[type="submit"]'), status = form.querySelector('.form-status');
    if (button.disabled || !form.reportValidity()) return;
    const data = Object.fromEntries(new FormData(form)); data.rating = Number(data.rating);
    button.disabled = true; status.textContent = 'Sending review…'; form.setAttribute('aria-busy', 'true');
    try { await api('/reviews', { method: 'POST', body: JSON.stringify(data) }); form.reset(); status.textContent = 'Thank you. Your review is awaiting approval before publication.'; }
    catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; form.removeAttribute('aria-busy'); }
  });
}
