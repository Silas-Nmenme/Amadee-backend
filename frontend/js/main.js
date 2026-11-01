// App bootstrap: wires up every module once the DOM is ready.
import { initCart } from "./modules/cart.js";
import { initProducts } from "./modules/products.js";
import { initSearch } from "./modules/search.js";
import { initReviews } from "./modules/reviews.js";
import { initAuth } from "./modules/auth.js";
import { byId } from "./modules/utils.js";
import { initPublicForms } from "./modules/forms.js";

function init() {
  byId("year").textContent = String(new Date().getFullYear());

  initCart().catch(() => {});
  initProducts();
  initSearch();
  initReviews();
  initAuth();
  initMobileNav();
  initPublicForms();
}

function initMobileNav() {
  const menu = byId("menu-toggle");
  const nav = byId("primary-nav");

  menu.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    menu.setAttribute("aria-expanded", String(open));
    menu.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
  });

  nav.querySelectorAll("a").forEach((link) =>
    link.addEventListener("click", () => {
      nav.classList.remove("is-open");
      menu.setAttribute("aria-expanded", "false");
      menu.setAttribute("aria-label", "Open navigation");
    })
  );
}

document.addEventListener("DOMContentLoaded", init);

