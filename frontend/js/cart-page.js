import { initCart, loadCart, getCart, getSubtotal, updateQuantity, updateOptions, removeItem, clearCart, whatsappUrl } from './modules/cart.js';
import { byId, safeText, formatNaira } from './modules/utils.js';
import { openModal, closeModal } from './modules/modal.js';
const delivery = { pickup: { fee: 0, label: 'Pick-up', time: 'Arrange a collection time with our team.' }, lagos: { fee: 2000, label: 'Within Lagos', time: 'Estimated 2–5 business days after production.' }, outside: { fee: 5000, label: 'Outside Lagos', time: 'Estimated 4–8 business days after production.' } };
let busy = false;
byId('year').textContent = new Date().getFullYear();
function button(text, label, action) {
  const b = safeText('button', text); b.type = 'button'; b.setAttribute('aria-label', label);
  b.onclick = () => perform(action); return b;
}
async function perform(action) {
  if (busy) return;
  const focus = document.activeElement;
  const key = focus?.dataset.focus;
  busy = true;
  document.querySelectorAll('#cart-content button, #cart-content select').forEach(x => x.disabled = true);
  byId('cart-status').textContent = 'Saving your cart…';
  try { await action(); byId('cart-status').textContent = 'Your cart is saved.'; }
  catch { byId('cart-status').textContent = 'Changes were not saved. Please try again.'; }
  finally {
    busy = false; render();
    const target = [...document.querySelectorAll('[data-focus]')].find(x => x.dataset.focus === key);
    (target || (getCart().length ? byId('items-title') : byId('empty-cart').querySelector('a')))?.focus();
  }
}
function renderSummary() {
  const option = delivery[byId('delivery').value];
  byId('subtotal').textContent = formatNaira(getSubtotal());
  byId('delivery-fee').textContent = option.fee ? formatNaira(option.fee) : 'Free';
  byId('total').textContent = formatNaira(getSubtotal() + option.fee);
  byId('delivery-time').textContent = option.time;
}
function render() {
  const items = getCart();
  byId('cart-content').hidden = !items.length;
  byId('empty-cart').hidden = !!items.length;
  const list = byId('cart-items'); list.replaceChildren();
  items.forEach((item, index) => {
    const p = item.product;
    const row = document.createElement('article'); row.className = 'cart-item';
    const img = document.createElement('img'); img.src = p.images[0]; img.alt = p.name; img.loading = 'lazy';
    img.onerror = () => { img.onerror = null; img.src = '/assets/images/products/garment-placeholder.svg'; };
    const body = document.createElement('div');
    const top = document.createElement('div'); top.className = 'item-top'; top.append(safeText('h3', p.name), safeText('strong', formatNaira(p.price * item.quantity)));
    const options = document.createElement('div'); options.className = 'item-options';
    for (const [field, title, values] of [['size', 'Size', p.sizes], ['colour', 'Colour', p.colours]]) {
      const label = safeText('label', title); const select = document.createElement('select');
      select.setAttribute('aria-label', `${title} for ${p.name}`); select.dataset.focus = `${index}-${field}`;
      values.forEach(value => { const option = safeText('option', value); option.value = value; select.append(option); });
      select.value = item[field]; select.disabled = busy;
      select.onchange = () => perform(() => updateOptions(index, { [field]: select.value }));
      label.append(select); options.append(label);
    }
    const bottom = document.createElement('div'); bottom.className = 'item-bottom';
    const controls = document.createElement('div'); controls.className = 'cart-quantity';
    const minus = button('−', `Decrease quantity of ${p.name}`, () => updateQuantity(index, -1));
    const plus = button('+', `Increase quantity of ${p.name}`, () => updateQuantity(index, 1));
    minus.disabled = busy || item.quantity === 1; plus.disabled = busy || item.quantity === 20;
    minus.dataset.focus = `${index}-minus`; plus.dataset.focus = `${index}-plus`;
    controls.append(minus, safeText('span', item.quantity), plus);
    const remove = button('Remove', `Remove ${p.name}, ${item.size}, ${item.colour}`, () => removeItem(index));
    remove.className = 'text-button'; remove.disabled = busy; remove.dataset.focus = `${index}-remove`;
    bottom.append(controls, remove);
    body.append(top, safeText('p', `${formatNaira(p.price)} each`, 'item-price'), options, bottom);
    row.append(img, body); list.append(row);
  });
  byId('items-title').textContent = `Your selections (${items.reduce((sum, x) => sum + x.quantity, 0)})`;
  byId('items-title').tabIndex = -1;
  byId('clear-cart').disabled = busy; byId('delivery').disabled = busy; byId('checkout').disabled = busy;
  renderSummary();
}
function confirmClear() {
  openModal('Clear your cart?', modal => {
    modal.append(safeText('p', 'All selections will be removed from your saved cart.'));
    const actions = document.createElement('div'); actions.className = 'modal-actions';
    const keep = button('Keep shopping', 'Keep items in cart', async () => closeModal()); keep.className = 'button button-outline';
    const clear = button('Clear cart', 'Confirm clearing cart', async () => { closeModal(); await clearCart(); }); clear.className = 'button';
    actions.append(keep, clear); modal.append(actions);
  });
}
function checkout() {
  if (busy || !getCart().length) return;
  openModal('Send your order request', modal => {
    modal.append(safeText('p', 'Our team confirms availability, fit, delivery and payment with you on WhatsApp. Sending a message does not reserve items.'));
    const form = document.createElement('form');
    for (const [name, title, required] of [['name', 'Your name', true], ['address', 'Delivery address (required for delivery)', byId('delivery').value !== 'pickup'], ['notes', 'Measurements or special requests (optional)', false]]) {
      const label = safeText('label', title); const input = document.createElement(name === 'notes' ? 'textarea' : 'input');
      input.name = name; input.required = required; input.maxLength = name === 'notes' ? 1000 : 300;
      if (name !== 'notes') input.autocomplete = name === 'name' ? 'name' : 'street-address';
      label.append(input); form.append(label);
    }
    form.append(safeText('p', `Estimated total: ${byId('total').textContent}. Your cart stays saved until you clear it.`, 'notice'));
    const submit = safeText('button', 'Open WhatsApp', 'button'); submit.type = 'submit'; form.append(submit);
    form.onsubmit = e => {
      e.preventDefault(); if (!form.reportValidity()) return;
      const values = Object.fromEntries(new FormData(form)); const option = delivery[byId('delivery').value];
      const extra = `\nDelivery: ${option.label} (${formatNaira(option.fee)})\nEstimated total: ${formatNaira(getSubtotal() + option.fee)}\nName: ${values.name}\nAddress: ${values.address || 'Pick-up'}\nNotes: ${values.notes || 'None'}`;
      window.location.assign(whatsappUrl(extra));
    };
    modal.append(form);
  });
}
byId('delivery').onchange = renderSummary;
byId('clear-cart').onclick = confirmClear;
byId('checkout').onclick = checkout;
window.addEventListener('amadee:cart-change', render);
async function start(retry = false) {
  byId('retry-cart').hidden = true; byId('cart-status').textContent = 'Loading your saved cart…';
  try { await (retry ? loadCart() : initCart()); render(); byId('cart-status').textContent = 'Your selections are saved for your next visit.'; }
  catch { byId('cart-status').textContent = 'Your cart is unavailable right now. Please try again.'; byId('retry-cart').hidden = false; }
}
byId('retry-cart').onclick = () => start(true);
start();
