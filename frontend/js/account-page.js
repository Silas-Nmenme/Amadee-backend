import { api, safeText, formatNaira } from './modules/utils.js';
import { clearLocalAccountData } from './modules/account-data.js';
import { initAuth } from './modules/auth.js';
import { initPromotionAnnouncements } from './modules/promotions.js';
import { closeModal, openModal } from './modules/modal.js';

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

function canRequestOrderAction(order, type) {
  const pendingRequest = (order.orderRequests || []).some(request => request.status === 'pending');
  if (pendingRequest) return false;
  const alreadyApproved = (order.orderRequests || []).some(request =>
    request.type === type && ['approved', 'refunded'].includes(request.status)
  );
  if (alreadyApproved) return false;
  return type === 'cancellation'
    ? ['received', 'confirmed', 'in_production', 'ready'].includes(order.orderStatus)
    : order.orderStatus === 'completed';
}

function requestOrderAction(order, type) {
  const label = type === 'return' ? 'return' : 'cancellation';
  openModal(`Request order ${label}`, modal => {
    modal.append(safeText('p', `Order ${order.orderId}. The shop will review your request and email you with an update.`));
    const form = document.createElement('form');
    const reasonLabel = safeText('label', 'Reason for your request');
    const reason = document.createElement('textarea');
    reason.name = 'reason';
    reason.required = true;
    reason.minLength = 3;
    reason.maxLength = 500;
    reason.rows = 4;
    reasonLabel.append(reason);
    const submit = safeText('button', `Send ${label} request`, 'button');
    submit.type = 'submit';
    form.append(reasonLabel, submit);
    form.onsubmit = async event => {
      event.preventDefault();
      if (!form.reportValidity() || submit.disabled) return;
      submit.disabled = true;
      try {
        const result = await api(`/orders/${encodeURIComponent(order.orderId)}/requests`, {
          method: 'POST',
          body: JSON.stringify({ type, reason: reason.value.trim() }),
        });
        closeModal();
        message(result.message || 'Your request has been sent for review.');
        await loadOrders();
      } catch (error) {
        message(error.message || 'Your request could not be sent.');
        submit.disabled = false;
      }
    };
    modal.append(form);
  });
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
    if (order.tracking?.carrier || order.tracking?.trackingNumber || order.tracking?.note) {
      modal.append(safeText('h3', 'Delivery tracking'));
      if (order.tracking.carrier) modal.append(safeText('p', `Carrier: ${order.tracking.carrier}`));
      if (order.tracking.trackingNumber) modal.append(safeText('p', `Tracking number: ${order.tracking.trackingNumber}`));
      if (order.tracking.note) modal.append(safeText('p', order.tracking.note));
      const trackingUrl = safeImageUrl(order.tracking.trackingUrl);
      if (trackingUrl) {
        const link = safeText('a', 'Track shipment');
        link.href = trackingUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        modal.append(link);
      }
    }
    if (order.orderRequests?.length) {
      modal.append(safeText('h3', 'Cancellation and return requests'));
      const requests = document.createElement('ul');
      for (const request of order.orderRequests) {
        requests.append(safeText(
          'li',
          `${String(request.type || 'order').replaceAll('_', ' ')} · ${request.status} · ${displayDate(request.requestedAt)}${request.reason ? ` — ${request.reason}` : ''}${request.reviewNote ? ` · Shop response: ${request.reviewNote}` : ''}${request.status === 'refunded' && order.refundReference ? ` · Refund reference: ${order.refundReference}` : ''}`,
        ));
      }
      modal.append(requests);
    }
    modal.append(
      safeText('p', `Subtotal: ${formatNaira(order.subtotal)} · Discount: ${formatNaira(order.discount)} · Delivery: ${formatNaira(order.deliveryFee)}`),
      safeText('strong', `Order total: ${formatNaira(order.total)}`),
    );
  });
}

function renderOrder(order) {
  const card = document.createElement('article');
  card.className = 'customer-order-card';
  const details = document.createElement('span');
  details.className = 'customer-order-summary';
  const openButton = safeText('button', `Order ${order.orderId || ''}`, 'order-detail-trigger');
  openButton.type = 'button';
  openButton.setAttribute('aria-label', `View details for order ${order.orderId || ''}`);
  openButton.onclick = () => openOrderDetails(order);
  details.append(openButton);

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

  const actions = document.createElement('div');
  actions.className = 'customer-order-actions';
  for (const [type, label] of [['cancellation', 'Request cancellation'], ['return', 'Request a return']]) {
    if (!canRequestOrderAction(order, type)) continue;
    const button = safeText('button', label, 'button button-outline');
    button.type = 'button';
    button.onclick = () => requestOrderAction(order, type);
    actions.append(button);
  }
  card.append(details);
  if (actions.childElementCount) card.append(actions);
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
