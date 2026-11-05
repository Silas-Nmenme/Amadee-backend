import { api, safeText, formatNaira } from './modules/utils.js';
import { clearLocalAccountData } from './modules/account-data.js';
import { initAuth } from './modules/auth.js';
import { initPromotionAnnouncements } from './modules/promotions.js';
import { openModal } from './modules/modal.js';

const status = document.getElementById('account-status');
const profile = document.getElementById('profile-form');
const panel = document.getElementById('account-panel');
const message = text => { status.textContent = text; };

initAuth();

function displayDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : date.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
}

function safeImageUrl(value) {
  try {
    const url = new URL(value, window.location.href);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function openOrderDetails(order) {
  openModal(`Order ${order.orderId || ''}`, modal => {
    const itemList = document.createElement('div');
    itemList.className = 'order-detail-items';

    for (const item of order.items || []) {
      const row = document.createElement('article');
      row.className = 'order-detail-item';
      const imageUrl = safeImageUrl(item.image);
      if (imageUrl) {
        const image = document.createElement('img');
        image.src = imageUrl;
        image.alt = item.name || 'Product image';
        image.loading = 'lazy';
        image.onerror = () => image.replaceWith(safeText('div', 'Image unavailable', 'order-image-placeholder'));
        row.append(image);
      } else {
        row.append(safeText('div', 'Image unavailable', 'order-image-placeholder'));
      }

      const details = document.createElement('div');
      details.append(
        safeText('strong', item.name || item.productId || 'Product'),
        safeText('p', `Product code: ${item.productId || '—'} · Quantity: ${item.quantity}`),
        safeText('p', `Size: ${item.size || '—'} · Colour: ${item.colour || '—'}`),
        safeText('p', `Unit price: ${formatNaira(item.unitPrice)} · Line total: ${formatNaira(item.lineTotal)}`),
      );
      row.append(details);
      itemList.append(row);
    }

    modal.append(
      safeText('p', `Placed: ${displayDate(order.createdAt)}`),
      safeText('p', `Order status: ${String(order.orderStatus || 'received').replaceAll('_', ' ')} · Payment: ${String(order.paymentStatus || 'pending').replaceAll('_', ' ')} via ${String(order.paymentMethod || '—').replaceAll('_', ' ')}`),
      safeText('p', `Delivery: ${String(order.deliveryOption || '—').replaceAll('_', ' ')}`),
      safeText('h3', 'Items'),
      itemList,
    );
    if (order.promoCode) {
      modal.append(safeText('p', `Promo: ${order.promoCode}${order.promoCampaignName ? ` · ${order.promoCampaignName}` : ''}`));
    }
    if (order.statusHistory?.length) {
      modal.append(safeText('h3', 'Status history'));
      const history = document.createElement('ul');
      for (const entry of order.statusHistory) {
        history.append(safeText('li', `${displayDate(entry.at)} · ${String(entry.status || '').replaceAll('_', ' ')}${entry.note ? ` — ${entry.note}` : ''}`));
      }
      modal.append(history);
    }
    modal.append(
      safeText('p', `Subtotal: ${formatNaira(order.subtotal)} · Discount: ${formatNaira(order.discount)} · Delivery: ${formatNaira(order.deliveryFee)}`),
      safeText('strong', `Order total: ${formatNaira(order.total)}`),
    );
  });
}

function renderOrder(order) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'customer-order-card';
  card.setAttribute('aria-label', `View details for order ${order.orderId || ''}`);
  card.onclick = () => openOrderDetails(order);
  const details = document.createElement('span');
  details.className = 'customer-order-summary';
  details.append(safeText('span', `Order ${order.orderId || ''}`, 'order-detail-trigger'));

  const itemCount = (order.items || []).reduce((total, item) => total + Number(item.quantity || 0), 0);
  details.append(
    safeText('span', `${itemCount} item${itemCount === 1 ? '' : 's'} · ${formatNaira(order.total)}`),
    safeText('span', `Payment: ${String(order.paymentStatus || 'pending').replaceAll('_', ' ')} · Order: ${String(order.orderStatus || 'received').replaceAll('_', ' ')}`),
    safeText('time', displayDate(order.createdAt)),
  );

  const images = document.createElement('span');
  images.className = 'order-image-strip';
  for (const item of (order.items || []).slice(0, 4)) {
    const imageUrl = safeImageUrl(item.image);
    if (!imageUrl) continue;
    const image = document.createElement('img');
    image.src = imageUrl;
    image.alt = item.name || 'Order item';
    image.loading = 'lazy';
    images.append(image);
  }
  if (images.childElementCount) details.append(images);

  card.append(details);
  return card;
}

async function loadOrders() {
  const list = document.getElementById('orders-list');
  list.textContent = 'Loading your orders…';

  try {
    const { orders } = await api('/orders/mine');
    list.replaceChildren();
    if (!orders.length) {
      list.append(safeText('p', 'You have no orders yet.'));
      return;
    }
    orders.forEach(order => list.append(renderOrder(order)));
  } catch (error) {
    list.textContent = error.message || 'Your orders could not be loaded.';
  }
}

async function loadReviews() {
  const list = document.getElementById('moderation-list');
  list.textContent = 'Loading pending reviews…';
  try {
    const { reviews } = await api('/reviews/pending');
    list.replaceChildren();
    if (!reviews.length) list.append(safeText('p', 'No reviews awaiting approval.'));
    for (const review of reviews) {
      const card = document.createElement('article');
      card.className = 'review-card';
      card.append(
        safeText('h3', review.name),
        safeText('p', `${review.rating} / 5`),
        safeText('p', review.message)
      );
      const actions = document.createElement('div');
      actions.className = 'modal-actions';
      for (const [label, approved] of [['Publish review', true], ['Reject review', false]]) {
        const button = safeText('button', label, 'button button-outline');
        button.type = 'button';
        button.onclick = async () => {
          actions.querySelectorAll('button').forEach(item => { item.disabled = true; });
          try {
            await api(`/reviews/${encodeURIComponent(review.id)}/moderate`, {
              method: 'PATCH',
              body: JSON.stringify({ approved }),
            });
            message(approved ? 'Review published.' : 'Review rejected.');
            await loadReviews();
          } catch (error) {
            message(error.message);
            actions.querySelectorAll('button').forEach(item => { item.disabled = false; });
          }
        };
        actions.append(button);
      }
      card.append(actions);
      list.append(card);
    }
  } catch (error) {
    list.textContent = error.message || 'Pending reviews could not be loaded.';
  }
}

profile.addEventListener('submit', async event => {
  event.preventDefault();
  const button = profile.querySelector('[type="submit"]');
  if (button.disabled || !profile.reportValidity()) return;
  button.disabled = true;
  try {
    const { user } = await api('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify({ name: profile.elements.name.value.trim() }),
    });
    profile.elements.name.value = user.name;
    message('Your profile has been saved.');
  } catch (error) {
    message(error.message);
  } finally {
    button.disabled = false;
  }
});

document.getElementById('account-signout').onclick = async event => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    await api('/auth/logout', { method: 'POST' });
    clearLocalAccountData();
    window.location.assign('./signin.html');
  } catch (error) {
    message(error.message);
    button.disabled = false;
  }
};

document.getElementById('refresh-reviews').onclick = loadReviews;
document.getElementById('refresh-orders').onclick = loadOrders;

async function start() {
  try {
    const { user } = await api('/auth/me');
    profile.elements.name.value = user.name || '';
    document.getElementById('account-email').textContent = user.email || '';
    panel.hidden = false;
    initPromotionAnnouncements('account-promotions');
    message('Welcome back. Make yourself at home.');
    await loadOrders();
    if (user.role === 'admin') {
      document.getElementById('admin-dashboard-link').hidden = false;
      document.getElementById('moderation').hidden = false;
      loadReviews();
    }
  } catch (error) {
    if (error.status === 401) {
      message('Sign in to manage your account and view your orders.');
      document.getElementById('account-signin').hidden = false;
      return;
    }
    message(`Your account could not be loaded: ${error.message}`);
  }
}

start();
