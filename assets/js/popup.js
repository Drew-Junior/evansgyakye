/*
  Optional newsletter pop-up ("A Letter From My Thinking Room").
  - After a short delay a small card appears in the bottom-left corner.
  - The full sign-up box opens ONLY when the visitor clicks the card.
  - Visitors can close it any time (X, Esc, click outside, "Maybe later").
  - It stays away for N days after being closed, and never returns once they subscribe.
  - Wording, delay and on/off are controlled from Dashboard -> Newsletter Pop-up.
  - Add ?popup=preview to any page address to preview it (ignores the "closed" memory).
*/
(function () {
  "use strict";

  var KEY_DISMISS = "eg_nl_popup_dismissed_until";
  var KEY_DONE = "eg_nl_popup_subscribed";
  var SETTING_KEYS = [
    "public_popup_enabled", "public_popup_delay", "public_popup_days",
    "public_popup_label", "public_popup_title", "public_popup_text", "public_popup_button"
  ];
  var DEFAULTS = {
    label: "A Letter From My Thinking Room",
    title: "Keep thinking with me",
    text: "Every so often, I send an idea worth thinking about \u2014 reflections, writing, books, opportunities, and updates on the things I am building.",
    button: "Join the Conversation"
  };
  var preview = /[?&]popup=preview(&|$)/.test(window.location.search);

  function read(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function write(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* private mode: fine */ } }
  function num(v, min, max, fallback) {
    var n = parseInt(v, 10);
    if (isNaN(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }
  function text(v, fallback, max) {
    var s = (v == null ? "" : String(v)).trim();
    return s ? s.slice(0, max) : fallback;
  }
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  var cfg, teaser, backdrop, modal, lastFocus, daysAway;

  function snooze() {
    if (preview) return;
    write(KEY_DISMISS, String(Date.now() + daysAway * 86400000));
  }

  function removeTeaser() {
    if (teaser && teaser.parentNode) teaser.parentNode.removeChild(teaser);
    teaser = null;
  }

  function closeModal() {
    if (!backdrop) return;
    document.removeEventListener("keydown", onKey, true);
    backdrop.parentNode.removeChild(backdrop);
    backdrop = modal = null;
    document.documentElement.classList.remove("nl-open");
    snooze();
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) { /* element gone */ } }
  }

  function onKey(e) {
    if (!modal) return;
    if (e.key === "Escape") { e.preventDefault(); closeModal(); return; }
    if (e.key !== "Tab") return;
    var f = modal.querySelectorAll("button, input:not([tabindex='-1']), a[href]");
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function openModal() {
    if (backdrop) return;
    lastFocus = document.activeElement;
    removeTeaser();

    backdrop = el("div", "nl-backdrop");
    modal = el("div", "nl-modal");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "nl-title");
    modal.setAttribute("aria-describedby", "nl-text");

    var close = el("button", "nl-close", "\u00d7");
    close.type = "button";
    close.setAttribute("aria-label", "Close");
    close.addEventListener("click", closeModal);

    var label = el("span", "section-label", cfg.label);
    var title = el("h2", null, cfg.title); title.id = "nl-title";
    var para = el("p", null, cfg.text); para.id = "nl-text";

    var form = el("form", "nl-form");
    form.noValidate = false;

    var nameIn = el("input"); nameIn.type = "text"; nameIn.name = "name"; nameIn.maxLength = 80;
    nameIn.placeholder = "Your first name (optional)"; nameIn.autocomplete = "given-name";
    nameIn.setAttribute("aria-label", "Your first name (optional)");

    var emailIn = el("input"); emailIn.type = "email"; emailIn.name = "email"; emailIn.required = true; emailIn.maxLength = 254;
    emailIn.placeholder = "Your email address"; emailIn.autocomplete = "email";
    emailIn.setAttribute("aria-label", "Your email address");

    // Honeypot: real visitors never see or fill this; simple bots often do.
    var trap = el("input", "nl-trap"); trap.type = "text"; trap.name = "website";
    trap.tabIndex = -1; trap.autocomplete = "off"; trap.setAttribute("aria-hidden", "true");

    var submit = el("button", "btn btn-primary", cfg.button); submit.type = "submit";
    var status = el("p", "nl-status"); status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite");
    var later = el("button", "nl-later", "Maybe later"); later.type = "button";
    later.addEventListener("click", closeModal);

    form.appendChild(nameIn); form.appendChild(emailIn); form.appendChild(trap);
    form.appendChild(submit); form.appendChild(status);

    var busy = false;
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (busy) return;
      var email = emailIn.value.trim().toLowerCase();
      if (!emailIn.checkValidity() || !email) { status.textContent = "Please enter a valid email address."; emailIn.focus(); return; }
      busy = true; submit.disabled = true; status.textContent = "One moment\u2026";

      function thanks() {
        write(KEY_DONE, "1");
        form.innerHTML = "";
        var ok = el("p", "nl-thanks", "Thank you \u2014 you\u2019re on the list.");
        form.appendChild(ok);
        later.textContent = "Close";
        setTimeout(function () { if (backdrop) closeModal(); }, 3500);
      }
      if (trap.value) { thanks(); return; }  // bot: pretend success, store nothing

      window.siteData.subscribeToNewsletter(nameIn.value.trim().slice(0, 80), email).then(function (res) {
        if (res.ok || /duplicate|unique|23505/i.test(String(res.reason || ""))) { thanks(); return; }
        busy = false; submit.disabled = false;
        status.textContent = "Something went wrong \u2014 please try again shortly.";
      });
    });

    modal.appendChild(close); modal.appendChild(label); modal.appendChild(title);
    modal.appendChild(para); modal.appendChild(form); modal.appendChild(later);
    backdrop.appendChild(modal);
    backdrop.addEventListener("mousedown", function (ev) { if (ev.target === backdrop) closeModal(); });
    document.body.appendChild(backdrop);
    document.documentElement.classList.add("nl-open");
    document.addEventListener("keydown", onKey, true);
    emailIn.focus();
  }

  function showTeaser() {
    teaser = el("div", "nl-teaser");
    teaser.setAttribute("role", "region");
    teaser.setAttribute("aria-label", "Newsletter invitation");

    var open = el("button", "nl-teaser-open"); open.type = "button";
    var icon = el("span", "nl-teaser-icon", "\u2709"); icon.setAttribute("aria-hidden", "true");
    var words = el("span", "nl-teaser-text");
    words.appendChild(el("strong", null, cfg.label));
    words.appendChild(el("span", null, cfg.title));
    open.appendChild(icon); open.appendChild(words);
    open.addEventListener("click", openModal);

    var x = el("button", "nl-teaser-close", "\u00d7"); x.type = "button";
    x.setAttribute("aria-label", "Dismiss newsletter invitation");
    x.addEventListener("click", function () { snooze(); removeTeaser(); });

    teaser.appendChild(open); teaser.appendChild(x);
    document.body.appendChild(teaser);
  }

  async function init() {
    if (!window.siteData || !window.supabaseClient) return;      // sign-up can't work without Supabase
    if (!preview) {
      if (read(KEY_DONE)) return;
      if (Number(read(KEY_DISMISS) || 0) > Date.now()) return;
    }
    var s = await window.siteData.fetchSettings(SETTING_KEYS);
    if (!preview && s.public_popup_enabled === "off") return;     // switched off in the dashboard

    cfg = {
      label: text(s.public_popup_label, DEFAULTS.label, 60),
      title: text(s.public_popup_title, DEFAULTS.title, 80),
      text: text(s.public_popup_text, DEFAULTS.text, 400),
      button: text(s.public_popup_button, DEFAULTS.button, 30)
    };
    daysAway = num(s.public_popup_days, 1, 365, 7);
    var delay = preview ? 1 : num(s.public_popup_delay, 3, 120, 8);
    setTimeout(showTeaser, delay * 1000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
