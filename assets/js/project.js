/*
  Project page (project.html?p=<project-slug>).
  Shows the project and its Updates (pictures, videos, files and text posted from
  Dashboard -> Project Posts). Each project keeps its own updates, separate from the others.
  Needs media-viewer.js loaded first.
*/
(function () {
  "use strict";
  var MV = window.MediaViewer;
  if (!MV) return;
  var el = MV.el;
  function $(id) { return document.getElementById(id); }

  var BUILTIN = {
    "success-factors": {
      name: "Success Factors",
      description: "Discover your potential. Activate your gifts. Pursue your purpose. Success Factors is a personal development movement centred on potential discovery, gifts activation, and the pursuit of purpose."
    },
    "yammall": {
      name: "Yammall",
      description: "Exploring opportunities in agricultural trade. Yammall is connected to my interests in business development, agricultural enterprise, and market opportunities \u2014 reflecting how products, markets, partnerships, and commercial planning come together in building business opportunities."
    }
  };
  function slugify(n) { return String(n || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60); }

  var slug = (new URLSearchParams(window.location.search).get("p") || "").trim().toLowerCase();
  var SLUG_OK = /^[a-z0-9]+(-[a-z0-9]+)*$/;

  function notFound() {
    document.title = "Project not found \u2014 Evans Gyakye";
    $("project-name").textContent = "Project not found";
    $("project-desc").textContent = "";
    $("crumb-project").textContent = "Not found";
    $("updates-heading").hidden = true;
    var s = $("project-state"); s.hidden = false;
    s.textContent = "We couldn\u2019t find that project. ";
    var a = el("a", null, "See all projects"); a.href = "/projects.html"; s.appendChild(a);
  }

  function setMeta(sel, attr, val) { var m = document.head.querySelector(sel); if (m) m.setAttribute(attr, val); }

  function paragraphs(container, text) {
    String(text || "").split(/\n{2,}/).forEach(function (chunk) {
      var t = chunk.trim();
      if (t) container.appendChild(el("p", null, t));
    });
  }

  function renderPosts(rows) {
    var feed = $("project-feed");
    var posts = rows.map(function (r) {
      var media = r.file_url ? MV.normalise(r) : null;
      return { row: r, media: media };
    }).filter(function (p) { return p.media || (r_isText(p.row)); });
    function r_isText(r) { return !r.file_url && r.title; }

    var viewerList = posts.filter(function (p) { return p.media; }).map(function (p) { return p.media; });
    if (!posts.length) { $("project-empty").hidden = false; return; }

    var io = ("IntersectionObserver" in window && !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches))
      ? new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } }); }, { threshold: 0.1 })
      : null;

    posts.forEach(function (p, i) {
      var card = el("article", "proj-post");
      if (p.media) {
        var it = p.media;
        var btn = el("button", "proj-media"); btn.type = "button";
        btn.setAttribute("aria-label", "Open " + it.title + (it.kind === "image" ? "" : " (" + MV.badgeText(it) + ")"));
        var src = it.kind === "image" ? it.file : it.thumb;
        if (src) {
          var img = el("img"); img.alt = ""; img.loading = "lazy"; img.decoding = "async";
          img.addEventListener("error", function () { img.remove(); btn.appendChild(el("span", "gal-placeholder", it.kind === "video" ? "\u25B6" : "\uD83D\uDCC4")); });
          img.src = src; btn.appendChild(img);
        } else {
          btn.appendChild(el("span", "gal-placeholder", it.kind === "video" ? "\u25B6" : it.kind === "file" ? "\uD83D\uDCC4" : "\u25A3"));
        }
        if (MV.badgeText(it)) btn.appendChild(el("span", "gal-badge", MV.badgeText(it)));
        if (it.kind === "video") { var pl = el("span", "gal-play"); pl.appendChild(el("span", null, "\u25B6")); btn.appendChild(pl); }
        btn.addEventListener("click", function () { MV.open(viewerList, viewerList.indexOf(it), btn); });
        card.appendChild(btn);
      }
      var body = el("div", "proj-body");
      body.appendChild(el("h3", null, String(p.row.title).slice(0, 120)));
      if (p.row.created_at) {
        var d = new Date(p.row.created_at);
        if (!isNaN(d)) { var t = el("time", "proj-date", d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })); t.setAttribute("datetime", d.toISOString()); body.appendChild(t); }
      }
      paragraphs(body, String(p.row.caption || "").slice(0, 2000));
      card.appendChild(body);
      feed.appendChild(card);
      if (io) { card.style.transitionDelay = ((i % 3) * 90) + "ms"; io.observe(card); } else card.classList.add("is-in");
    });
  }

  async function init() {
    if (!SLUG_OK.test(slug) || slug.length > 60) { notFound(); return; }
    var sb = window.supabaseClient;
    var dbProjects = [], rows = [];
    if (sb) {
      var results = await Promise.all([
        sb.from("projects").select("name, description, image_url, status, link_url, sort_order").eq("published", true).order("sort_order", { ascending: true }),
        sb.from("project_posts").select("title, caption, kind, file_url, thumb_url, created_at").eq("project", slug).eq("published", true)
          .order("sort_order", { ascending: true }).order("created_at", { ascending: false }).limit(100)
      ]);
      if (!results[0].error && Array.isArray(results[0].data)) dbProjects = results[0].data;
      if (!results[1].error && Array.isArray(results[1].data)) rows = results[1].data;
    }

    // every project (built-in + added in the dashboard), keyed by slug
    var all = {}, order = [];
    Object.keys(BUILTIN).forEach(function (k) { all[k] = { slug: k, name: BUILTIN[k].name, description: BUILTIN[k].description }; order.push(k); });
    dbProjects.forEach(function (p) {
      var k = slugify(p.name); if (!k) return;
      if (!all[k]) { all[k] = { slug: k }; order.push(k); }
      all[k].name = p.name; if (p.description) all[k].description = p.description;
      all[k].image = MV.safeUrl(p.image_url); all[k].status = p.status || ""; all[k].link = MV.safeUrl(p.link_url);
    });

    var project = all[slug];
    if (!project) { notFound(); return; }

    $("project-name").textContent = project.name;
    $("project-desc").textContent = project.description || "";
    $("crumb-project").textContent = project.name;
    document.title = project.name + " \u2014 Evans Gyakye";
    var short = String(project.description || "").slice(0, 155);
    setMeta('meta[name="description"]', "content", short);
    setMeta('meta[property="og:title"]', "content", document.title);
    setMeta('meta[property="og:description"]', "content", short);
    var canon = window.location.origin + "/project.html?p=" + encodeURIComponent(slug);
    setMeta('link[rel="canonical"]', "href", canon);
    setMeta('meta[property="og:url"]', "content", canon);

    if (project.status) { var meta = $("project-meta"); meta.hidden = false; meta.appendChild(el("span", null, project.status)); }
    if (project.image) { var cover = $("project-cover"); cover.src = project.image; cover.alt = project.name; cover.hidden = false; cover.addEventListener("error", function () { cover.remove(); }); }
    if (project.link && /^https:\/\//i.test(project.link)) {
      var a = el("a", "btn btn-outline", "Visit " + project.name); a.href = project.link; a.target = "_blank"; a.rel = "noopener noreferrer";
      $("project-actions").appendChild(a);
    }

    if (order.length > 1) {                           // tabs: one per project, each with its own page
      var tabs = $("project-tabs");
      order.forEach(function (k) {
        var t = el("a", null, all[k].name); t.href = "/project.html?p=" + encodeURIComponent(k);
        if (k === slug) t.setAttribute("aria-current", "page");
        tabs.appendChild(t);
      });
      tabs.hidden = false;
    }
    renderPosts(rows);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
