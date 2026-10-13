/*
  Shopping cart for book purchases, backed by localStorage, with Paystack
  checkout. Injects its own floating button + drawer into every page that
  loads this script, so no page markup changes are needed.

  Requires:
    - window.PAYSTACK_PUBLIC_KEY set in assets/js/supabase-client.js (or
      anywhere loaded before this file)
    - the Paystack inline script: https://js.paystack.co/v1/inline.js
    - window.supabaseClient (from supabase-client.js) for order creation
*/
(function () {
  "use strict";

  var STORAGE_KEY = "evansGyakyeCart";
  var confirmationMessage = ""; // shown in the drawer after a successful payment

  function esc(v) {
    if (v == null) return "";
    return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function formatGHS(n) { return "GHS " + Number(n || 0).toFixed(2); }

  function readCart() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch (e) { return []; }
  }
  function writeCart(items) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch (e) { /* storage unavailable */ }
    renderDrawer();
    updateBadge();
  }

  function addItem(book, qty) {
    qty = qty || 1;
    confirmationMessage = "";
    var items = readCart();
    var existing = items.find(function (i) { return i.book_id === book.book_id; });
    if (existing) { existing.qty += qty; }
    else { items.push({ book_id: book.book_id, title: book.title, unit_price: Number(book.unit_price), qty: qty }); }
    writeCart(items);
    openDrawer();
  }
  function setQty(bookId, qty) {
    var items = readCart();
    var item = items.find(function (i) { return i.book_id === bookId; });
    if (!item) return;
    item.qty = Math.max(1, qty);
    writeCart(items);
  }
  function removeItem(bookId) {
    writeCart(readCart().filter(function (i) { return i.book_id !== bookId; }));
  }
  function clearCart() { writeCart([]); }
  function cartTotal(items) { return items.reduce(function (sum, i) { return sum + i.unit_price * i.qty; }, 0); }
  function cartCount(items) { return items.reduce(function (sum, i) { return sum + i.qty; }, 0); }

  // ---------------------------------------------------------------------
  // UI: floating button + drawer, built once and reused
  // ---------------------------------------------------------------------
  var root, badgeEl, drawerEl, backdropEl;

  function injectStyles() {
    var style = document.createElement("style");
    style.textContent =
      ".cart-fab{position:fixed;bottom:1.5rem;right:1.5rem;z-index:300;background:#111;color:#f5f1e8;border:none;border-radius:999px;padding:0.85rem 1.25rem;font:600 0.9rem Inter,sans-serif;cursor:pointer;box-shadow:0 8px 20px rgba(17,17,17,0.25);display:flex;align-items:center;gap:0.5rem;}" +
      ".cart-fab .badge{background:#b89b5e;color:#111;border-radius:999px;padding:0.1rem 0.5rem;font-size:0.78rem;font-weight:700;}" +
      ".cart-backdrop{position:fixed;inset:0;background:rgba(17,17,17,0.45);z-index:310;display:none;}" +
      ".cart-backdrop.is-open{display:block;}" +
      ".cart-drawer{position:fixed;top:0;right:0;bottom:0;width:min(100%,380px);background:#fff;z-index:320;transform:translateX(100%);transition:transform 0.25s ease;display:flex;flex-direction:column;font-family:Inter,sans-serif;}" +
      ".cart-drawer.is-open{transform:translateX(0);}" +
      ".cart-drawer-head{padding:1.25rem;border-bottom:1px solid rgba(17,17,17,0.1);display:flex;justify-content:space-between;align-items:center;}" +
      ".cart-drawer-head h2{font-family:'Playfair Display',Georgia,serif;font-size:1.2rem;margin:0;}" +
      ".cart-drawer-head button{background:none;border:none;font-size:1.4rem;cursor:pointer;line-height:1;}" +
      ".cart-items{flex:1;overflow-y:auto;padding:1rem 1.25rem;}" +
      ".cart-item{display:flex;justify-content:space-between;gap:0.75rem;padding:0.85rem 0;border-bottom:1px solid rgba(17,17,17,0.08);font-size:0.9rem;}" +
      ".cart-item .qty-controls{display:flex;align-items:center;gap:0.5rem;margin-top:0.35rem;}" +
      ".cart-item .qty-controls button{width:1.6rem;height:1.6rem;border-radius:6px;border:1px solid rgba(17,17,17,0.2);background:#fff;cursor:pointer;}" +
      ".cart-item .remove-link{background:none;border:none;color:#a63d3d;font-size:0.8rem;cursor:pointer;padding:0;margin-top:0.35rem;}" +
      ".cart-empty{color:#5a5a55;text-align:center;padding:2.5rem 1rem;font-size:0.92rem;}" +
      ".cart-drawer-foot{padding:1.25rem;border-top:1px solid rgba(17,17,17,0.1);}" +
      ".cart-total-row{display:flex;justify-content:space-between;font-weight:700;margin-bottom:1rem;}" +
      ".cart-drawer-foot .field{margin-bottom:0.75rem;}" +
      ".cart-drawer-foot label{display:block;font-size:0.8rem;font-weight:600;margin-bottom:0.3rem;}" +
      ".cart-drawer-foot input{width:100%;padding:0.6rem 0.75rem;border-radius:8px;border:1px solid rgba(17,17,17,0.2);font:inherit;}" +
      ".cart-checkout-btn{width:100%;padding:0.8rem;border-radius:999px;border:none;background:#111;color:#f5f1e8;font-weight:700;cursor:pointer;}" +
      ".cart-checkout-btn:disabled{opacity:0.5;cursor:not-allowed;}" +
      ".cart-status{font-size:0.85rem;margin-top:0.75rem;text-align:center;}";
    document.head.appendChild(style);
  }

  function buildUI() {
    injectStyles();

    root = document.createElement("button");
    root.className = "cart-fab";
    root.setAttribute("aria-label", "Open cart");
    root.innerHTML = "\uD83D\uDED2 Cart <span class=\"badge\" data-cart-count>0</span>";
    root.addEventListener("click", openDrawer);
    document.body.appendChild(root);

    backdropEl = document.createElement("div");
    backdropEl.className = "cart-backdrop";
    backdropEl.addEventListener("click", closeDrawer);
    document.body.appendChild(backdropEl);

    drawerEl = document.createElement("aside");
    drawerEl.className = "cart-drawer";
    drawerEl.setAttribute("aria-label", "Shopping cart");
    document.body.appendChild(drawerEl);

    badgeEl = root.querySelector("[data-cart-count]");
  }

  function openDrawer() { backdropEl.classList.add("is-open"); drawerEl.classList.add("is-open"); renderDrawer(); }
  function closeDrawer() { backdropEl.classList.remove("is-open"); drawerEl.classList.remove("is-open"); }

  function updateBadge() {
    if (!badgeEl) return;
    badgeEl.textContent = String(cartCount(readCart()));
  }

  function renderDrawer() {
    if (!drawerEl) return;
    var items = readCart();
    var itemsHtml = items.length
      ? items.map(function (i) {
          return (
            '<div class="cart-item"><div style="flex:1;">' +
            "<div>" + esc(i.title) + "</div>" +
            '<div style="color:#5a5a55;">' + formatGHS(i.unit_price) + " each</div>" +
            '<div class="qty-controls">' +
            '<button type="button" data-qty-down="' + esc(i.book_id) + '">\u2212</button>' +
            '<span>' + i.qty + "</span>" +
            '<button type="button" data-qty-up="' + esc(i.book_id) + '">+</button>' +
            "</div>" +
            '<button type="button" class="remove-link" data-remove="' + esc(i.book_id) + '">Remove</button>' +
            "</div><div>" + formatGHS(i.unit_price * i.qty) + "</div></div>"
          );
        }).join("")
      : '<p class="cart-empty">' + (confirmationMessage ? esc(confirmationMessage) : "Your cart is empty.") + "</p>";

    var total = cartTotal(items);

    drawerEl.innerHTML =
      '<div class="cart-drawer-head"><h2>Your Cart</h2><button type="button" data-cart-close aria-label="Close cart">&times;</button></div>' +
      '<div class="cart-items">' + itemsHtml + "</div>" +
      '<div class="cart-drawer-foot">' +
      '<div class="cart-total-row"><span>Total</span><span>' + formatGHS(total) + "</span></div>" +
      (items.length
        ? '<div class="field"><label for="checkout-name">Full name</label><input id="checkout-name" type="text" required></div>' +
          '<div class="field"><label for="checkout-email">Email address</label><input id="checkout-email" type="email" required></div>' +
          '<button type="button" class="cart-checkout-btn" data-checkout>Pay with MoMo or card</button>' +
          '<p class="cart-status" data-checkout-status></p>'
        : "") +
      "</div>";

    drawerEl.querySelector("[data-cart-close]").addEventListener("click", closeDrawer);
    drawerEl.querySelectorAll("[data-qty-up]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-qty-up");
        var item = readCart().find(function (i) { return i.book_id === id; });
        setQty(id, (item ? item.qty : 0) + 1);
      });
    });
    drawerEl.querySelectorAll("[data-qty-down]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-qty-down");
        var item = readCart().find(function (i) { return i.book_id === id; });
        if (item && item.qty <= 1) removeItem(id);
        else setQty(id, (item ? item.qty : 1) - 1);
      });
    });
    drawerEl.querySelectorAll("[data-remove]").forEach(function (btn) {
      btn.addEventListener("click", function () { removeItem(btn.getAttribute("data-remove")); });
    });
    var checkoutBtn = drawerEl.querySelector("[data-checkout]");
    if (checkoutBtn) checkoutBtn.addEventListener("click", startCheckout);
  }

  // ---------------------------------------------------------------------
  // Checkout: create a pending order in Supabase, open Paystack, then
  // ask the Edge Function to verify before trusting it as paid.
  // ---------------------------------------------------------------------
  async function startCheckout() {
    var statusEl = drawerEl.querySelector("[data-checkout-status]");
    var name = drawerEl.querySelector("#checkout-name").value.trim();
    var email = drawerEl.querySelector("#checkout-email").value.trim();
    var items = readCart();

    if (!name || !email) { statusEl.textContent = "Please enter your name and email."; return; }
    if (!items.length) { statusEl.textContent = "Your cart is empty."; return; }

    if (!window.supabaseClient) { statusEl.textContent = "Checkout isn't connected yet. Please try again later."; return; }
    if (!window.PAYSTACK_PUBLIC_KEY || window.PAYSTACK_PUBLIC_KEY.indexOf("YOUR-") === 0) {
      statusEl.textContent = "Payments aren't configured yet. Please check back soon.";
      return;
    }

    var total = cartTotal(items);
    var reference = "eg_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);

    statusEl.textContent = "Preparing your order\u2026";

    var { error: insertError } = await window.supabaseClient.from("orders").insert({
      customer_name: name,
      customer_email: email,
      items: items.map(function (i) { return { book_id: i.book_id, title: i.title, unit_price: i.unit_price, qty: i.qty }; }),
      total_amount: total,
      currency: "GHS",
      paystack_reference: reference,
      status: "pending",
    });

    if (insertError) { statusEl.textContent = "Could not start checkout: " + insertError.message; return; }

    if (!window.PaystackPop) { statusEl.textContent = "Payment system failed to load. Please refresh and try again."; return; }

    var handler = window.PaystackPop.setup({
      key: window.PAYSTACK_PUBLIC_KEY,
      email: email,
      amount: Math.round(total * 100), // Paystack expects the smallest currency unit (pesewas for GHS)
      currency: "GHS",
      channels: ["mobile_money", "card"], // MoMo (MTN, Telecel/Vodafone, AirtelTigo) and cards
      ref: reference,
      metadata: { custom_fields: [{ display_name: "Customer Name", variable_name: "customer_name", value: name }] },
      callback: function (response) {
        statusEl.textContent = "Confirming payment\u2026";
        window.supabaseClient.functions.invoke("verify-payment", { body: { reference: response.reference } })
          .then(function (result) {
            var data = result && result.data;
            if (data && data.ok) {
              confirmationMessage = "Payment confirmed \u2014 thank you! Your order has been recorded.";
              clearCart(); // re-renders the drawer, which shows the message above
            } else if (data && data.status === "pending") {
              statusEl.textContent = "Your payment is still being processed. If you paid with MoMo, approve the prompt on your phone. If it doesn't complete, contact us with reference " + response.reference + ".";
            } else {
              statusEl.textContent = "We received a response but couldn't confirm the payment. Please contact us with reference " + response.reference + ".";
            }
          })
          .catch(function () {
            statusEl.textContent = "Payment was submitted, but we couldn't confirm it automatically. Please contact us with reference " + response.reference + ".";
          });
      },
      onClose: function () {
        statusEl.textContent = "Checkout closed before completing payment.";
      },
    });
    handler.openIframe();
  }

  window.cartApi = { addItem: addItem, getItems: readCart, clear: clearCart };

  document.addEventListener("DOMContentLoaded", function () {
    buildUI();
    updateBadge();
  });
})();
