// Live product search: filters the grid in place as the customer types,
// with a debounce, a clear button and no scrolling or category hijacking.
import { byId } from "./utils.js";
import { setSearchQuery, clearSearchQuery } from "./products.js";

const DEBOUNCE_MS = 180;

export function initSearch() {
  const input = byId("search-input");
  const clearButton = byId("search-clear");
  let debounceTimer;

  const updateClearVisibility = () => {
    clearButton.classList.toggle("hidden", input.value.length === 0);
  };

  input.addEventListener("input", () => {
    updateClearVisibility();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => setSearchQuery(input.value), DEBOUNCE_MS);
  });

  clearButton.addEventListener("click", () => {
    input.value = "";
    updateClearVisibility();
    clearSearchQuery();
    input.focus();
  });
}

