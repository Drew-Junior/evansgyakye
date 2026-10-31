/*
  Single article page (article.html).
  Reads ?slug=... from the URL, loads that published article from Supabase
  and renders it. Share link format:
    https://www.evansgyakye.com/article.html?slug=your-article-slug
*/
(function () {
  "use strict";

  var BASE = window.location.origin;
  var LABELS = { build: "Build", become: "Become", lead: "Lead", think: "Think", believe: "Believe" };

  function $(id) { return document.getElementById(id); }

  function showState(html) {
    var s = $("article-state");
    s.innerHTML = html;
    s.hidden = false;
    $("article").hidden = true;
  }

  function notFound() {
    document.title = "Article not found — Evans Gyakye";
    $("crumb-title").textContent = "Not found";
    showState(
      '<div class="container">' +
      '<h1 style="font-family:var(--font-serif);">We couldn\u2019t find that article</h1>' +
      '<p>It may have been unpublished, or the link may be mistyped.</p>' +
      '<div class="btn-group" style="justify-content:center;">' +
      '<a class="btn btn-primary" href="/think.html">Back to the Thinking Room</a></div></div>'
    );
  }

  function safeImg(url) {
    return /^https?:\/\//i.test(url || "") || /^\/[^/]/.test(url || "") ? url : "";
  }

  function setMeta(selector, attr, value) {
    var el = document.head.querySelector(selector);
    if (el) el.setAttribute(attr, value);
  }

  function applySeo(a, url) {
    var title = a.title + " \u2014 Evans Gyakye";
    var img = safeImg(a.cover_url) || BASE + "/assets/images/og-cover.jpg";
    document.title = title;
    setMeta('meta[name="description"]', "content", a.excerpt);
    setMeta('link[rel="canonical"]', "href", url);
    setMeta('meta[property="og:title"]', "content", a.title);
    setMeta('meta[property="og:description"]', "content", a.excerpt);
    setMeta('meta[property="og:url"]', "content", url);
    setMeta('meta[property="og:image"]', "content", img);

    var ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: a.title,
      description: a.excerpt,
      image: img,
      datePublished: a.published_at || undefined,
      dateModified: a.updated_at || a.published_at || undefined,
      author: { "@type": "Person", name: "Evans Gyakye", url: BASE + "/" },
      mainEntityOfPage: url
    });
    document.head.appendChild(ld);
  }

  function wireShare(a, url) {
    var enc = encodeURIComponent(url);
    var text = encodeURIComponent(a.title);
    $("share-whatsapp").href = "https://wa.me/?text=" + text + "%20" + enc;
    $("share-linkedin").href = "https://www.linkedin.com/sharing/share-offsite/?url=" + enc;
    $("share-x").href = "https://twitter.com/intent/tweet?text=" + text + "&url=" + enc;
    $("share-facebook").href = "https://www.facebook.com/sharer/sharer.php?u=" + enc;

    var btn = $("copy-link");
    btn.addEventListener("click", function () {
      function done() { btn.textContent = "Link copied"; setTimeout(function () { btn.textContent = "Copy link"; }, 2000); }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done, function () { window.prompt("Copy this link:", url); });
      } else {
        window.prompt("Copy this link:", url);
      }
    });
  }

  async function init() {
    var slug = (new URLSearchParams(window.location.search).get("slug") || "").trim();
    var sb = window.supabaseClient;
    if (!slug) { notFound(); return; }
    if (!sb) { showState('<div class="container"><p>This article could not be loaded right now. Please try again shortly.</p></div>'); return; }

    var res = await sb
      .from("articles")
      .select("title, slug, category, excerpt, body_html, cover_url, published_at, updated_at")
      .eq("slug", slug)
      .eq("published", true)
      .maybeSingle();

    if (res.error) {
      console.warn("article:", res.error.message);
      showState('<div class="container"><p>This article could not be loaded right now. Please try again shortly.</p></div>');
      return;
    }
    var a = res.data;
    if (!a) { notFound(); return; }

    var url = BASE + "/article.html?slug=" + encodeURIComponent(a.slug);
    var label = LABELS[a.category] || a.category;

    $("crumb-title").textContent = a.title;
    $("article-category").textContent = label;
    $("article-title").textContent = a.title;
    $("article-excerpt").textContent = a.excerpt;
    if (a.published_at) {
      $("article-date").textContent = "Published " + new Date(a.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    }
    var cover = safeImg(a.cover_url);
    if (cover) {
      var img = $("article-cover");
      img.src = cover;
      img.alt = "Cover image for " + a.title;
      img.hidden = false;
      img.onerror = function () { img.remove(); };
    }
    // body_html is written only by the signed-in admin (RLS), so it is trusted.
    $("article-body").innerHTML = a.body_html;

    applySeo(a, url);
    wireShare(a, url);
    $("article-state").hidden = true;
    $("article").hidden = false;
  }

  init();
})();
