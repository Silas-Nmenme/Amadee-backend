import { products } from '../data/products.js';
const storageKey = 'amadee-stiches-wishlist-v1';
let items = [], loaded = false, loading, queue = Promise.resolve();
const notify = () => window.dispatchEvent(new CustomEvent('amadee:wishlist-change'));
export const getWishlist = () => [...items];
export function initWishlist() {
  if (loaded) return Promise.resolve();
  if (loading) return loading;
  loading = (async () => {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (!Array.isArray(saved)) throw new Error('Your saved wishlist is invalid. Please clear it and try again.');
    items = [...new Set(saved.filter(id => products.some(product => product.id === id)))];
    localStorage.setItem(storageKey, JSON.stringify(items));
    loaded = true; notify();
  })().finally(() => { loading = null; });
  return loading;
}
export function toggleWishlist(id) {
  const operation = queue.catch(() => {}).then(async () => {
    await initWishlist();
    const next = items.includes(id) ? items.filter(value => value !== id) : [...items, id];
    localStorage.setItem(storageKey, JSON.stringify(next));
    items = next;
    notify();
    return items.includes(id);
  });
  queue = operation;
  return operation;
}
