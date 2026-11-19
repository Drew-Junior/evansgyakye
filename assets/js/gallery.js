/*
  Gallery (homepage section #gallery and the full page gallery.html).
  - Loads published items from Dashboard -> Gallery (table gallery_items).
  - Animated mosaic with Pictures / Videos / Files tabs (full page), album filters,
    "Show more", and the shared full-screen viewer (media-viewer.js).
  - The homepage section stays hidden if there is nothing to show.
  Needs media-viewer.js loaded first.
*/
(function () {
  "use strict";

  var section = document.getElementById("gallery");
  if (!section || !window.MediaViewer) return;
  var MV = window.MediaViewer, el = MV.el;
  var grid = document.getElementById("gallery-grid");
  var albumsEl = document.getElementById("gallery-filters");
  var typesEl = document.getElementById("gallery-types");        // only on gallery.html
  var moreBtn = document.getElementById("gallery-more");
  var emptyEl = document.getElementById("gallery-empty");         // only on gallery.html
  var fullPage = section.getAttribute("data-page") === "full";
  var PAGE = fullPage ? 12 : 9;
  var LIMIT = fullPage ? 200 : 60;

  var items = [], cards = [];
  var album = "", kind = "", shown = PAGE;
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function makeCard(it, i) {
    var li = el("li", "gal-item");
    var btn = el("button", "gal-card gal-shape-" + (i % 6));
    btn.type = "button";
    btn.setAttribute("aria-label", "Open " + it.title + (it.kind === "image" ? "" : " (" + MV.badgeText(it) + ")"));
    btn.addEventListener("click", function () {
      var list = filtered();
      MV.open(list, list.indexOf(it), btn);
    });

    var media = el("span", "gal-media");
    var src = it.kind === "image" ? it.file : it.thumb;
    var fallbackGlyph = it.kind === "video" ? "\u25B6" : it.kind === "file" ? "\uD83D\uDCC4" : "\u25A3";
    if (src) {
      var img = el("img");
      img.alt = "";
      img.loading = "lazy"; img.decoding = "async";
      img.addEventListener("load", function () { media.classList.add("is-ready"); });
      img.addEventListener("error", function () {
        img.remove(); media.classList.add("is-ready");
        media.appendChild(el("span", "gal-placeholder", fallbackGlyph));
      });
      img.src = src;
      media.appendChild(img);
    } else {
      media.classList.add("is-ready");
      media.appendChild(el("span", "gal-placeholder", fallbackGlyph));
    }
    btn.appendChild(media);
    if (MV.badgeText(it)) btn.appendChild(el("span", "gal-badge", MV.badgeText(it)));
    if (it.kind === "video") { var p = el("span", "gal-play"); p.appendChild(el("span", null, "\u25B6")); btn.appendChild(p); }

    var cap = el("span", "gal-cap");
    cap.appendChild(el("strong", null, it.title));
    if (it.caption) cap.appendChild(el("span", null, it.caption.length > 90 ? it.caption.slice(0, 87) + "\u2026" : it.caption));
    btn.appendChild(cap);
    li.appendChild(btn);
    return li;
  }

  var observer = null;
  function reveal(li, delay) {
    if (reduceMotion || !("IntersectionObserver" in window)) { li.classList.add("is-in"); return; }
    li.style.transitionDelay = delay + "ms";
    if (!observer) {
      observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("is-in"); observer.unobserve(e.target); } });
      }, { threshold: 0.12 });
    }
    observer.observe(li);
  }

  function filtered() {
    return items.filter(function (it) {
      return (!album || it.album === album) && (!kind || it.kind === kind);
    });
  }

  function apply() {
    var list = filtered();
    var visibleCount = 0;
    items.forEach(function (it, i) {
      var li = cards[i];
      var idx = list.indexOf(it);
      var show = idx > -1 && idx < shown;
      if (show) {
        var wasHidden = li.hidden;
        li.hidden = false;
        if (wasHidden) { li.classList.remove("is-in"); reveal(li, (visibleCount % 6) * 80); }
        visibleCount += 1;
      } else {
        li.hidden = true; li.classList.remove("is-in");
      }
    });
    moreBtn.hidden = list.length <= shown;
    if (emptyEl) emptyEl.hidden = list.length > 0;
  }

  function chips(container, names, current, onPick) {
    if (!container) return;
    container.textContent = "";
    names.forEach(function (n) {
      var b = el("button", "gal-chip", n.label);
      b.type = "button";
      b.setAttribute("aria-pressed", String(n.value === current));
      b.addEventListener("click", function () {
        onPick(n.value);
        Array.prototype.forEach.call(container.children, function (c) { c.setAttribute("aria-pressed", String(c === b)); });
        shown = PAGE; apply();
      });
      container.appendChild(b);
    });
    container.hidden = false;
  }

  function buildFilters() {
    if (typesEl) {                                    // Pictures / Videos / Files tabs
      var labels = { image: "Pictures", video: "Videos", file: "Files" };
      var present = ["image", "video", "file"].filter(function (k) { return items.some(function (it) { return it.kind === k; }); });
      if (present.length > 1) {
        chips(typesEl, [{ label: "All", value: "" }].concat(present.map(function (k) { return { label: labels[k], value: k }; })), kind, function (v) { kind = v; });
      }
    }
    var albums = [];
    items.forEach(function (it) { if (it.album && albums.indexOf(it.album) === -1) albums.push(it.album); });
    if (albums.length > 1) {
      albums.sort(function (a, b) { return a.localeCompare(b); });
      chips(albumsEl, [{ label: "All albums", value: "" }].concat(albums.map(function (a) { return { label: a, value: a }; })), album, function (v) { album = v; });
    }
  }

  async function init() {
    if (!window.supabaseClient) { fail(); return; }
    var res = await window.supabaseClient
      .from("gallery_items")
      .select("title, caption, kind, file_url, thumb_url, album, sort_order, created_at")
      .eq("published", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(LIMIT);
    if (res.error || !Array.isArray(res.data)) { fail(); return; }
    items = res.data.map(MV.normalise).filter(Boolean);
    if (!items.length) { fail(); return; }

    cards = items.map(makeCard);
    cards.forEach(function (li) { li.hidden = true; grid.appendChild(li); });
    buildFilters();
    moreBtn.addEventListener("click", function () { shown += PAGE; apply(); });
    section.hidden = false;
    var loading = document.getElementById("gallery-loading");
    if (loading) loading.hidden = true;
    apply();
  }

  function fail() {
    var loading = document.getElementById("gallery-loading");
    if (fullPage) {                                   // gallery.html: say so instead of showing nothing
      section.hidden = false;
      if (loading) loading.textContent = "No pictures or videos have been published yet. Please check back soon.";
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
