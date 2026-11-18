/*
  Homepage Gallery (#gallery on index.html).
  - Loads published items from Dashboard -> Gallery (table gallery_items).
  - Animated mosaic with album filters, "Show more", and a full-screen viewer:
    pictures, videos (uploaded mp4/webm, YouTube, Vimeo) and files (PDF etc.).
  - The whole section stays hidden if there is nothing to show.
  Safety: every link must be https:// or a path on this site; text is inserted as plain
  text; only YouTube and Vimeo may be embedded.
*/
(function () {
  "use strict";

  var section = document.getElementById("gallery");
  if (!section) return;
  var grid = document.getElementById("gallery-grid");
  var filtersEl = document.getElementById("gallery-filters");
  var moreBtn = document.getElementById("gallery-more");
  var PAGE = 9;

  var items = [];       // every valid item, in display order
  var album = "";       // "" = all
  var shown = PAGE;     // how many (of the filtered ones) are visible
  var cards = [];       // <li> elements, same order as items
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- helpers ----------
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function safeUrl(u) {
    return typeof u === "string" && u.length <= 2048 && (/^https:\/\//i.test(u) || /^\/(?!\/)/.test(u)) ? u : "";
  }
  function ext(u) {
    var m = /\.([a-z0-9]{2,5})(?:[?#]|$)/i.exec(String(u).split("?")[0] + (String(u).indexOf("?") > -1 ? "?" : ""));
    return m ? m[1].toUpperCase() : "";
  }
  function supabaseHost() {
    try { return new URL(window.SUPABASE_URL).host; } catch (e) { return ""; }
  }

  // Only YouTube and Vimeo may be embedded.
  function embedFor(url) {
    try {
      var u = new URL(url, window.location.origin);
      var host = u.hostname.replace(/^www\./, "").replace(/^m\./, "");
      if (host === "youtu.be") {
        var id = u.pathname.slice(1).split("/")[0];
        if (/^[A-Za-z0-9_-]{11}$/.test(id)) return "https://www.youtube-nocookie.com/embed/" + id + "?rel=0";
      }
      if (host === "youtube.com") {
        var v = u.searchParams.get("v") || (/^\/(?:embed|shorts)\/([A-Za-z0-9_-]{11})/.exec(u.pathname) || [])[1];
        if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return "https://www.youtube-nocookie.com/embed/" + v + "?rel=0";
      }
      if (host === "vimeo.com") {
        var vm = /^\/(\d{5,12})/.exec(u.pathname);
        if (vm) return "https://player.vimeo.com/video/" + vm[1];
      }
    } catch (e) { /* not a valid URL */ }
    return "";
  }
  function isDirectVideo(url) { return /\.(mp4|webm)(?:[?#]|$)/i.test(url); }

  function normalise(row) {
    var file = safeUrl(row.file_url);
    if (!file || !row.title) return null;
    var kind = row.kind === "video" || row.kind === "file" ? row.kind : "image";
    var embed = kind === "video" ? embedFor(file) : "";
    if (kind === "video" && !embed && !isDirectVideo(file)) kind = "file";   // unknown video link: treat as a link
    return {
      title: String(row.title).slice(0, 120),
      caption: row.caption ? String(row.caption).slice(0, 400) : "",
      kind: kind, file: file, embed: embed, thumb: safeUrl(row.thumb_url),
      album: row.album ? String(row.album).slice(0, 60) : ""
    };
  }

  // ---------- cards ----------
  function badgeText(it) {
    if (it.kind === "video") return "Video";
    if (it.kind === "file") return ext(it.file) || "File";
    return "";
  }
  function makeCard(it, i) {
    var li = el("li", "gal-item");
    var btn = el("button", "gal-card gal-shape-" + (i % 6));
    btn.type = "button";
    btn.setAttribute("aria-label", "Open " + it.title + (it.kind === "image" ? "" : " (" + badgeText(it) + ")"));
    btn.addEventListener("click", function () { openViewer(items.indexOf(it), btn); });

    var media = el("span", "gal-media");
    var src = it.kind === "image" ? it.file : it.thumb;
    if (src) {
      var img = el("img");
      img.alt = "";                       // the button already carries the label
      img.loading = "lazy"; img.decoding = "async";
      img.addEventListener("load", function () { media.classList.add("is-ready"); });
      img.addEventListener("error", function () {
        img.remove(); media.classList.add("is-ready");
        media.appendChild(el("span", "gal-placeholder", it.kind === "video" ? "\u25B6" : "\u25A3"));
      });
      img.src = src;
      media.appendChild(img);
    } else {
      media.classList.add("is-ready");
      media.appendChild(el("span", "gal-placeholder", it.kind === "video" ? "\u25B6" : it.kind === "file" ? "\uD83D\uDCC4" : "\u25A3"));
    }
    btn.appendChild(media);
    if (badgeText(it)) btn.appendChild(el("span", "gal-badge", badgeText(it)));
    if (it.kind === "video") { var p = el("span", "gal-play"); p.appendChild(el("span", null, "\u25B6")); btn.appendChild(p); }

    var cap = el("span", "gal-cap");
    cap.appendChild(el("strong", null, it.title));
    if (it.caption) cap.appendChild(el("span", null, it.caption.length > 90 ? it.caption.slice(0, 87) + "\u2026" : it.caption));
    btn.appendChild(cap);

    li.appendChild(btn);
    return li;
  }

  // ---------- filtering / paging / reveal ----------
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
  function filtered() { return items.filter(function (it) { return !album || it.album === album; }); }

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
  }

  function buildFilters() {
    var albums = [];
    items.forEach(function (it) { if (it.album && albums.indexOf(it.album) === -1) albums.push(it.album); });
    if (albums.length < 2) return;       // one album is the same as "all"
    albums.sort(function (a, b) { return a.localeCompare(b); });
    ["All"].concat(albums).forEach(function (name) {
      var b = el("button", "gal-chip", name);
      b.type = "button";
      var value = name === "All" ? "" : name;
      b.setAttribute("aria-pressed", String(value === album));
      b.addEventListener("click", function () {
        album = value; shown = PAGE;
        Array.prototype.forEach.call(filtersEl.children, function (c) { c.setAttribute("aria-pressed", String(c === b)); });
        apply();
      });
      filtersEl.appendChild(b);
    });
    filtersEl.hidden = false;
  }

  // ---------- full-screen viewer ----------
  var lb = null, stage, capTitle, capText, capCount, prevBtn, nextBtn, current = 0, returnFocus = null;

  function buildViewer() {
    lb = el("div", "gal-lb");
    lb.setAttribute("role", "dialog"); lb.setAttribute("aria-modal", "true"); lb.setAttribute("aria-label", "Gallery viewer");
    var backdrop = el("div", "gal-lb-backdrop");
    backdrop.addEventListener("click", closeViewer);
    var close = el("button", "gal-lb-btn gal-lb-close", "\u00D7"); close.type = "button"; close.setAttribute("aria-label", "Close viewer");
    close.addEventListener("click", closeViewer);
    prevBtn = el("button", "gal-lb-btn gal-lb-prev", "\u2039"); prevBtn.type = "button"; prevBtn.setAttribute("aria-label", "Previous");
    nextBtn = el("button", "gal-lb-btn gal-lb-next", "\u203A"); nextBtn.type = "button"; nextBtn.setAttribute("aria-label", "Next");
    prevBtn.addEventListener("click", function () { go(-1); });
    nextBtn.addEventListener("click", function () { go(1); });

    var figure = el("figure", "gal-lb-figure");
    stage = el("div", "gal-lb-stage");
    var cap = el("figcaption");
    capTitle = el("strong"); capText = el("span"); capCount = el("em", "gal-lb-count");
    cap.appendChild(capTitle); cap.appendChild(capText); cap.appendChild(capCount);
    figure.appendChild(stage); figure.appendChild(cap);

    lb.appendChild(backdrop); lb.appendChild(figure); lb.appendChild(close); lb.appendChild(prevBtn); lb.appendChild(nextBtn);

    var x0 = null, y0 = null;                       // swipe left/right on touch screens
    lb.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    lb.addEventListener("touchend", function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 50 && Math.abs(dy) < 70) go(dx < 0 ? 1 : -1);
    }, { passive: true });
  }

  function onKey(e) {
    if (!lb) return;
    if (e.key === "Escape") { e.preventDefault(); closeViewer(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    else if (e.key === "Tab") {
      var f = lb.querySelectorAll("button:not([hidden]), a[href]");
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  function downloadHref(url) {
    try {
      var u = new URL(url, window.location.origin);
      if (u.host === supabaseHost()) { u.searchParams.set("download", (u.pathname.split("/").pop() || "file")); return u.toString(); }
    } catch (e) { /* fall through */ }
    return url;
  }

  function fillStage(it, direction) {
    stage.textContent = "";                         // removing a <video> or <iframe> also stops it
    stage.className = "gal-lb-stage" + (direction ? " slide-" + direction : "");
    var node;
    if (it.kind === "image") {
      node = el("img"); node.alt = it.title; node.decoding = "async"; node.src = it.file;
    } else if (it.kind === "video" && it.embed) {
      node = el("iframe");
      node.src = it.embed; node.title = it.title; node.loading = "lazy";
      node.allow = "accelerometer; encrypted-media; picture-in-picture; fullscreen";
      node.setAttribute("allowfullscreen", "");
      node.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
      node.setAttribute("sandbox", "allow-scripts allow-same-origin allow-presentation allow-popups");
    } else if (it.kind === "video") {
      node = el("video"); node.controls = true; node.setAttribute("playsinline", ""); node.preload = "metadata";
      if (it.thumb) node.poster = it.thumb;
      node.src = it.file;
    } else {
      node = el("div", "gal-lb-file");
      if (it.thumb) { var art = el("img", "gal-file-art"); art.alt = ""; art.src = it.thumb; node.appendChild(art); }
      else node.appendChild(el("div", "gal-file-icon", "\uD83D\uDCC4"));
      node.appendChild(el("h3", null, it.title));
      node.appendChild(el("p", null, (ext(it.file) || "File") + (it.caption ? " \u00B7 " + it.caption : "")));
      var group = el("div", "btn-group");
      var open = el("a", "btn btn-primary", "Open"); open.href = it.file; open.target = "_blank"; open.rel = "noopener noreferrer";
      var dl = el("a", "btn btn-outline", "Download"); dl.href = downloadHref(it.file); dl.rel = "noopener noreferrer";
      group.appendChild(open); group.appendChild(dl); node.appendChild(group);
    }
    stage.appendChild(node);
  }

  function show(index, direction) {
    var it = items[index];
    current = index;
    fillStage(it, direction);
    capTitle.textContent = it.title;
    capText.textContent = it.kind === "file" ? "" : it.caption;   // files show their caption inside the card
    var list = filtered();
    var pos = list.indexOf(it) + 1;
    capCount.textContent = list.length > 1 ? pos + " / " + list.length : "";
    var many = list.length > 1;
    prevBtn.hidden = !many; nextBtn.hidden = !many;
    if (many) {                                     // warm up the next picture
      var nxt = list[pos % list.length];
      if (nxt && nxt.kind === "image") { var pre = new Image(); pre.src = nxt.file; }
    }
  }

  function go(step) {
    var list = filtered();
    if (list.length < 2) return;
    var pos = list.indexOf(items[current]);
    show(items.indexOf(list[(pos + step + list.length) % list.length]), step > 0 ? "next" : "prev");
  }

  function openViewer(index, fromEl) {
    if (!lb) buildViewer();
    returnFocus = fromEl || document.activeElement;
    document.body.appendChild(lb);
    document.documentElement.classList.add("gal-open");
    document.addEventListener("keydown", onKey, true);
    show(index, "");
    lb.querySelector(".gal-lb-close").focus();
  }

  function closeViewer() {
    if (!lb || !lb.parentNode) return;
    stage.textContent = "";
    lb.parentNode.removeChild(lb);
    document.documentElement.classList.remove("gal-open");
    document.removeEventListener("keydown", onKey, true);
    if (returnFocus && returnFocus.focus) { try { returnFocus.focus(); } catch (e) { /* element gone */ } }
  }

  // ---------- start ----------
  async function init() {
    if (!window.supabaseClient) return;
    var res = await window.supabaseClient
      .from("gallery_items")
      .select("title, caption, kind, file_url, thumb_url, album, sort_order, created_at")
      .eq("published", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(60);
    if (res.error || !Array.isArray(res.data)) return;         // table missing or blocked: stay hidden
    items = res.data.map(normalise).filter(Boolean);
    if (!items.length) return;                                  // nothing to show: stay hidden

    cards = items.map(makeCard);
    cards.forEach(function (li) { li.hidden = true; grid.appendChild(li); });
    buildFilters();
    moreBtn.addEventListener("click", function () { shown += PAGE; apply(); });
    section.hidden = false;
    apply();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
