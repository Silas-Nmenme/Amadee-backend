import { products } from './data/products.js';
import { api, formatNaira, safeText } from './modules/utils.js';
import { addToCart, initCart } from './modules/cart.js';
import { initAuth } from './modules/auth.js';
import { getWishlist, initWishlist, toggleWishlist } from './modules/wishlist.js';
import { loadProductsCatalogue } from './modules/products.js';
import { toast } from './modules/toast.js';

const status = document.getElementById('product-status');
const detail = document.getElementById('product-detail');
const missing = document.getElementById('product-missing');

function productFromRecord(record) {
  return {
    id: record.productCode,
    name: record.name,
    category: record.category,
    price: Number(record.price),
    images: Array.isArray(record.images) && record.images.length
      ? record.images
      : ['/assets/images/products/garment-placeholder.svg'],
    sizes: Array.isArray(record.sizes) && record.sizes.length ? record.sizes : ['One size'],
    colours: Array.isArray(record.colours) && record.colours.length ? record.colours : ['Customer choice'],
    description: record.description || '',
    inStock: record.active !== false && Number(record.stock) > 0,
    backendAvailable: true,
  };
}

function renderProduct(product) {
  detail.replaceChildren();
  const gallery = document.createElement('div');
  gallery.className = 'product-gallery';
  const mainImage = document.createElement('img');
  mainImage.className = 'product-main-image';
  mainImage.src = product.images[0];
  mainImage.alt = product.name;
  mainImage.width = 800;
  mainImage.height = 1000;
  mainImage.onerror = () => { mainImage.onerror = null; mainImage.src = '/assets/images/products/garment-placeholder.svg'; };
  gallery.append(mainImage);
  if (product.images.length > 1) {
    const thumbnails = document.createElement('div');
    thumbnails.className = 'product-thumbnails';
    product.images.forEach((url, index) => {
      const thumbnail = document.createElement('button');
      thumbnail.type = 'button';
      thumbnail.className = 'product-thumbnail';
      thumbnail.setAttribute('aria-label', `Show product image ${index + 1}`);
      const image = document.createElement('img');
      image.src = url;
      image.alt = '';
      image.loading = 'lazy';
      thumbnail.append(image);
      thumbnail.onclick = () => { mainImage.src = url; };
      thumbnails.append(thumbnail);
    });
    gallery.append(thumbnails);
  }

  const info = document.createElement('section');
  info.className = 'product-detail-info';
  info.append(
    safeText('p', product.category, 'eyebrow'),
    safeText('h1', product.name),
    safeText('p', formatNaira(product.price), 'price'),
    safeText('p', product.description),
  );
  const form = document.createElement('form');
  form.className = 'product-option-form';
  for (const [name, title, values] of [['size', 'Size', product.sizes], ['colour', 'Colour', product.colours]]) {
    const label = safeText('label', title);
    const select = document.createElement('select');
    select.name = name;
    select.required = true;
    values.forEach(value => {
      const option = safeText('option', value);
      option.value = value;
      select.append(option);
    });
    label.append(select);
    form.append(label);
  }
  const quantityLabel = safeText('label', 'Quantity');
  const quantity = document.createElement('input');
  quantity.name = 'quantity';
  quantity.type = 'number';
  quantity.min = '1';
  quantity.max = '20';
  quantity.value = '1';
  quantity.required = true;
  quantityLabel.append(quantity);
  form.append(quantityLabel);

  const actions = document.createElement('div');
  actions.className = 'product-detail-actions';
  const add = safeText('button', product.inStock ? 'Add to cart' : 'Currently unavailable', 'button');
  add.type = 'submit';
  add.disabled = !product.inStock;
  const heart = safeText('button', getWishlist().includes(product.id) ? '♥' : '♡', 'button button-outline');
  heart.type = 'button';
  const updateHeart = () => {
    const saved = getWishlist().includes(product.id);
    heart.textContent = saved ? '♥' : '♡';
    heart.setAttribute('aria-pressed', String(saved));
    heart.setAttribute('aria-label', `${saved ? 'Remove' : 'Save'} ${product.name} ${saved ? 'from' : 'to'} wishlist`);
  };
  updateHeart();
  window.addEventListener('amadee:wishlist-change', updateHeart);
  heart.onclick = async () => {
    heart.disabled = true;
    try {
      const saved = await toggleWishlist(product.id);
      updateHeart();
      toast(saved ? 'Saved to wishlist.' : 'Removed from wishlist.');
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      heart.disabled = false;
    }
  };
  actions.append(add, heart);
  form.append(actions);
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const count = Number(quantity.value);
    if (!Number.isInteger(count) || count < 1 || count > 20) return;
    addToCart(product.id, count, {
      size: form.elements.size.value,
      colour: form.elements.colour.value,
    });
  });
  info.append(form);
  const sizeGuide = safeText('a', 'View the measurement guide');
  sizeGuide.href = './size-guide.html';
  info.append(sizeGuide);
  detail.append(gallery, info, buildProductReviews(product.id));
  detail.hidden = false;
  status.textContent = product.backendAvailable ? '' : 'Showing the preview catalogue. Orders for preview-only styles can be requested on WhatsApp.';
  document.title = `${product.name} | Amadee-Stiches`;
}

function buildProductReviews(productId) {
  const section = document.createElement('section');
  section.className = 'product-reviews';
  section.append(safeText('h2', 'Customer reviews'));
  const list = document.createElement('div');
  list.className = 'reviews-list';
  const reviewStatus = safeText('p', 'Loading reviews…', 'form-status');
  reviewStatus.setAttribute('role', 'status');
  const form = document.createElement('form');
  form.className = 'form-card';
  form.append(safeText('h3', 'Share your experience'));
  const submitStatus = safeText('p', '', 'form-status');
  submitStatus.setAttribute('role', 'status');
  form.append(submitStatus);
  const fields = [
    ['name', 'Your name', 'input'],
    ['rating', 'Rating', 'select'],
    ['message', 'Your review', 'textarea'],
  ];
  for (const [name, title, type] of fields) {
    const label = safeText('label', title);
    const field = document.createElement(type);
    field.name = name;
    field.required = true;
    if (name === 'name') field.maxLength = 80;
    if (name === 'message') { field.maxLength = 1500; field.rows = 4; }
    if (name === 'rating') {
      field.append(safeText('option', 'Choose a rating'));
      field.options[0].value = '';
      for (let value = 5; value >= 1; value -= 1) {
        const option = safeText('option', `${value} / 5`);
        option.value = String(value);
        field.append(option);
      }
    }
    label.append(field);
    form.append(label);
  }
  const honeypot = document.createElement('input');
  honeypot.type = 'hidden';
  honeypot.name = 'website';
  form.append(honeypot);
  const submit = safeText('button', 'Submit for approval', 'button');
  submit.type = 'submit';
  form.append(submit);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity() || submit.disabled) return;
    submit.disabled = true;
    submitStatus.textContent = 'Sending review…';
    const values = Object.fromEntries(new FormData(form));
    values.rating = Number(values.rating);
    values.productId = productId;
    try {
      const result = await api('/reviews', { method: 'POST', body: JSON.stringify(values) });
      form.reset();
      submitStatus.textContent = result.message || 'Your review is awaiting approval.';
    } catch (error) {
      submitStatus.textContent = error.message || 'Your review could not be submitted.';
    } finally {
      submit.disabled = false;
    }
  });
  section.append(reviewStatus, list, form);

  api(`/reviews?productId=${encodeURIComponent(productId)}`)
    .then(({ reviews }) => {
      list.replaceChildren();
      if (!reviews.length) list.append(safeText('p', 'No approved reviews yet. Be the first to share your experience.'));
      for (const review of reviews) {
        const card = document.createElement('article');
        card.className = 'review-card';
        card.append(
          safeText('p', `${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}`, 'review-stars'),
          safeText('h3', review.name),
          safeText('p', review.message),
          safeText('small', new Date(review.createdAt).toLocaleDateString('en-NG')),
        );
        list.append(card);
      }
      reviewStatus.textContent = '';
    })
    .catch(error => { reviewStatus.textContent = `Reviews could not be loaded: ${error.message}`; });

  return section;
}

async function load() {
  const code = new URLSearchParams(window.location.search).get('code')?.trim();
  if (!code) {
    status.textContent = 'Choose a style from the collection to view its details.';
    missing.hidden = false;
    return;
  }
  try {
    const { product } = await api(`/products/${encodeURIComponent(code)}`);
    renderProduct(productFromRecord(product));
  } catch (error) {
    try {
      const liveCatalogueLoaded = await loadProductsCatalogue();
      const fallback = products.find(product => product.id.toLowerCase() === code.toLowerCase());
      if (fallback && (!liveCatalogueLoaded || fallback.backendAvailable)) {
        renderProduct({ ...fallback, backendAvailable: false });
        return;
      }
    } catch { /* Keep the product-unavailable state below. */ }
    status.textContent = error.message || 'This style could not be loaded.';
    missing.hidden = false;
  }
}

initAuth();
initCart().catch(() => {});
initWishlist().catch(() => {});
load();