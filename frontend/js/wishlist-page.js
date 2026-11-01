import { products } from './data/products.js';
import { makeCard } from './modules/products.js';
import { getWishlist, initWishlist } from './modules/wishlist.js';
import { initCart } from './modules/cart.js';
import { initAuth } from './modules/auth.js';
const status = document.getElementById('wishlist-status'), retry = document.getElementById('wishlist-retry');
function render() {
  const saved = products.filter(product => getWishlist().includes(product.id));
  const grid = document.getElementById('wishlist-grid'); grid.replaceChildren(...saved.map(makeCard));
  document.getElementById('wishlist-empty').hidden = !!saved.length;
  status.textContent = `${saved.length} saved style${saved.length === 1 ? '' : 's'}. Saved on this browser for your next visit.`;
}
async function load() {
  retry.hidden = true; status.textContent = 'Loading your saved styles…';
  try { await initWishlist(); render(); }
  catch (error) { status.textContent = error.message; retry.hidden = false; }
}
window.addEventListener('amadee:wishlist-change', render);
retry.onclick = load;
initCart().catch(() => {}); initAuth(); load();
