import { products } from '../data/products.js';
import { byId, formatNaira } from './utils.js';
import { toast } from './toast.js';
import { getWhatsappNumber } from '../config.js';
const storageKey = 'amadee-stiches-cart-v1';
let cart = [];
let queue = Promise.resolve();
let loaded = false;

function productFromSnapshot(snapshot) {
  if (
    !snapshot ||
    typeof snapshot.name !== 'string' ||
    !Number.isFinite(snapshot.price) ||
    !Array.isArray(snapshot.images) ||
    !Array.isArray(snapshot.sizes) ||
    !Array.isArray(snapshot.colours)
  ) return null;
  return { ...snapshot, backendAvailable: false, inStock: true };
}

function readCart() {
  const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
  if (!Array.isArray(saved)) throw new Error('Your saved cart is invalid. Please clear it and try again.');
  return saved.filter(item => {
    const product = products.find(candidate => candidate.id === item?.id) ||
      productFromSnapshot(item?.snapshot);
    return product?.inStock &&
      product.sizes.includes(item.size) &&
      product.colours.includes(item.colour) &&
      Number.isInteger(item.quantity) &&
      item.quantity >= 1 &&
      item.quantity <= 20;
  });
}
function saveCart(items) {
  localStorage.setItem(storageKey, JSON.stringify(items));
  cart = items;
  notify();
}
function notify() {
  const count = cart.reduce((sum, x) => sum + x.quantity, 0);
  if (byId('cart-count')) byId('cart-count').textContent = String(count);
  window.dispatchEvent(new CustomEvent('amadee:cart-change'));
}
export async function loadCart() {
  cart = readCart();
  localStorage.setItem(storageKey, JSON.stringify(cart));
  loaded = true;
  notify();
}
function mutate(change) {
  queue = queue.catch(() => {}).then(async () => {
    if (!loaded) await loadCart();
    const next = cart.map(x => ({ ...x }));
    change(next);
    saveCart(next);
  });
  return queue.catch(err => { toast(err.message, 'error'); throw err; });
}
export const getCart = () => cart.map(item => ({
  ...item,
  product: products.find(product => product.id === item.id) ||
    productFromSnapshot(item.snapshot),
}));
export const getSubtotal = () => getCart().reduce((sum, x) => sum + x.product.price * x.quantity, 0);
export async function addToCart(id, quantity = 1, options = {}) {
  const p = products.find(x => x.id === id);
  if (!p?.inStock || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) return toast('Choose an available item and a quantity from 1 to 20.', 'error');
  try {
    await mutate(next => {
      const size = options.size || p.sizes[0], colour = options.colour || p.colours[0];
      const existing = next.find(x => x.id === id && x.size === size && x.colour === colour);
      const snapshot = {
        name: p.name,
        price: p.price,
        images: p.images,
        sizes: p.sizes,
        colours: p.colours,
        description: p.description,
      };
      if (existing) {
        existing.quantity = Math.min(20, existing.quantity + quantity);
        existing.snapshot = snapshot;
      } else next.push({ id, size, colour, quantity, snapshot });
    });
    toast('Added to your cart.');
  } catch { /* Error is displayed by mutate. */ }
}
export const updateQuantity = (index, delta) => mutate(next => { if (next[index]) next[index].quantity = Math.max(1, Math.min(20, next[index].quantity + delta)); });
export const updateOptions = (index, options) => mutate(next => { if (next[index]) Object.assign(next[index], options); });
export const removeItem = index => mutate(next => { next.splice(index, 1); });
export const clearCart = () => mutate(next => { next.splice(0); });
export function openCart() { window.location.assign('/cart.html'); }
export function whatsappUrl(extra = '') {
  const lines = getCart().map(x => `${x.product.name} (${x.size}, ${x.colour}) × ${x.quantity} — ${formatNaira(x.product.price * x.quantity)}`);
  return `https://wa.me/${getWhatsappNumber()}?text=${encodeURIComponent(`Hello Amadee-Stiches, I'd like to order:\n${lines.join('\n')}\nSubtotal: ${formatNaira(getSubtotal())}${extra}`)}`;
}
export function initCart() {
  byId('open-cart')?.addEventListener('click', openCart);
  return loadCart().catch(err => { toast(err.message, 'error'); throw err; });
}
