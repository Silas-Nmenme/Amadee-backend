import { products } from '../data/products.js';
import { byId, formatNaira } from './utils.js';
import { toast } from './toast.js';
import { getWhatsappNumber } from '../config.js';
import {
  CART_OWNER_STORAGE_KEY,
  CART_SYNC_DIRTY_STORAGE_KEY,
  CART_STORAGE_KEY,
  getAccountPreferences,
  saveAccountCart,
} from './account-data.js';
const storageKey = CART_STORAGE_KEY;
let cart = [];
let queue = Promise.resolve();
let loaded = false;
let accountUserId = null;

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
function mergeCart(accountItems, localItems) {
  const merged = new Map();
  for (const item of [...accountItems, ...localItems]) {
    const key = `${item.id}|${item.size.toLowerCase()}|${item.colour.toLowerCase()}`;
    const existing = merged.get(key);
    if (existing) {
      existing.quantity = Math.min(20, existing.quantity + item.quantity);
      existing.snapshot ||= item.snapshot;
    } else {
      merged.set(key, { ...item });
    }
  }
  return [...merged.values()];
}
function accountCartItems(items) {
  return items.map(item => ({
    productId: item.id,
    size: item.size,
    colour: item.colour,
    quantity: item.quantity,
    ...(item.snapshot ? { snapshot: item.snapshot } : {}),
  }));
}
function saveCart(items) {
  localStorage.setItem(storageKey, JSON.stringify(items));
  if (accountUserId) {
    localStorage.setItem(CART_OWNER_STORAGE_KEY, accountUserId);
    localStorage.setItem(CART_SYNC_DIRTY_STORAGE_KEY, accountUserId);
  }
  cart = items;
  notify();
}
function notify() {
  const count = cart.reduce((sum, x) => sum + x.quantity, 0);
  if (byId('cart-count')) byId('cart-count').textContent = String(count);
  window.dispatchEvent(new CustomEvent('amadee:cart-change'));
}
export async function loadCart() {
  const localItems = readCart();
  const savedOwner = localStorage.getItem(CART_OWNER_STORAGE_KEY);
  const account = await getAccountPreferences();

  if (account) {
    accountUserId = account.user.id;
    const transferableItems = savedOwner ? [] : localItems;
    const accountItems = (account.preferences.cartItems || []).map(item => ({
      id: item.productId,
      size: item.size,
      colour: item.colour,
      quantity: item.quantity,
      ...(item.snapshot ? { snapshot: item.snapshot } : {}),
    })).filter(item =>
      typeof item.id === 'string' &&
      typeof item.size === 'string' &&
      typeof item.colour === 'string' &&
      Number.isInteger(item.quantity) &&
      item.quantity >= 1 &&
      item.quantity <= 20
    );
    const dirtyOwner = localStorage.getItem(CART_SYNC_DIRTY_STORAGE_KEY);
    cart = dirtyOwner === accountUserId && savedOwner === accountUserId
      ? localItems
      : mergeCart(accountItems, transferableItems);
    localStorage.setItem(CART_OWNER_STORAGE_KEY, accountUserId);
    localStorage.setItem(storageKey, JSON.stringify(cart));
    localStorage.setItem(CART_SYNC_DIRTY_STORAGE_KEY, accountUserId);
    try {
      await saveAccountCart(accountCartItems(cart));
    } catch (error) {
      console.error('Cart account sync failed:', error.message);
      toast('Your cart is available on this device, but account sync failed.', 'error');
    }
  } else {
    accountUserId = null;
    if (savedOwner) {
      localStorage.removeItem(storageKey);
      localStorage.removeItem(CART_OWNER_STORAGE_KEY);
      localStorage.removeItem(CART_SYNC_DIRTY_STORAGE_KEY);
      cart = [];
    } else {
      cart = localItems;
      localStorage.setItem(storageKey, JSON.stringify(cart));
    }
  }

  loaded = true;
  notify();
}
function mutate(change) {
  queue = queue.catch(() => {}).then(async () => {
    if (!loaded) await loadCart();
    const next = cart.map(x => ({ ...x }));
    change(next);
    saveCart(next);
    if (accountUserId) {
      try {
        await saveAccountCart(accountCartItems(next));
      } catch (error) {
        console.error('Cart account sync failed:', error.message);
        toast('Your cart was saved on this device, but could not sync to your account.', 'error');
      }
    }
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
