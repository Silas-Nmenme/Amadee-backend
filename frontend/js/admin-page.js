import { api, formatNaira, safeText } from './modules/utils.js';

const byId = id => document.getElementById(id);
const dashboard = byId('admin-dashboard');
const adminStatus = byId('admin-status');
const ordersList = byId('admin-orders');
const productsList = byId('admin-products');
const subscribersList = byId('admin-subscribers');
const productForm = byId('product-form');
const productField = name => productForm.elements.namedItem(name);
const orderStatuses = [
  'received',
  'confirmed',
  'in_production',
  'ready',
  'dispatched',
  'completed',
  'cancelled',
];
let currentPage = 1;
let totalPages = 1;

function setStatus(id, message) {
  byId(id).textContent = message;
}

function labelize(value) {
  return String(value || '').replaceAll('_', ' ');
}

function displayDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : date.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
}

function summaryCard(label, value) {
  const card = document.createElement('article');
  card.className = 'admin-stat-card';
  card.append(safeText('p', label), safeText('strong', value));
  return card;
}

async function loadSummary() {
  setStatus('summary-status', 'Loading store summary…');
  try {
    const { summary } = await api('/admin/summary');
    byId('summary-cards').replaceChildren(
      summaryCard('Orders', summary.orders),
      summaryCard('Paid orders', summary.paidOrders),
      summaryCard('Customers', summary.customers),
      summaryCard('Pending reviews', summary.pendingReviews),
      summaryCard('Active subscribers', summary.subscribers),
      summaryCard('Paid revenue', formatNaira(summary.revenueNgn)),
    );
    setStatus('summary-status', '');
  } catch (error) {
    setStatus('summary-status', `Store summary could not be loaded: ${error.message}`);
  }
}

function renderOrder(order) {
  const card = document.createElement('article');
  card.className = 'admin-record';
  const customer = order.customer || {};
  const itemSummary = (order.items || [])
    .map(item => `${item.name} × ${item.quantity}${item.size ? ` · ${item.size}` : ''}${item.colour ? ` · ${item.colour}` : ''}`)
    .join(', ');
  const details = document.createElement('div');
  details.className = 'admin-record-details';
  details.append(
    safeText('h3', order.orderId || 'Order'),
    safeText('p', `${customer.name || 'Customer'} · ${customer.email || ''} · ${customer.phone || ''}`),
    safeText('p', `${itemSummary || 'No item details'} · ${formatNaira(order.total)} · ${labelize(order.paymentMethod)} / ${labelize(order.paymentStatus)}`),
    safeText('p', `${customer.address || 'No address'} · ${labelize(order.deliveryOption)} · ${displayDate(order.createdAt)}`),
  );
  const controls = document.createElement('div');
  controls.className = 'admin-record-controls';
  const label = safeText('label', 'Order status');
  const select = document.createElement('select');
  select.setAttribute('aria-label', `Status for ${order.orderId}`);
  for (const value of orderStatuses) {
    const option = safeText('option', labelize(value));
    option.value = value;
    select.append(option);
  }
  select.value = order.orderStatus;
  select.onchange = async () => {
    select.disabled = true;
    try {
      await api(`/orders/${encodeURIComponent(order.orderId)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ orderStatus: select.value }),
      });
      setStatus('orders-status', `Order ${order.orderId} updated.`);
      await loadOrders();
      await loadSummary();
    } catch (error) {
      setStatus('orders-status', `Order status could not be updated: ${error.message}`);
      select.value = order.orderStatus;
      select.disabled = false;
    }
  };
  label.append(select);
  controls.append(label);
  card.append(details, controls);
  return card;
}

async function loadOrders() {
  setStatus('orders-status', 'Loading orders…');
  try {
    const { orders, pagination } = await api(`/orders?page=${currentPage}&limit=25`);
    ordersList.replaceChildren();
    if (!orders.length) ordersList.append(safeText('p', 'No orders have been placed yet.'));
    else orders.forEach(order => ordersList.append(renderOrder(order)));
    totalPages = Math.max(1, pagination.pages);
    currentPage = pagination.page;
    byId('orders-page').textContent = `Page ${currentPage} of ${totalPages} · ${pagination.total} orders`;
    byId('orders-previous').disabled = currentPage <= 1;
    byId('orders-next').disabled = currentPage >= totalPages;
    setStatus('orders-status', '');
  } catch (error) {
    setStatus('orders-status', `Orders could not be loaded: ${error.message}`);
  }
}

function arrayField(value) {
  return value.split(/\r?\n/).map(entry => entry.trim()).filter(Boolean);
}

function resetProductForm() {
  productForm.reset();
  productField('id').value = '';
  productField('lowStockThreshold').value = '5';
  productField('active').checked = true;
  byId('product-form-title').textContent = 'Add a product';
  setStatus('product-form-status', '');
}

function editProduct(product) {
  productField('id').value = product._id;
  productField('productCode').value = product.productCode || '';
  productField('name').value = product.name || '';
  productField('category').value = product.category || '';
  productField('price').value = product.price ?? 0;
  productField('stock').value = product.stock ?? 0;
  productField('lowStockThreshold').value = product.lowStockThreshold ?? 5;
  productField('description').value = product.description || '';
  productField('images').value = (product.images || []).join('\n');
  productField('sizes').value = (product.sizes || []).join('\n');
  productField('colours').value = (product.colours || []).join('\n');
  productField('featured').checked = Boolean(product.featured);
  productField('active').checked = product.active !== false;
  byId('product-form-title').textContent = `Edit ${product.productCode}`;
  setStatus('product-form-status', '');
  productForm.hidden = false;
  productForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderProduct(product) {
  const card = document.createElement('article');
  card.className = 'admin-record';
  const info = document.createElement('div');
  info.className = 'admin-record-details';
  info.append(
    safeText('h3', `${product.name} · ${product.productCode}`),
    safeText('p', `${product.category} · ${formatNaira(product.price)} · Stock: ${product.stock} · Low-stock threshold: ${product.lowStockThreshold}`),
    safeText('p', `${product.active ? 'Active' : 'Inactive'}${product.featured ? ' · Featured' : ''}${product.stock <= product.lowStockThreshold ? ' · Low stock' : ''}`),
  );
  const actions = document.createElement('div');
  actions.className = 'admin-record-actions';
  const edit = safeText('button', 'Edit', 'button button-outline');
  edit.type = 'button';
  edit.onclick = () => editProduct(product);
  actions.append(edit);
  if (product.active) {
    const deactivate = safeText('button', 'Deactivate', 'button button-outline');
    deactivate.type = 'button';
    deactivate.onclick = async () => {
      deactivate.disabled = true;
      try {
        await api(`/admin/products/${encodeURIComponent(product._id)}`, { method: 'DELETE' });
        setStatus('products-status', `${product.productCode} has been deactivated.`);
        await loadProducts();
      } catch (error) {
        setStatus('products-status', `Product could not be deactivated: ${error.message}`);
        deactivate.disabled = false;
      }
    };
    actions.append(deactivate);
  }
  card.append(info, actions);
  return card;
}

async function loadProducts() {
  setStatus('products-status', 'Loading catalogue and inventory…');
  try {
    const { products } = await api('/admin/products');
    productsList.replaceChildren();
    if (!products.length) productsList.append(safeText('p', 'No products are in the catalogue.'));
    else products.forEach(product => productsList.append(renderProduct(product)));
    setStatus('products-status', `${products.length} catalogue products.`);
  } catch (error) {
    setStatus('products-status', `Products could not be loaded: ${error.message}`);
  }
}

async function saveProduct(event) {
  event.preventDefault();
  if (!productForm.reportValidity()) return;
  const submit = productForm.querySelector('[type="submit"]');
  if (submit.disabled) return;
  submit.disabled = true;
  setStatus('product-form-status', 'Saving product…');
  const payload = {
    productCode: productField('productCode').value.trim(),
    name: productField('name').value.trim(),
    category: productField('category').value.trim(),
    description: productField('description').value.trim(),
    price: Number(productField('price').value),
    stock: Number(productField('stock').value),
    lowStockThreshold: Number(productField('lowStockThreshold').value),
    images: arrayField(productField('images').value),
    sizes: arrayField(productField('sizes').value),
    colours: arrayField(productField('colours').value),
    featured: productField('featured').checked,
    active: productField('active').checked,
  };
  try {
    const id = productField('id').value;
    const response = await api(
      id ? `/admin/products/${encodeURIComponent(id)}` : '/admin/products',
      {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      },
    );
    setStatus('products-status', response.message || 'Product saved.');
    productForm.hidden = true;
    resetProductForm();
    await loadProducts();
  } catch (error) {
    setStatus('product-form-status', `Product could not be saved: ${error.message}`);
  } finally {
    submit.disabled = false;
  }
}

async function loadSubscribers() {
  setStatus('subscribers-status', 'Loading subscribers…');
  try {
    const { subscribers, count } = await api('/admin/subscribers');
    subscribersList.replaceChildren();
    if (!count) subscribersList.append(safeText('p', 'No active subscribers yet.'));
    else {
      for (const subscriber of subscribers) {
        const row = document.createElement('div');
        row.className = 'admin-subscriber';
        row.append(
          safeText('span', subscriber.email),
          safeText('time', displayDate(subscriber.subscribedAt)),
        );
        subscribersList.append(row);
      }
    }
    setStatus('subscribers-status', `${count} active subscribers.`);
  } catch (error) {
    setStatus('subscribers-status', `Subscribers could not be loaded: ${error.message}`);
  }
}

byId('refresh-orders').onclick = loadOrders;
byId('orders-previous').onclick = () => {
  if (currentPage > 1) {
    currentPage -= 1;
    loadOrders();
  }
};
byId('orders-next').onclick = () => {
  if (currentPage < totalPages) {
    currentPage += 1;
    loadOrders();
  }
};
byId('new-product').onclick = () => {
  resetProductForm();
  productForm.hidden = false;
  productForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
byId('cancel-product').onclick = () => {
  productForm.hidden = true;
  resetProductForm();
};
byId('refresh-subscribers').onclick = loadSubscribers;
productForm.addEventListener('submit', saveProduct);

byId('admin-signout').onclick = async event => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    await api('/auth/logout', { method: 'POST' });
    window.location.assign('./signin.html');
  } catch (error) {
    adminStatus.textContent = `Sign out failed: ${error.message}`;
    button.disabled = false;
  }
};

async function start() {
  try {
    const { user } = await api('/auth/me');
    if (user.role !== 'admin') {
      adminStatus.textContent = 'This workspace is only available to administrators.';
      window.setTimeout(() => window.location.assign('./account.html'), 1200);
      return;
    }
    adminStatus.textContent = `Signed in as ${user.name} · ${user.email}`;
    dashboard.hidden = false;
    await Promise.all([loadSummary(), loadOrders(), loadProducts(), loadSubscribers()]);
  } catch (error) {
    if (error.status === 401) {
      adminStatus.textContent = 'Sign in with an administrator account to continue.';
      byId('admin-signin').hidden = false;
      return;
    }
    adminStatus.textContent = `Administrator access could not be checked: ${error.message}`;
  }
}

start();
