import { api } from './utils.js';

export const CART_STORAGE_KEY = 'amadee-stiches-cart-v1';
export const WISHLIST_STORAGE_KEY = 'amadee-stiches-wishlist-v1';
export const CART_OWNER_STORAGE_KEY = 'amadee-stiches-cart-owner-v1';
export const WISHLIST_OWNER_STORAGE_KEY = 'amadee-stiches-wishlist-owner-v1';
export const CART_SYNC_DIRTY_STORAGE_KEY = 'amadee-stiches-cart-sync-dirty-v1';
export const WISHLIST_SYNC_DIRTY_STORAGE_KEY = 'amadee-stiches-wishlist-sync-dirty-v1';

let userRequest;
let preferencesRequest;
let currentUser = null;

export function getCurrentUser({ refresh = false } = {}) {
  if (refresh) {
    userRequest = null;
    preferencesRequest = null;
  }
  if (!userRequest) {
    userRequest = api('/auth/me')
      .then(({ user }) => {
        currentUser = user;
        return user;
      })
      .catch(error => {
        if (error.status === 401) {
          currentUser = null;
          if (
            localStorage.getItem(CART_OWNER_STORAGE_KEY) ||
            localStorage.getItem(WISHLIST_OWNER_STORAGE_KEY)
          ) {
            localStorage.removeItem(CART_STORAGE_KEY);
            localStorage.removeItem(WISHLIST_STORAGE_KEY);
            localStorage.removeItem(CART_OWNER_STORAGE_KEY);
            localStorage.removeItem(WISHLIST_OWNER_STORAGE_KEY);
            localStorage.removeItem(CART_SYNC_DIRTY_STORAGE_KEY);
            localStorage.removeItem(WISHLIST_SYNC_DIRTY_STORAGE_KEY);
          }
          return null;
        }
        userRequest = null;
        throw error;
      });
  }
  return userRequest;
}

export async function getAccountPreferences() {
  const user = await getCurrentUser();
  if (!user) return null;

  if (!preferencesRequest) {
    preferencesRequest = api('/account/preferences')
      .catch(error => {
        preferencesRequest = null;
        throw error;
      });
  }

  return { user, preferences: await preferencesRequest };
}

export async function saveAccountCart(cartItems) {
  if (!currentUser) return;
  await api('/account/cart', {
    method: 'PUT',
    body: JSON.stringify({ cartItems }),
  });
  localStorage.removeItem(CART_SYNC_DIRTY_STORAGE_KEY);
  preferencesRequest = null;
}

export async function saveAccountWishlist(wishlistProductIds) {
  if (!currentUser) return;
  await api('/account/wishlist', {
    method: 'PUT',
    body: JSON.stringify({ wishlistProductIds }),
  });
  localStorage.removeItem(WISHLIST_SYNC_DIRTY_STORAGE_KEY);
  preferencesRequest = null;
}

export function clearLocalAccountData() {
  localStorage.removeItem(CART_STORAGE_KEY);
  localStorage.removeItem(WISHLIST_STORAGE_KEY);
  localStorage.removeItem(CART_OWNER_STORAGE_KEY);
  localStorage.removeItem(WISHLIST_OWNER_STORAGE_KEY);
  localStorage.removeItem(CART_SYNC_DIRTY_STORAGE_KEY);
  localStorage.removeItem(WISHLIST_SYNC_DIRTY_STORAGE_KEY);
  currentUser = null;
  userRequest = null;
  preferencesRequest = null;
}
