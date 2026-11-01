import { api, safeText, formatNaira } from './modules/utils.js';

const status = document.getElementById('account-status');
const profile = document.getElementById('profile-form');
const panel = document.getElementById('account-panel');
const message = text => { status.textContent = text; };

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

    for (const order of orders) {
      const card = document.createElement('article');
      card.className = 'review-card';
      const itemNames = order.items
        .map(item => `${item.name} × ${item.quantity}`)
        .join(', ');
      card.append(
        safeText('h3', `Order ${order.orderId}`),
        safeText('p', itemNames),
        safeText('p', `Total: ${formatNaira(order.total)} · ${order.paymentStatus} · ${order.orderStatus}`)
      );
      list.append(card);
    }
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
