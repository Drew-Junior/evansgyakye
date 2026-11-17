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
        '<h3><a href="/article.html?slug=' + encodeURIComponent(a.slug) + '" style="text-decoration:none;">' + escapeHtml(a.title) + "</a></h3>" +
        "<p>" + escapeHtml(a.excerpt) + "</p>" +
        (dateStr ? '<p class="field-hint">' + dateStr + "</p>" : "") +
        '<p><a href="/article.html?slug=' + encodeURIComponent(a.slug) + '">Read article &rarr;</a></p>' +
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

  // Social media links in the footer, shown as icons (no text). Values come
  // from Dashboard -> Site Settings; a network with no link is not shown.
  // Icons: Bootstrap Icons (MIT licence), https://icons.getbootstrap.com
  var SOCIAL_NETWORKS = [
    { key: "social_instagram", label: "Instagram", path: "M8 0C5.829 0 5.556.01 4.703.048 3.85.088 3.269.222 2.76.42a3.9 3.9 0 0 0-1.417.923A3.9 3.9 0 0 0 .42 2.76C.222 3.268.087 3.85.048 4.7.01 5.555 0 5.827 0 8.001c0 2.172.01 2.444.048 3.297.04.852.174 1.433.372 1.942.205.526.478.972.923 1.417.444.445.89.719 1.416.923.51.198 1.09.333 1.942.372C5.555 15.99 5.827 16 8 16s2.444-.01 3.298-.048c.851-.04 1.434-.174 1.943-.372a3.9 3.9 0 0 0 1.416-.923c.445-.445.718-.891.923-1.417.197-.509.332-1.09.372-1.942C15.99 10.445 16 10.173 16 8s-.01-2.445-.048-3.299c-.04-.851-.175-1.433-.372-1.941a3.9 3.9 0 0 0-.923-1.417A3.9 3.9 0 0 0 13.24.42c-.51-.198-1.092-.333-1.943-.372C10.443.01 10.172 0 7.998 0zm-.717 1.442h.718c2.136 0 2.389.007 3.232.046.78.035 1.204.166 1.486.275.373.145.64.319.92.599s.453.546.598.92c.11.281.24.705.275 1.485.039.843.047 1.096.047 3.231s-.008 2.389-.047 3.232c-.035.78-.166 1.203-.275 1.485a2.5 2.5 0 0 1-.599.919c-.28.28-.546.453-.92.598-.28.11-.704.24-1.485.276-.843.038-1.096.047-3.232.047s-2.39-.009-3.233-.047c-.78-.036-1.203-.166-1.485-.276a2.5 2.5 0 0 1-.92-.598 2.5 2.5 0 0 1-.6-.92c-.109-.281-.24-.705-.275-1.485-.038-.843-.046-1.096-.046-3.233s.008-2.388.046-3.231c.036-.78.166-1.204.276-1.486.145-.373.319-.64.599-.92s.546-.453.92-.598c.282-.11.705-.24 1.485-.276.738-.034 1.024-.044 2.515-.045zm4.988 1.328a.96.96 0 1 0 0 1.92.96.96 0 0 0 0-1.92m-4.27 1.122a4.109 4.109 0 1 0 0 8.217 4.109 4.109 0 0 0 0-8.217m0 1.441a2.667 2.667 0 1 1 0 5.334 2.667 2.667 0 0 1 0-5.334" },
    { key: "social_facebook", label: "Facebook", path: "M16 8.049c0-4.446-3.582-8.05-8-8.05C3.58 0-.002 3.603-.002 8.05c0 4.017 2.926 7.347 6.75 7.951v-5.625h-2.03V8.05H6.75V6.275c0-2.017 1.195-3.131 3.022-3.131.876 0 1.791.157 1.791.157v1.98h-1.009c-.993 0-1.303.621-1.303 1.258v1.51h2.218l-.354 2.326H9.25V16c3.824-.604 6.75-3.934 6.75-7.951" },
    { key: "social_x", label: "X", path: "M12.6.75h2.454l-5.36 6.142L16 15.25h-4.937l-3.867-5.07-4.425 5.07H.316l5.733-6.57L0 .75h5.063l3.495 4.633L12.601.75Zm-.86 13.028h1.36L4.323 2.145H2.865z" },
    { key: "social_linkedin", label: "LinkedIn", path: "M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854zm4.943 12.248V6.169H2.542v7.225zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248S2.4 3.226 2.4 3.934c0 .694.521 1.248 1.327 1.248zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.7-2.165 1.193v.025h-.016l.016-.025V6.169h-2.4c.03.678 0 7.225 0 7.225z" },
    { key: "social_youtube", label: "YouTube", path: "M8.051 1.999h.089c.822.003 4.987.033 6.11.335a2.01 2.01 0 0 1 1.415 1.42c.101.38.172.883.22 1.402l.01.104.022.26.008.104c.065.914.073 1.77.074 1.957v.075c-.001.194-.01 1.108-.082 2.06l-.008.105-.009.104c-.05.572-.124 1.14-.235 1.558a2.01 2.01 0 0 1-1.415 1.42c-1.16.312-5.569.334-6.18.335h-.142c-.309 0-1.587-.006-2.927-.052l-.17-.006-.087-.004-.171-.007-.171-.007c-1.11-.049-2.167-.128-2.654-.26a2.01 2.01 0 0 1-1.415-1.419c-.111-.417-.185-.986-.235-1.558L.09 9.82l-.008-.104A31 31 0 0 1 0 7.68v-.123c.002-.215.01-.958.064-1.778l.007-.103.003-.052.008-.104.022-.26.01-.104c.048-.519.119-1.023.22-1.402a2.01 2.01 0 0 1 1.415-1.42c.487-.13 1.544-.21 2.654-.26l.17-.007.172-.006.086-.003.171-.007A100 100 0 0 1 7.858 2zM6.4 5.209v4.818l4.157-2.408z" },
    { key: "social_tiktok", label: "TikTok", path: "M9 0h1.98c.144.715.54 1.617 1.235 2.512C12.895 3.389 13.797 4 15 4v2c-1.753 0-3.07-.814-4-1.829V11a5 5 0 1 1-5-5v2a3 3 0 1 0 3 3z" },
  ];

  async function renderSocialLinks() {
    var mounts = document.querySelectorAll("[data-social-links]");
    if (!mounts.length) return;
    var values = await api.fetchSettings(SOCIAL_NETWORKS.map(function (n) { return n.key; }));
    var links = SOCIAL_NETWORKS.filter(function (n) { return safeUrl(values[n.key], false); }).map(function (n) {
      return '<a class="social-icon" href="' + escapeHtml(safeUrl(values[n.key], false)) + '" target="_blank" rel="noopener noreferrer me" aria-label="' + n.label + '" title="' + n.label + '">' +
        '<svg viewBox="0 0 16 16" width="20" height="20" fill="currentColor" aria-hidden="true" focusable="false"><path d="' + n.path + '"/></svg></a>';
    });
    if (!links.length) return;
    mounts.forEach(function (m) {
      m.innerHTML = links.join("");
      m.hidden = false;
    });
  }

  // Homepage pictures, managed from Dashboard -> Site Settings -> Homepage pictures.
  // <img data-setting-img="public_..." data-fallback="/assets/images/..."> is filled from
  // the saved setting; if there is none (or it fails to load) the fallback file is tried;
  // if that also fails the slot shows a plain placeholder instead of a broken-image icon.
  async function renderHomeImages() {
    var imgs = document.querySelectorAll("img[data-setting-img]");
    if (!imgs.length) return;
    var keys = Array.prototype.map.call(imgs, function (i) { return i.getAttribute("data-setting-img"); });
    var values = await api.fetchSettings(keys);
    Array.prototype.forEach.call(imgs, function (img) {
      var queue = [
        safeUrl(values[img.getAttribute("data-setting-img")], true),
        safeUrl(img.getAttribute("data-fallback"), true)
      ].filter(Boolean);
      function giveUp() {
        if (img.getAttribute("data-on-missing") === "collapse") {
          var split = img.closest(".split");
          if (split) split.classList.add("no-media");
          var fig = img.closest("figure");
          if (fig) fig.remove();
        } else {
          if (img.parentElement) img.parentElement.classList.add("is-empty");
          img.remove();
        }
      }
      function next() {
        if (!queue.length) { giveUp(); return; }
        img.src = queue.shift();
      }
      img.addEventListener("error", next);
      next();
    });
  }

  window.siteRender = {
    renderSocialLinks,
    renderHomeImages,
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
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderHomeImages);
  } else {
    renderHomeImages();
  }
})();
