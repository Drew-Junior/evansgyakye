/*
  Public-site data layer.
  Reads published content from Supabase and renders it into the empty-state
  containers already on each page. If Supabase isn't configured yet, or a
  query fails, pages simply keep their honest "on its way" empty states --
  nothing throws, nothing shows broken UI.
*/
(function () {
  "use strict";

  function client() {
    return window.supabaseClient || null;
  }

  function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  var CATEGORY_LABELS = { build: "Build", become: "Become", lead: "Lead", think: "Think", believe: "Believe" };

  var api = {
    async fetchBooks() {
      var sb = client();
      if (!sb) return [];
      var { data, error } = await sb
        .from("books")
        .select("id, title, author, description, cover_url, price_ghs, site_purchase_url, amazon_url, selar_url")
        .eq("published", true)
        .order("sort_order", { ascending: true });
      if (error) { console.warn("books:", error.message); return []; }
      return data || [];
    },

    async fetchArticles(category) {
      var sb = client();
      if (!sb) return [];
      var query = sb
        .from("articles")
        .select("id, title, slug, category, excerpt, cover_url, published_at")
        .eq("published", true)
        .order("published_at", { ascending: false });
      if (category && category !== "all") query = query.eq("category", category);
      var { data, error } = await query;
      if (error) { console.warn("articles:", error.message); return []; }
      return data || [];
    },

    async fetchTestimonials(pageContext) {
      var sb = client();
      if (!sb) return [];
      var query = sb
        .from("testimonials")
        .select("id, name, role, organisation, quote, photo_url, page_context")
        .eq("published", true)
        .order("sort_order", { ascending: true });
      if (pageContext) query = query.eq("page_context", pageContext);
      var { data, error } = await query;
      if (error) { console.warn("testimonials:", error.message); return []; }
      return data || [];
    },

    async fetchMedia() {
      var sb = client();
      if (!sb) return [];
      var { data, error } = await sb
        .from("media_mentions")
        .select("id, title, media_type, outlet, url, published_date")
        .eq("published", true)
        .order("published_date", { ascending: false });
      if (error) { console.warn("media:", error.message); return []; }
      return data || [];
    },

    async fetchSettings(keys) {
      var sb = client();
      if (!sb) return {};
      var { data, error } = await sb.from("site_settings").select("key, value").in("key", keys);
      if (error) { console.warn("settings:", error.message); return {}; }
      var out = {};
      (data || []).forEach(function (r) { out[r.key] = r.value; });
      return out;
    },

    async fetchSetting(key) {
      var sb = client();
      if (!sb) return null;
      var { data, error } = await sb.from("site_settings").select("value").eq("key", key).maybeSingle();
      if (error) { console.warn("settings:", error.message); return null; }
      return data && data.value ? data.value : null;
    },

    async fetchProjects() {
      var sb = client();
      if (!sb) return [];
      var { data, error } = await sb
        .from("projects")
        .select("id, name, description, image_url, status, link_url")
        .eq("published", true)
        .order("sort_order", { ascending: true });
      if (error) { console.warn("projects:", error.message); return []; }
      return data || [];
    },

    async subscribeToNewsletter(name, email) {
      var sb = client();
      if (!sb) return { ok: false, reason: "not_configured" };
      var { error } = await sb.from("newsletter_subscribers").insert({ name: name || null, email: email });
      if (error) { console.warn("newsletter signup:", error.message); return { ok: false, reason: error.message }; }
      return { ok: true };
    },

    async submitContactForm(payload) {
      var sb = client();
      if (!sb) return { ok: false, reason: "not_configured" };
      var { error } = await sb.from("contact_submissions").insert({
        enquiry_type: payload.enquiryType || "general",
        name: payload.name,
        email: payload.email,
        organisation: payload.organisation || null,
        message: payload.message,
      });
      if (error) { console.warn("contact submission:", error.message); return { ok: false, reason: error.message }; }
      return { ok: true };
    },
  };

  window.siteData = api;

  // ---------------------------------------------------------------------
  // Render helpers -- each looks for a container with a data-* hook and,
  // if it finds rows, replaces the static empty state with real content.
  // ---------------------------------------------------------------------

  function formatGHS(n) { return "GHS " + Number(n || 0).toFixed(2); }

  // Only allow normal web links (and site-relative paths when allowed) so a
  // mistyped or unsafe value in the CMS can never become a script link.
  function safeUrl(u, allowRelative) {
    var s = String(u || "").trim();
    if (/^https?:\/\//i.test(s)) return s;
    if (allowRelative && s.charAt(0) === "/") return s;
    return "";
  }

  // One "Buy now" button per book with a dropdown:
  //   On this site -> adds the book to the cart (pay with MoMo or card)
  //   Amazon / Selar -> opens that book's page on the other site
  function buyMenuHtml(b) {
    var hasPrice = Number(b.price_ghs) > 0;
    var amazon = safeUrl(b.amazon_url, false);
    var selar = safeUrl(b.selar_url, false);
    var siteLink = hasPrice ? "" : safeUrl(b.site_purchase_url, true);
    var items = "";

    if (hasPrice) {
      items += '<li role="none"><button type="button" role="menuitem" data-add-to-cart data-book-id="' + escapeHtml(b.id) +
        '" data-title="' + escapeHtml(b.title) + '" data-price="' + Number(b.price_ghs) + '">On this site<small>Pay with MoMo or card</small></button></li>';
    } else if (siteLink) {
      items += '<li role="none"><a role="menuitem" href="' + escapeHtml(siteLink) + '">On this site</a></li>';
    }
    if (amazon) {
      items += '<li role="none"><a role="menuitem" href="' + escapeHtml(amazon) + '" target="_blank" rel="nofollow noopener">Amazon<small>Opens this book on Amazon</small></a></li>';
    }
    if (selar) {
      items += '<li role="none"><a role="menuitem" href="' + escapeHtml(selar) + '" target="_blank" rel="nofollow noopener">Selar<small>Opens this book on Selar</small></a></li>';
    }
    if (!items) return "";

    return '<div class="buy-menu" data-buy-menu>' +
      '<button type="button" class="btn btn-primary buy-menu-toggle" aria-haspopup="true" aria-expanded="false" data-buy-toggle>' +
      'Buy now <span class="buy-menu-caret" aria-hidden="true">&#9662;</span></button>' +
      '<ul class="buy-menu-list" role="menu">' + items + "</ul></div>";
  }

  var buyMenuGlobalsBound = false;

  function closeAllBuyMenus() {
    document.querySelectorAll("[data-buy-menu].is-open").forEach(function (menu) {
      menu.classList.remove("is-open");
      var toggle = menu.querySelector("[data-buy-toggle]");
      if (toggle) toggle.setAttribute("aria-expanded", "false");
      var card = menu.closest(".book-card, .book-feature");
      if (card) card.classList.remove("menu-open");
    });
  }

  function wireBuyMenus(mount) {
    mount.querySelectorAll("[data-buy-toggle]").forEach(function (toggle) {
      toggle.addEventListener("click", function (event) {
        event.stopPropagation();
        var menu = toggle.closest("[data-buy-menu]");
        var willOpen = !menu.classList.contains("is-open");
        closeAllBuyMenus();
        if (willOpen) {
          menu.classList.add("is-open");
          toggle.setAttribute("aria-expanded", "true");
          var card = menu.closest(".book-card, .book-feature");
          if (card) card.classList.add("menu-open");
          // Keep the dropdown on screen: flip it to the right edge if it would overflow.
          var list = menu.querySelector(".buy-menu-list");
          if (list) {
            list.classList.remove("align-right");
            var rect = list.getBoundingClientRect();
            var viewportWidth = window.innerWidth || document.documentElement.clientWidth;
            if (rect.right > viewportWidth - 8) list.classList.add("align-right");
          }
        }
      });
    });

    mount.querySelectorAll("[data-add-to-cart]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (!window.cartApi) return;
        window.cartApi.addItem({
          book_id: btn.getAttribute("data-book-id"),
          title: btn.getAttribute("data-title"),
          unit_price: btn.getAttribute("data-price"),
        });
      });
    });

    if (!buyMenuGlobalsBound) {
      buyMenuGlobalsBound = true;
      document.addEventListener("click", closeAllBuyMenus);
      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") closeAllBuyMenus();
      });
    }
  }

  async function renderBookCatalog(selector, options) {
    options = options || {};
    var mount = document.querySelector(selector);
    if (!mount) return;
    var books = await api.fetchBooks();
    if (options.limit) books = books.slice(0, options.limit);

    if (!books.length) {
      mount.innerHTML = '<div class="empty-state" role="status">' +
        "<p><strong>Books are on their way.</strong></p>" +
        "<p>Add the first title through the admin dashboard and it will appear here automatically.</p></div>";
      return;
    }

    mount.innerHTML = '<div class="book-grid">' + books.map(function (b) {
      var hasPrice = Number(b.price_ghs) > 0;
      var cover = safeUrl(b.cover_url, true);
      return (
        '<article class="book-card">' +
        '<div class="book-card-cover">' +
        '<span class="book-card-cover-text" aria-hidden="true">' + escapeHtml(b.title) + "</span>" +
        (cover ? '<img src="' + escapeHtml(cover) + '" alt="Cover of ' + escapeHtml(b.title) + '" loading="lazy" onerror="this.remove()">' : "") +
        "</div>" +
        '<h3 class="book-card-title">' + escapeHtml(b.title) + "</h3>" +
        '<p class="book-card-author">By ' + escapeHtml(b.author || "Evans Gyakye") + "</p>" +
        (hasPrice ? '<p class="book-card-price">' + formatGHS(b.price_ghs) + "</p>" : "") +
        buyMenuHtml(b) +
        (b.description ? '<details class="book-card-details"><summary>About this book</summary><p>' + escapeHtml(b.description) + "</p></details>" : "") +
        "</article>"
      );
    }).join("") + "</div>";

    wireBuyMenus(mount);
  }

  function imgTag(url, cls, alt) {
    var safe = safeUrl(url, true);
    if (!safe) return "";
    return '<img class="' + cls + '" src="' + escapeHtml(safe) + '" alt="' + escapeHtml(alt || "") + '" loading="lazy" onerror="this.remove()">';
  }

  async function renderArticles(category) {
    var mount = document.querySelector("[data-articles-list]");
    var emptyState = document.querySelector("[data-articles-empty]");
    if (!mount) return;
    var articles = await api.fetchArticles(category);
    if (!articles.length) {
      mount.innerHTML = "";
      if (emptyState) emptyState.style.display = "";
      return;
    }
    if (emptyState) emptyState.style.display = "none";
    mount.innerHTML = '<div class="grid grid-3">' + articles.map(function (a) {
      var label = CATEGORY_LABELS[a.category] || a.category;
      var dateStr = a.published_at ? new Date(a.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";
      return (
        '<article class="card">' +
        imgTag(a.cover_url, "card-image", "Cover image for " + a.title) +
        '<span class="card-index">' + escapeHtml(label) + "</span>" +
        '<h3><a href="/think/' + escapeHtml(a.slug) + '.html" style="text-decoration:none;">' + escapeHtml(a.title) + "</a></h3>" +
        "<p>" + escapeHtml(a.excerpt) + "</p>" +
        (dateStr ? '<p class="field-hint">' + dateStr + "</p>" : "") +
        "</article>"
      );
    }).join("") + "</div>";
  }

  async function renderTestimonials(pageContext, selector) {
    var mount = document.querySelector(selector);
    if (!mount) return;
    var items = await api.fetchTestimonials(pageContext);
    if (!items.length) return;
    var emptyState = mount.querySelector(".empty-state");
    if (emptyState) emptyState.style.display = "none";
    var list = document.createElement("div");
    list.className = "grid grid-3";
    list.innerHTML = items.map(function (t) {
      var who = escapeHtml(t.name) +
        (t.role || t.organisation ? ", " + escapeHtml([t.role, t.organisation].filter(Boolean).join(", ")) : "");
      return (
        '<blockquote class="card testimonial-card">' +
        '<p class="testimonial-quote">\u201C' + escapeHtml(t.quote) + "\u201D</p>" +
        '<footer class="testimonial-meta">' +
        imgTag(t.photo_url, "testimonial-photo", "Photo of " + t.name) +
        "<span>&mdash; " + who + "</span></footer></blockquote>"
      );
    }).join("");
    mount.appendChild(list);
  }

  // Works out how to show an uploaded file or a pasted link.
  function mediaKind(url) {
    var path = String(url || "").split("?")[0].split("#")[0].toLowerCase();
    if (/\.(png|jpe?g|gif|webp|avif|svg)$/.test(path)) return "image";
    if (/\.(mp4|webm|mov|m4v)$/.test(path)) return "video";
    if (/\.(mp3|wav|m4a|aac|oga|ogg)$/.test(path)) return "audio";
    if (/\.pdf$/.test(path)) return "pdf";
    return "link";
  }

  // Turns a normal YouTube or Vimeo page link into an embeddable player link.
  // Returns "" for anything else, so other links keep their Open link button.
  function videoEmbedUrl(url) {
    var u;
    try { u = new URL(url); } catch (e) { return ""; }
    var host = u.hostname.replace(/^www\./, "").replace(/^m\./, "");
    var id = "";
    if (host === "youtu.be") {
      id = u.pathname.slice(1).split("/")[0];
    } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (u.pathname === "/watch") id = u.searchParams.get("v") || "";
      else {
        var m = u.pathname.match(/^\/(embed|shorts|live)\/([^/?#]+)/);
        if (m) id = m[2];
      }
    } else if (host === "vimeo.com") {
      var vm = u.pathname.match(/^\/(\d+)/);
      return vm ? "https://player.vimeo.com/video/" + vm[1] : "";
    }
    return /^[A-Za-z0-9_-]{6,20}$/.test(id) ? "https://www.youtube-nocookie.com/embed/" + id : "";
  }

  async function renderMedia() {
    var mount = document.querySelector("[data-media-list]");
    if (!mount) return;
    var items = await api.fetchMedia();
    if (!items.length) return;
    var emptyState = mount.querySelector(".empty-state");
    if (emptyState) emptyState.style.display = "none";
    var list = document.createElement("div");
    list.className = "grid grid-3";
    list.innerHTML = items.map(function (m) {
      var url = safeUrl(m.url, true);
      var kind = mediaKind(url);
      var embed = url ? videoEmbedUrl(url) : "";
      var player = "";
      var action = "";
      if (embed) {
        player = '<div class="media-embed"><iframe src="' + escapeHtml(embed) + '" title="' + escapeHtml(m.title) +
          '" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>';
      } else if (url && kind === "image") {
        player = '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener">' + imgTag(url, "media-thumb", m.title) + "</a>";
      } else if (url && kind === "video") {
        player = '<video class="media-player" controls preload="metadata" src="' + escapeHtml(url) + '"></video>';
      } else if (url && kind === "audio") {
        player = '<audio class="media-player" controls preload="none" src="' + escapeHtml(url) + '"></audio>';
      } else if (url) {
        action = '<div class="btn-group"><a class="btn btn-outline" href="' + escapeHtml(url) + '" target="_blank" rel="noopener">' + (kind === "pdf" ? "Open PDF" : "Open link") + "</a></div>";
      }
      return (
        '<article class="card media-card">' + player +
        '<span class="card-index">' + escapeHtml((m.media_type || "").toUpperCase()) + "</span>" +
        "<h3>" + escapeHtml(m.title) + "</h3>" +
        (m.outlet ? "<p>" + escapeHtml(m.outlet) + "</p>" : "") +
        action + "</article>"
      );
    }).join("");
    mount.appendChild(list);
  }

  // Projects: images from the CMS are added to the built-in cards
  // (matched by data-project-name); any other project becomes a new card.
  async function renderExtraProjects() {
    var items = await api.fetchProjects();
    if (!items.length) return;
    var mount = document.querySelector("[data-extra-projects]");
    var knownCards = Array.prototype.slice.call(document.querySelectorAll("[data-project-name]"));
    var extras = [];

    items.forEach(function (p) {
      var key = (p.name || "").trim().toLowerCase();
      var matches = knownCards.filter(function (el) { return el.getAttribute("data-project-name") === key; });
      if (matches.length) {
        var img = imgTag(p.image_url, "card-image", p.name);
        if (img) matches.forEach(function (card) {
          if (!card.querySelector(".card-image")) card.insertAdjacentHTML("afterbegin", img);
        });
      } else {
        extras.push(p);
      }
    });

    if (!mount || !extras.length) return;
    mount.innerHTML = extras.map(function (p) {
      var link = safeUrl(p.link_url, true);
      return (
        '<article class="card">' +
        imgTag(p.image_url, "card-image", p.name) +
        "<h3>" + escapeHtml(p.name) + "</h3>" +
        "<p>" + escapeHtml(p.description) + "</p>" +
        (link ? '<div class="btn-group"><a class="btn btn-outline" href="' + escapeHtml(link) + '" target="_blank" rel="noopener">Learn more</a></div>' : "") +
        "</article>"
      );
    }).join("");
  }

  // Headshot: CMS value wins; otherwise the page keeps its default file
  // (assets/images/evans-headshot.jpg), which hides itself if missing.
  async function renderHeadshot() {
    var img = document.querySelector(".hero-headshot");
    if (!img) return;
    var url = await api.fetchSetting("headshot_url");
    if (!url) return;
    img.style.display = "";
    img.src = url;
  }

  // Social media links in the footer. Values come from Dashboard -> Site
  // Settings; a network with no link is simply not shown.
  var SOCIAL_NETWORKS = [
    { key: "social_instagram", label: "Instagram" },
    { key: "social_facebook", label: "Facebook" },
    { key: "social_x", label: "X" },
    { key: "social_linkedin", label: "LinkedIn" },
    { key: "social_youtube", label: "YouTube" },
    { key: "social_tiktok", label: "TikTok" },
  ];

  async function renderSocialLinks() {
    var mounts = document.querySelectorAll("[data-social-links]");
    if (!mounts.length) return;
    var values = await api.fetchSettings(SOCIAL_NETWORKS.map(function (n) { return n.key; }));
    var links = SOCIAL_NETWORKS.filter(function (n) { return safeUrl(values[n.key], false); }).map(function (n) {
      return '<a href="' + escapeHtml(safeUrl(values[n.key], false)) + '" target="_blank" rel="noopener noreferrer me">' + n.label + "</a>";
    });
    if (!links.length) return;
    mounts.forEach(function (m) {
      m.innerHTML = '<span class="footer-social-label">Follow Evans</span>' + links.join("");
      m.hidden = false;
    });
  }

  window.siteRender = {
    renderSocialLinks,
    renderHeadshot,
    renderBookCatalog,
    renderArticles,
    renderTestimonials,
    renderMedia,
    renderExtraProjects,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderSocialLinks);
  } else {
    renderSocialLinks();
  }
})();
