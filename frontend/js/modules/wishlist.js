import { products } from '../data/products.js';
import {
  WISHLIST_OWNER_STORAGE_KEY,
  WISHLIST_SYNC_DIRTY_STORAGE_KEY,
  WISHLIST_STORAGE_KEY,
  getAccountPreferences,
  saveAccountWishlist,
} from './account-data.js';
const storageKey = WISHLIST_STORAGE_KEY;
let items = [], loaded = false, loading, queue = Promise.resolve();
const notify = () => window.dispatchEvent(new CustomEvent('amadee:wishlist-change'));
export const getWishlist = () => [...items];
export function initWishlist() {
  if (loaded) return Promise.resolve();
  if (loading) return loading;
  loading = (async () => {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (!Array.isArray(saved)) throw new Error('Your saved wishlist is invalid. Please clear it and try again.');
    const localItems = [...new Set(saved.filter(id => products.some(product => product.id === id)))];
    const savedOwner = localStorage.getItem(WISHLIST_OWNER_STORAGE_KEY);
    const account = await getAccountPreferences();
    if (account) {
      const ownerId = account.user.id;
      const transferableItems = savedOwner ? [] : localItems;
      const accountItems = account.preferences.wishlistProductIds || [];
      const dirtyOwner = localStorage.getItem(WISHLIST_SYNC_DIRTY_STORAGE_KEY);
      items = dirtyOwner === ownerId && savedOwner === ownerId
        ? localItems
        : [...new Set([...accountItems, ...transferableItems])];
      localStorage.setItem(WISHLIST_OWNER_STORAGE_KEY, ownerId);
      localStorage.setItem(WISHLIST_SYNC_DIRTY_STORAGE_KEY, ownerId);
      try {
        await saveAccountWishlist(items);
      } catch (error) {
        console.error('Wishlist account sync failed:', error.message);
        throw new Error('Your saved styles loaded, but account sync failed.');
      }
    } else {
      if (savedOwner) {
        localStorage.removeItem(storageKey);
        localStorage.removeItem(WISHLIST_OWNER_STORAGE_KEY);
        localStorage.removeItem(WISHLIST_SYNC_DIRTY_STORAGE_KEY);
        items = [];
      } else {
        items = localItems;
      }
    }
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
    const ownerId = localStorage.getItem(WISHLIST_OWNER_STORAGE_KEY);
    if (ownerId) {
      localStorage.setItem(WISHLIST_SYNC_DIRTY_STORAGE_KEY, ownerId);
    }
    try {
      await saveAccountWishlist(items);
    } catch (error) {
      console.error('Wishlist account sync failed:', error.message);
      throw new Error('Your wishlist changed on this device, but could not sync to your account.');
    }
    return items.includes(id);
  });
  queue = operation;
  return operation;
}
