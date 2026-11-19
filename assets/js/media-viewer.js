/*
  Shared full-screen media viewer + helpers, used by the Gallery (homepage and gallery.html)
  and by the project pages (project.html).
    MediaViewer.normalise(row)           -> safe item or null
    MediaViewer.open(list, index, fromEl) -> opens the viewer on list[index]
  Safety: every link must be https:// or a path on this site; text is inserted as plain text;
  only YouTube and Vimeo may be embedded.
*/
(function () {
  "use strict";

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
    var m = /\.([a-z0-9]{2,5})$/i.exec(String(u).split(/[?#]/)[0]);
    return m ? m[1].toUpperCase() : "";
  }
  function supabaseHost() {
    try { return new URL(window.SUPABASE_URL).host; } catch (e) { return ""; }
  }
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
      caption: row.caption ? String(row.caption).slice(0, 2000) : "",
      kind: kind, file: file, embed: embed, thumb: safeUrl(row.thumb_url),
      album: row.album ? String(row.album).slice(0, 60) : "",
      date: row.created_at || ""
    };
  }
  function badgeText(it) {
    if (it.kind === "video") return "Video";
    if (it.kind === "file") return ext(it.file) || "File";
    return "";
  }

  // ---------- viewer ----------
  var lb = null, stage, capTitle, capText, capCount, prevBtn, nextBtn;
  var list = [], current = 0, returnFocus = null;

  function buildViewer() {
    lb = el("div", "gal-lb");
    lb.setAttribute("role", "dialog"); lb.setAttribute("aria-modal", "true"); lb.setAttribute("aria-label", "Media viewer");
    var backdrop = el("div", "gal-lb-backdrop");
    backdrop.addEventListener("click", close);
    var closeBtn = el("button", "gal-lb-btn gal-lb-close", "\u00D7"); closeBtn.type = "button"; closeBtn.setAttribute("aria-label", "Close viewer");
    closeBtn.addEventListener("click", close);
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
    lb.appendChild(backdrop); lb.appendChild(figure); lb.appendChild(closeBtn); lb.appendChild(prevBtn); lb.appendChild(nextBtn);

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
    if (e.key === "Escape") { e.preventDefault(); close(); }
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
      node.appendChild(el("p", null, (ext(it.file) || "File")));
      var group = el("div", "btn-group");
      var open = el("a", "btn btn-primary", "Open"); open.href = it.file; open.target = "_blank"; open.rel = "noopener noreferrer";
      var dl = el("a", "btn btn-outline", "Download"); dl.href = downloadHref(it.file); dl.rel = "noopener noreferrer";
      group.appendChild(open); group.appendChild(dl); node.appendChild(group);
    }
    stage.appendChild(node);
  }

  function show(index, direction) {
    var it = list[index];
    current = index;
    fillStage(it, direction);
    capTitle.textContent = it.title;
    capText.textContent = it.kind === "file" ? "" : (it.caption.length > 300 ? it.caption.slice(0, 297) + "\u2026" : it.caption);
    capCount.textContent = list.length > 1 ? (index + 1) + " / " + list.length : "";
    prevBtn.hidden = nextBtn.hidden = list.length < 2;
    if (list.length > 1) {                          // warm up the next picture
      var nxt = list[(index + 1) % list.length];
      if (nxt && nxt.kind === "image") { var pre = new Image(); pre.src = nxt.file; }
    }
  }
  function go(step) {
    if (list.length < 2) return;
    show((current + step + list.length) % list.length, step > 0 ? "next" : "prev");
  }

  function open(items, index, fromEl) {
    if (!items || !items.length) return;
    if (!lb) buildViewer();
    list = items.slice();
    returnFocus = fromEl || document.activeElement;
    document.body.appendChild(lb);
    document.documentElement.classList.add("gal-open");
    document.addEventListener("keydown", onKey, true);
    show(Math.max(0, Math.min(index, list.length - 1)), "");
    lb.querySelector(".gal-lb-close").focus();
  }
  function close() {
    if (!lb || !lb.parentNode) return;
    stage.textContent = "";
    lb.parentNode.removeChild(lb);
    document.documentElement.classList.remove("gal-open");
    document.removeEventListener("keydown", onKey, true);
    if (returnFocus && returnFocus.focus) { try { returnFocus.focus(); } catch (e) { /* element gone */ } }
  }

  window.MediaViewer = { normalise: normalise, open: open, close: close, el: el, safeUrl: safeUrl, ext: ext, badgeText: badgeText };
})();
