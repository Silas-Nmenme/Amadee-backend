// Product grid rendering: category filter, sort, live text search,
// wishlist toggle and the size/colour quick-add picker.
import { products } from "../data/products.js";
import { byId, formatNaira, safeText } from "./utils.js";
import { addToCart } from "./cart.js";
import { openModal, closeModal } from "./modal.js";
import { toast } from "./toast.js";

import { getWishlist, initWishlist, toggleWishlist } from "./wishlist.js";

let visibleLimit = 8;
let searchQuery = "";

// Called by search.js whenever the search box changes. Keeping the query
// here (rather than scrolling or touching the category dropdown) means
// search and the category/sort filters combine instead of fighting.
export function setSearchQuery(query) {
  searchQuery = query.trim().toLowerCase();
  visibleLimit = 8;
  renderProducts();
}

export function clearSearchQuery() {
  setSearchQuery("");
}

function matchesSearch(product) {
  if (!searchQuery) return true;
  return (
    product.name.toLowerCase().includes(searchQuery) ||
    product.description.toLowerCase().includes(searchQuery) ||
    product.category.toLowerCase().includes(searchQuery)
  );
}

export function renderProducts() {
  const grid = byId("product-grid");
  const resultCount = byId("product-result-count");
  const category = byId("category-filter").value;
  const sort = byId("sort-filter").value;

  let list = products.filter(
    (p) => (category === "all" || p.category === category) && p.inStock && matchesSearch(p)
  );
  if (sort === "price-asc") list.sort((a, b) => a.price - b.price);
  if (sort === "price-desc") list.sort((a, b) => b.price - a.price);
  if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name));

  const shown = list.slice(0, visibleLimit);
  grid.replaceChildren();

  if (!shown.length) {
    const message = searchQuery
      ? `No products match “${searchQuery}”. Try a different word or clear the search.`
      : "No products match those filters.";
    grid.append(safeText("p", message, "empty-state"));
  } else {
    shown.forEach((p) => grid.append(makeCard(p)));
  }

  resultCount.textContent = searchQuery
    ? `${list.length} result${list.length === 1 ? "" : "s"} for “${searchQuery}”`
    : "";

  const loadMore = byId("load-more");
  loadMore.classList.toggle("hidden", shown.length >= list.length);
  loadMore.textContent = `View more (${list.length - shown.length} remaining)`;
}

export function makeCard(p) {
  const card = document.createElement("article");
  card.className = "product-card";

  const img = document.createElement("img");
  img.src = p.images[0];
  img.alt = p.name;
  img.width = 800;
  img.height = 1000; // 4:5, matches the CSS aspect-ratio
  img.loading = "lazy";
  img.onerror = () => { img.onerror = null; img.src = "/public/assets/images/products/garment-placeholder.svg"; };

  const content = document.createElement("div");
  content.className = "product-card-content";
  content.append(
    safeText("h3", p.name),
    safeText("p", categoryName(p.category), "eyebrow"),
    safeText("p", formatNaira(p.price), "price"),
    safeText("p", p.description)
  );

  const actions = document.createElement("div");
  actions.className = "card-actions";

  const details = safeText("button", "Details", "button button-outline");
  details.type = "button";
  details.onclick = () => openProduct(p);

  const add = safeText("button", "Add to cart", "button");
  add.type = "button";
  add.onclick = () => openQuickAdd(p);

  const heart = safeText("button", getWishlist().includes(p.id) ? "♥" : "♡", "heart-button");
  heart.type = "button";
  heart.setAttribute("aria-pressed", String(getWishlist().includes(p.id)));
  heart.setAttribute("aria-label", `Save ${p.name} to wishlist`);
  const updateHeart = () => {
    const saved = getWishlist().includes(p.id);
    heart.textContent = saved ? "♥" : "♡";
    heart.setAttribute("aria-pressed", String(saved));
    heart.setAttribute("aria-label", `${saved ? "Remove" : "Save"} ${p.name} ${saved ? "from" : "to"} wishlist`);
  };
  updateHeart();
  heart.onclick = async () => {
    heart.disabled = true;
    try {
      const saved = await toggleWishlist(p.id);
      updateHeart();
      toast(saved ? "Saved to wishlist." : "Removed from wishlist.");
    } catch (error) { toast(error.message, "error"); }
    finally { heart.disabled = false; }
  };

  actions.append(details, add, heart);
  content.append(actions);
  card.append(img, content);
  return card;
}

function categoryName(c) {
  return (
    { children: "Children Wears", office: "Office Wears", ankara: "Ankara", casual: "Casual Wears" }[c] || c
  );
}

// Shared size/colour/quantity picker used by both the detail modal and
// the card's "Add to cart" quick-add sheet. Size and colour are required
// before anything reaches the cart, matching what the server expects.
function buildOptionPicker(p) {
  const sizeLabel = safeText("label", "Size");
  const size = document.createElement("select");
  size.required = true;
  p.sizes.forEach((v) => {
    const option = document.createElement("option");
    option.value = v;
    option.textContent = v;
    size.append(option);
  });
  sizeLabel.append(size);

  const colourLabel = safeText("label", "Colour");
  const colour = document.createElement("select");
  colour.required = true;
  p.colours.forEach((v) => {
    const option = document.createElement("option");
    option.value = v;
    option.textContent = v;
    colour.append(option);
  });
  colourLabel.append(colour);

  const qtyLabel = safeText("label", "Quantity");
  const qty = document.createElement("input");
  qty.type = "number";
  qty.min = "1";
  qty.max = "20";
  qty.value = "1";
  qtyLabel.append(qty);

  return { sizeLabel, colourLabel, qtyLabel, size, colour, qty };
}

function readQuantity(qty) {
  const n = Number(qty.value);
  if (!Number.isInteger(n) || n < 1 || n > 20) {
    toast("Quantity must be between 1 and 20.", "error");
    return null;
  }
  return n;
}

function openProduct(p) {
  openModal(p.name, (modal) => {
    const grid = document.createElement("div");
    grid.className = "modal-grid";

    const img = document.createElement("img");
    img.src = p.images[0];
    img.alt = p.name;
    img.className = "detail-image";
    img.width = 800;
    img.height = 1000; // 4:5
    img.loading = "lazy";

    const info = document.createElement("div");
    info.append(safeText("p", formatNaira(p.price), "price"), safeText("p", p.description));

    const { sizeLabel, colourLabel, qtyLabel, size, colour, qty } = buildOptionPicker(p);
    const customNote = safeText(
      "p",
      "Need a custom fit? Choose “Custom” size and add measurements during checkout."
    );
    const guide = safeText("a", "How to measure →");
    guide.href = "/size-guide.html";
    info.append(sizeLabel, colourLabel, qtyLabel, customNote, guide);

    grid.append(img, info);
    modal.append(grid);

    const actions = document.createElement("div");
    actions.className = "modal-actions";
    const add = safeText("button", "Add to cart", "button");
    add.type = "button";
    add.onclick = () => {
      const n = readQuantity(qty);
      if (n === null) return;
      addToCart(p.id, n, { size: size.value, colour: colour.value });
      closeModal();
    };
    actions.append(add);
    modal.append(actions);
  });
}

// Quick-add sheet opened from the card's "Add to cart" button, so a size
// and colour are always chosen without leaving the grid context.
function openQuickAdd(p) {
  openModal(`Add ${p.name} to cart`, (modal) => {
    modal.append(safeText("p", formatNaira(p.price), "price"));
    const { sizeLabel, colourLabel, qtyLabel, size, colour, qty } = buildOptionPicker(p);
    modal.append(sizeLabel, colourLabel, qtyLabel);

    const actions = document.createElement("div");
    actions.className = "modal-actions";
    const add = safeText("button", "Add to cart", "button");
    add.type = "button";
    add.onclick = () => {
      const n = readQuantity(qty);
      if (n === null) return;
      addToCart(p.id, n, { size: size.value, colour: colour.value });
      closeModal();
    };
    actions.append(add);
    modal.append(actions);
  });
}

export function initProducts() {
  initWishlist().then(renderProducts).catch(() => {});
  byId("category-filter").addEventListener("change", () => {
    visibleLimit = 8;
    renderProducts();
  });
  byId("sort-filter").addEventListener("change", renderProducts);
  byId("load-more").addEventListener("click", () => {
    visibleLimit += 8;
    renderProducts();
  });
  renderProducts();
}

