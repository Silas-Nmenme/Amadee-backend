import { api, formatNaira, safeText } from './modules/utils.js';
import { initAuth } from './modules/auth.js';
import { openModal } from './modules/modal.js';

const byId = id => document.getElementById(id);
const dashboard = byId('admin-dashboard');
const adminStatus = byId('admin-status');
const ordersList = byId('admin-orders');
const productsList = byId('admin-products');
const subscribersList = byId('admin-subscribers');
const messagesList = byId('admin-messages');
const productForm = byId('product-form');
const productField = name => productForm.elements.namedItem(name);
const promoForm = byId('promo-form');
const promoField = name => promoForm.elements.namedItem(name);
const promosList = byId('admin-promos');
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
let messagesPage = 1;
let messagesTotalPages = 1;
let productImagePublicIds = new Map();

initAuth();

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

function localDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function promoPayload(promo) {
  return {
    code: String(promo.code || '').trim().toUpperCase(),
    name: String(promo.name || promo.code || '').trim(),
    type: promo.type,
    value: Number(promo.value),
    minSubtotal: Number(promo.minSubtotal || 0),
    applicableProductCodes: Array.isArray(promo.applicableProductCodes)
      ? promo.applicableProductCodes
      : arrayField(promo.applicableProductCodes || ''),
    maxUses: promo.maxUses === '' || promo.maxUses == null ? null : Number(promo.maxUses),
    expiresAt: promo.expiresAt ? new Date(promo.expiresAt).toISOString() : null,
    active: Boolean(promo.active),
    publishAnnouncement: Boolean(promo.publishAnnouncement),
    announcementText: String(promo.announcementText || '').trim(),
  };
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
      summaryCard('Total revenue', formatNaira(summary.revenueNgn)),
    );
    setStatus('summary-status', '');
  } catch (error) {
    setStatus('summary-status', `Store summary could not be loaded: ${error.message}`);
  }
}

function safeImageUrl(value) {
  try {
    const url = new URL(value, window.location.href);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function addField(form, labelText, name, value = '', type = 'text') {
  const label = safeText('label', labelText);
  const field = type === 'textarea' ? document.createElement('textarea') : document.createElement('input');
  field.name = name;
  if (type !== 'textarea') field.type = type;
  field.value = value || '';
  label.append(field);
  form.append(label);
  return field;
}

function refreshOrderModal(order) {
  openOrderDetails(order);
  loadOrders();
}

function openOrderDetails(order) {
  openModal(`Order ${order.orderId || ''}`, modal => {
    const customer = order.customer || {};
    const itemsHeading = safeText('h3', 'Items');
    const items = document.createElement('div');
    items.className = 'order-detail-items';
    for (const item of order.items || []) {
      const row = document.createElement('article');
      row.className = 'order-detail-item';
      const imageUrl = safeImageUrl(item.image);
      if (imageUrl) {
        const image = document.createElement('img');
        image.src = imageUrl;
        image.alt = item.name || 'Product image';
        image.loading = 'lazy';
        row.append(image);
      } else {
        row.append(safeText('div', 'Image unavailable', 'order-image-placeholder'));
      }
      const details = document.createElement('div');
      details.append(
        safeText('strong', item.name || item.productId || 'Product'),
        safeText('p', `Code: ${item.productId || '—'} · Quantity: ${item.quantity}`),
        safeText('p', `Size: ${item.size || '—'} · Colour: ${item.colour || '—'}`),
        safeText('p', `Unit price: ${formatNaira(item.unitPrice)} · Line total: ${formatNaira(item.lineTotal)}`),
      );
      row.append(details);
      items.append(row);
    }

    modal.append(
      safeText('p', `${customer.name || 'Customer'} · ${customer.email || ''} · ${customer.phone || ''}`),
      safeText('p', `Order status: ${labelize(order.orderStatus)} · Payment: ${labelize(order.paymentStatus)} via ${labelize(order.paymentMethod)}`),
      ...(order.refundReference ? [safeText('p', `Refund reference: ${order.refundReference}`)] : []),
      safeText('p', `Placed: ${displayDate(order.createdAt)} · Delivery: ${labelize(order.deliveryOption)} · ${customer.address || 'No address'}`),
      ...(order.promoCode ? [safeText('p', `Promo: ${order.promoCode}${order.promoCampaignName ? ` · ${order.promoCampaignName}` : ''}`)] : []),
      itemsHeading,
      items,
    );

    if (
      order.paymentStatus === 'pending' &&
      ['bank_transfer', 'pay_on_delivery'].includes(order.paymentMethod)
    ) {
      const paymentForm = document.createElement('form');
      paymentForm.className = 'order-management-form';
      addField(paymentForm, 'Payment reference (optional)', 'paymentReference');
      const confirmPayment = safeText('button', 'Mark payment as received', 'button button-outline');
      confirmPayment.type = 'submit';
      paymentForm.append(confirmPayment);
      paymentForm.onsubmit = async event => {
        event.preventDefault();
        if (!paymentForm.reportValidity() || confirmPayment.disabled) return;
        confirmPayment.disabled = true;
        try {
          const { order: updated } = await api(`/orders/${encodeURIComponent(order.orderId)}/payment`, {
            method: 'PATCH',
            body: JSON.stringify({
              paymentReference: paymentForm.elements.paymentReference.value.trim(),
            }),
          });
          setStatus('orders-status', `Payment for ${order.orderId} was recorded.`);
          refreshOrderModal(updated);
          await loadSummary();
        } catch (error) {
          setStatus('orders-status', `Payment could not be recorded: ${error.message}`);
          confirmPayment.disabled = false;
        }
      };
      modal.append(safeText('h3', 'Payment confirmation'), paymentForm);
    }

    const measurements = order.measurements || {};
    const measurementParts = [
      ['Bust/chest', measurements.bustChest],
      ['Waist', measurements.waist],
      ['Hip', measurements.hip],
      ['Length', measurements.length],
    ].filter(([, value]) => value != null)
      .map(([label, value]) => `${label}: ${value} cm`);
    if (measurementParts.length || measurements.notes) {
      modal.append(
        safeText('h3', 'Measurements and notes'),
        safeText('p', [...measurementParts, measurements.notes].filter(Boolean).join(' · ') || 'No measurements provided.'),
      );
    }
    if (order.statusHistory?.length) {
      modal.append(safeText('h3', 'Status history'));
      const history = document.createElement('ul');
      for (const entry of order.statusHistory) {
        history.append(safeText('li', `${displayDate(entry.at)} · ${labelize(entry.status)}${entry.note ? ` — ${entry.note}` : ''}`));
      }
      modal.append(history);
    }

    modal.append(safeText('h3', 'Shipment tracking'));
    const trackingForm = document.createElement('form');
    trackingForm.className = 'order-management-form';
    const tracking = order.tracking || {};
    addField(trackingForm, 'Carrier', 'carrier', tracking.carrier);
    addField(trackingForm, 'Tracking number', 'trackingNumber', tracking.trackingNumber);
    addField(trackingForm, 'Tracking URL (HTTPS or HTTP)', 'trackingUrl', tracking.trackingUrl, 'url');
    addField(trackingForm, 'Customer-facing delivery note', 'note', tracking.note, 'textarea');
    const saveTracking = safeText('button', 'Save tracking details', 'button');
    saveTracking.type = 'submit';
    trackingForm.append(saveTracking);
    trackingForm.onsubmit = async event => {
      event.preventDefault();
      if (!trackingForm.reportValidity() || saveTracking.disabled) return;
      saveTracking.disabled = true;
      try {
        const { order: updated } = await api(`/orders/${encodeURIComponent(order.orderId)}/tracking`, {
          method: 'PATCH',
          body: JSON.stringify(Object.fromEntries(new FormData(trackingForm))),
        });
        setStatus('orders-status', `Tracking for ${order.orderId} was saved and the customer notified.`);
        refreshOrderModal(updated);
      } catch (error) {
        setStatus('orders-status', `Tracking could not be saved: ${error.message}`);
        saveTracking.disabled = false;
      }
    };
    modal.append(trackingForm);

    if (order.orderRequests?.length) {
      modal.append(safeText('h3', 'Customer cancellation and return requests'));
      for (const request of order.orderRequests) {
        const requestCard = document.createElement('article');
        requestCard.className = 'order-request-card';
        requestCard.append(
          safeText('strong', `${labelize(request.type)} · ${labelize(request.status)}`),
          safeText('p', `Submitted: ${displayDate(request.requestedAt)}`),
          safeText('p', `Reason: ${request.reason}`),
        );
        if (request.reviewNote) requestCard.append(safeText('p', `Review note: ${request.reviewNote}`));
        if (request.status === 'pending') {
          const reviewForm = document.createElement('form');
          reviewForm.className = 'order-management-form';
          addField(reviewForm, 'Response to customer (optional)', 'reviewNote', '', 'textarea');
          for (const decision of ['approved', 'rejected']) {
            const button = safeText('button', decision === 'approved' ? 'Approve request' : 'Reject request', 'button button-outline');
            button.type = 'button';
            button.onclick = async () => {
              if (button.disabled) return;
              reviewForm.querySelectorAll('button').forEach(item => { item.disabled = true; });
              try {
                const { order: updated } = await api(`/orders/${encodeURIComponent(order.orderId)}/requests/${encodeURIComponent(request._id)}`, {
                  method: 'PATCH',
                  body: JSON.stringify({
                    decision,
                    reviewNote: reviewForm.elements.reviewNote.value.trim(),
                  }),
                });
                setStatus('orders-status', `${labelize(request.type)} request ${decision}.`);
                refreshOrderModal(updated);
              } catch (error) {
                setStatus('orders-status', `Request could not be reviewed: ${error.message}`);
                reviewForm.querySelectorAll('button').forEach(item => { item.disabled = false; });
              }
            };
            reviewForm.append(button);
          }
          requestCard.append(reviewForm);
        }
        if (request.status === 'approved' && order.paymentStatus === 'paid') {
          const refundForm = document.createElement('form');
          refundForm.className = 'order-management-form';
          refundForm.append(safeText('p', 'Complete the full order refund through the payment provider or bank first. This dashboard only records a refund that has already been sent.'));
          addField(refundForm, 'Completed refund reference', 'refundReference', '', 'text').required = true;
          const confirmationLabel = safeText('label', 'I confirm the refund has already been completed', 'order-refund-confirmation');
          const confirmation = document.createElement('input');
          confirmation.type = 'checkbox';
          confirmation.name = 'confirmRefunded';
          confirmation.required = true;
          confirmationLabel.append(confirmation);
          refundForm.append(confirmationLabel);
          const refundButton = safeText('button', 'Record completed refund', 'button button-outline');
          refundButton.type = 'submit';
          refundForm.append(refundButton);
          refundForm.onsubmit = async event => {
            event.preventDefault();
            if (!refundForm.reportValidity() || refundButton.disabled) return;
            refundButton.disabled = true;
            try {
              const { order: updated } = await api(`/orders/${encodeURIComponent(order.orderId)}/requests/${encodeURIComponent(request._id)}/refund`, {
                method: 'POST',
                body: JSON.stringify({
                  refundReference: refundForm.elements.refundReference.value.trim(),
                  confirmRefunded: refundForm.elements.confirmRefunded.checked,
                }),
              });
              setStatus('orders-status', `Refund for ${order.orderId} recorded.`);
              refreshOrderModal(updated);
              await loadSummary();
            } catch (error) {
              setStatus('orders-status', `Refund could not be recorded: ${error.message}`);
              refundButton.disabled = false;
            }
          };
          requestCard.append(refundForm);
        }
        modal.append(requestCard);
      }
    }

    modal.append(
      safeText('p', `Subtotal: ${formatNaira(order.subtotal)} · Discount: ${formatNaira(order.discount)} · Delivery: ${formatNaira(order.deliveryFee)}`),
      safeText('strong', `Order total: ${formatNaira(order.total)}`),
    );
  });
}

function renderOrder(order) {
  const card = document.createElement('article');
  card.className = 'admin-record admin-order-record';
  const customer = order.customer || {};
  const details = document.createElement('div');
  details.className = 'admin-record-details';
  const openButton = safeText('button', order.orderId || 'Order', 'order-detail-trigger');
  openButton.type = 'button';
  openButton.onclick = () => openOrderDetails(order);
  details.append(
    openButton,
    safeText('p', `${customer.name || 'Customer'} · ${customer.email || ''} · ${customer.phone || ''}`),
    safeText('p', `${(order.items || []).length} item line${(order.items || []).length === 1 ? '' : 's'} · ${formatNaira(order.total)} · ${labelize(order.paymentStatus)} · ${displayDate(order.createdAt)}`),
  );
  const images = document.createElement('div');
  images.className = 'order-image-strip';
  for (const item of (order.items || []).slice(0, 4)) {
    const imageUrl = safeImageUrl(item.image);
    if (!imageUrl) continue;
    const image = document.createElement('img');
    image.src = imageUrl;
    image.alt = item.name || 'Order item';
    image.loading = 'lazy';
    image.title = item.name || '';
    images.append(image);
  }
  if (images.childElementCount) details.append(images);
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
  productImagePublicIds = new Map();
  productField('id').value = '';
  productField('lowStockThreshold').value = '5';
  productField('active').checked = true;
  renderProductImagePreviews();
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
  productImagePublicIds = new Map(
    (product.images || []).map((url, index) => [
      url,
      product.imagePublicIds?.[index] || '',
    ])
  );
  renderProductImagePreviews();
  productField('sizes').value = (product.sizes || []).join('\n');
  productField('colours').value = (product.colours || []).join('\n');
  productField('featured').checked = Boolean(product.featured);
  productField('active').checked = product.active !== false;
  byId('product-form-title').textContent = `Edit ${product.productCode}`;
  setStatus('product-form-status', '');
  productForm.hidden = false;
  productForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function currentProductImageUrls() {
  return arrayField(productField('images').value);
}

function renderProductImagePreviews() {
  const container = byId('product-image-previews');
  if (!container) return;
  const urls = currentProductImageUrls();
  const currentUrls = new Set(urls);
  for (const url of productImagePublicIds.keys()) {
    if (!currentUrls.has(url)) productImagePublicIds.delete(url);
  }
  container.replaceChildren();

  for (const [index, url] of urls.entries()) {
    const preview = document.createElement('div');
    preview.className = 'product-image-preview';
    const image = document.createElement('img');
    image.src = url;
    image.alt = `Product image ${index + 1}`;
    image.loading = 'lazy';
    image.onerror = () => {
      image.onerror = null;
      image.alt = `Preview unavailable for product image ${index + 1}`;
    };
    const remove = safeText('button', 'Remove image', 'text-button');
    remove.type = 'button';
    remove.setAttribute('aria-label', `Remove product image ${index + 1}`);
    remove.onclick = () => {
      productField('images').value = currentProductImageUrls()
        .filter((_, urlIndex) => urlIndex !== index)
        .join('\n');
      renderProductImagePreviews();
    };
    preview.append(image, remove);
    container.append(preview);
  }
}

async function uploadProductImageFiles() {
  const input = productField('imageFiles');
  const files = [...input.files];
  if (!files.length) return;
  const existingUrls = currentProductImageUrls();
  if (existingUrls.length + files.length > 20) {
    setStatus('product-form-status', 'A product can have up to 20 images.');
    input.value = '';
    return;
  }

  input.disabled = true;
  setStatus('product-form-status', `Uploading ${files.length} image${files.length === 1 ? '' : 's'} to Cloudinary…`);
  try {
    const body = new FormData();
    files.forEach(file => body.append('images', file));
    const { images } = await api('/admin/products/images', {
      method: 'POST',
      body,
    });
    const urls = [...existingUrls];
    for (const image of images) {
      if (!image?.url || !image?.publicId) {
        throw new Error('Cloudinary returned incomplete image information.');
      }
      urls.push(image.url);
      productImagePublicIds.set(image.url, image.publicId);
    }
    productField('images').value = urls.join('\n');
    renderProductImagePreviews();
    setStatus('product-form-status', `${images.length} image${images.length === 1 ? '' : 's'} uploaded. Save the product to keep these images.`);
  } catch (error) {
    setStatus('product-form-status', `Images could not be uploaded: ${error.message}`);
  } finally {
    input.value = '';
    input.disabled = false;
  }
}

function renderProduct(product) {
  const card = document.createElement('article');
  card.className = 'admin-record';
  const info = document.createElement('div');
  info.className = 'admin-record-details';
  if (product.images?.[0]) {
    const image = document.createElement('img');
    image.src = product.images[0];
    image.alt = '';
    image.loading = 'lazy';
    image.width = 72;
    image.height = 72;
    image.style.cssText = 'float:left;width:72px;height:72px;object-fit:cover;border-radius:8px;margin:0 12px 8px 0';
    info.append(image);
  }
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

function resetPromoForm() {
  promoForm.reset();
  promoField('id').value = '';
  promoField('minSubtotal').value = '0';
  promoField('active').checked = true;
  byId('promo-form-title').textContent = 'Create a campaign';
  setStatus('promo-form-status', '');
}

function editPromo(promo) {
  promoField('id').value = promo._id;
  promoField('name').value = promo.name || promo.code || '';
  promoField('code').value = promo.code || '';
  promoField('type').value = promo.type || 'percent';
  promoField('value').value = promo.value ?? 1;
  promoField('minSubtotal').value = promo.minSubtotal ?? 0;
  promoField('maxUses').value = promo.maxUses ?? '';
  promoField('expiresAt').value = localDateTime(promo.expiresAt);
  promoField('applicableProductCodes').value = (promo.applicableProductCodes || []).join('\n');
  promoField('announcementText').value = promo.announcementText || '';
  promoField('publishAnnouncement').checked = Boolean(promo.publishAnnouncement);
  promoField('active').checked = promo.active !== false;
  byId('promo-form-title').textContent = `Edit ${promo.code}`;
  setStatus('promo-form-status', '');
  promoForm.hidden = false;
  promoForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderPromo(promo) {
  const card = document.createElement('article');
  card.className = 'admin-record';
  const info = document.createElement('div');
  info.className = 'admin-record-details';
  const discount = promo.type === 'percent' ? `${promo.value}% off` : `${formatNaira(promo.value)} off`;
  const expiry = promo.expiresAt ? ` · Expires ${displayDate(promo.expiresAt)}` : '';
  const usage = promo.maxUses == null ? `${promo.uses || 0} redemptions · unlimited` : `${promo.uses || 0} / ${promo.maxUses} redemptions`;
  info.append(
    safeText('h3', `${promo.name || promo.code} · ${promo.code}`),
    safeText('p', `${discount} · Minimum order ${formatNaira(promo.minSubtotal || 0)}${expiry}`),
    safeText('p', `${usage} · One redemption per customer · ${promo.active ? 'Active' : 'Inactive'}${promo.publishAnnouncement ? ' · Announcement published' : ''}`),
  );
  const actions = document.createElement('div');
  actions.className = 'admin-record-actions';
  const edit = safeText('button', 'Edit', 'button button-outline');
  edit.type = 'button';
  edit.onclick = () => editPromo(promo);
  const toggle = safeText('button', promo.active ? 'Deactivate' : 'Activate', 'button button-outline');
  toggle.type = 'button';
  toggle.onclick = async () => {
    toggle.disabled = true;
    try {
      await api(`/admin/promos/${encodeURIComponent(promo._id)}`, {
        method: 'PATCH',
        body: JSON.stringify(promoPayload({ ...promo, active: !promo.active })),
      });
      setStatus('promos-status', `${promo.code} ${promo.active ? 'deactivated' : 'activated'}.`);
      await loadPromos();
    } catch (error) {
      setStatus('promos-status', `Campaign could not be updated: ${error.message}`);
      toggle.disabled = false;
    }
  };
  actions.append(edit, toggle);
  card.append(info, actions);
  return card;
}

async function loadPromos() {
  setStatus('promos-status', 'Loading promo campaigns…');
  try {
    const { promotions } = await api('/admin/promos');
    promosList.replaceChildren();
    if (!promotions.length) promosList.append(safeText('p', 'No campaigns have been created yet.'));
    else promotions.forEach(promo => promosList.append(renderPromo(promo)));
    setStatus('promos-status', `${promotions.length} campaign${promotions.length === 1 ? '' : 's'}.`);
  } catch (error) {
    setStatus('promos-status', `Campaigns could not be loaded: ${error.message}`);
  }
}

async function savePromo(event) {
  event.preventDefault();
  if (!promoForm.reportValidity()) return;
  const submit = promoForm.querySelector('[type="submit"]');
  if (submit.disabled) return;
  submit.disabled = true;
  setStatus('promo-form-status', 'Saving campaign…');
  try {
    const id = promoField('id').value;
    const payload = promoPayload({
      code: promoField('code').value,
      name: promoField('name').value,
      type: promoField('type').value,
      value: promoField('value').value,
      minSubtotal: promoField('minSubtotal').value,
      maxUses: promoField('maxUses').value,
      expiresAt: promoField('expiresAt').value,
      applicableProductCodes: promoField('applicableProductCodes').value,
      announcementText: promoField('announcementText').value,
      publishAnnouncement: promoField('publishAnnouncement').checked,
      active: promoField('active').checked,
    });
    const response = await api(id ? `/admin/promos/${encodeURIComponent(id)}` : '/admin/promos', {
      method: id ? 'PATCH' : 'POST',
      body: JSON.stringify(payload),
    });
    setStatus('promos-status', response.message || 'Campaign saved.');
    promoForm.hidden = true;
    resetPromoForm();
    await loadPromos();
  } catch (error) {
    setStatus('promo-form-status', `Campaign could not be saved: ${error.message}`);
  } finally {
    submit.disabled = false;
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
    imagePublicIds: arrayField(productField('images').value)
      .map(url => productImagePublicIds.get(url) || ''),
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

function renderMessage(message) {
  const record = document.createElement('article');
  record.className = 'admin-record';
  const details = document.createElement('div');
  details.className = 'admin-record-details';
  const reply = safeText('a', message.email);
  reply.href = `mailto:${encodeURIComponent(message.email || '')}`;
  details.append(
    safeText('h3', message.name || 'Customer enquiry'),
    reply,
    safeText('time', displayDate(message.createdAt)),
    safeText('p', message.message, 'contact-message-body'),
    safeText('p', message.handled ? 'Handled' : 'Needs a reply', 'eyebrow'),
  );
  const toggle = safeText('button', message.handled ? 'Reopen' : 'Mark handled', 'button button-outline');
  toggle.type = 'button';
  toggle.onclick = async () => {
    toggle.disabled = true;
    try {
      await api(`/admin/messages/${encodeURIComponent(message._id)}/handled`, {
        method: 'PATCH',
        body: JSON.stringify({ handled: !message.handled }),
      });
      await loadMessages();
    } catch (error) {
      setStatus('messages-status', `Message could not be updated: ${error.message}`);
      toggle.disabled = false;
    }
  };
  record.append(details, toggle);
  return record;
}

async function loadMessages() {
  setStatus('messages-status', 'Loading contact messages…');
  try {
    const { messages, unhandled, pagination } = await api(`/admin/messages?page=${messagesPage}&limit=25`);
    messagesList.replaceChildren();
    if (!messages.length) messagesList.append(safeText('p', 'No contact messages yet.'));
    else messages.forEach(message => messagesList.append(renderMessage(message)));
    messagesTotalPages = Math.max(1, pagination.pages);
    messagesPage = pagination.page;
    byId('messages-page').textContent = `Page ${messagesPage} of ${messagesTotalPages} · ${unhandled} awaiting a reply`;
    byId('messages-previous').disabled = messagesPage <= 1;
    byId('messages-next').disabled = messagesPage >= messagesTotalPages;
    setStatus('messages-status', '');
  } catch (error) {
    setStatus('messages-status', `Contact messages could not be loaded: ${error.message}`);
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
byId('new-promo').onclick = () => {
  resetPromoForm();
  promoForm.hidden = false;
  promoForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
byId('cancel-promo').onclick = () => {
  promoForm.hidden = true;
  resetPromoForm();
};
byId('cancel-product').onclick = () => {
  productForm.hidden = true;
  resetProductForm();
};
byId('refresh-subscribers').onclick = loadSubscribers;
byId('refresh-messages').onclick = loadMessages;
byId('messages-previous').onclick = () => {
  if (messagesPage > 1) {
    messagesPage -= 1;
    loadMessages();
  }
};
byId('messages-next').onclick = () => {
  if (messagesPage < messagesTotalPages) {
    messagesPage += 1;
    loadMessages();
  }
};
productForm.addEventListener('submit', saveProduct);
promoForm.addEventListener('submit', savePromo);
productField('images').addEventListener('input', renderProductImagePreviews);
productField('imageFiles').addEventListener('change', uploadProductImageFiles);

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
    await Promise.all([loadSummary(), loadOrders(), loadProducts(), loadPromos(), loadSubscribers(), loadMessages()]);
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
