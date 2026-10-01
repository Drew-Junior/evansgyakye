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
        .select("id, title, author, description, cover_url, site_purchase_url, amazon_url, selar_url")
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

  async function renderExtraBooks() {
    var mount = document.querySelector("[data-extra-books]");
    if (!mount) return;
    var books = await api.fetchBooks();
    // The first book ("27 Thoughts of a Transformer") is hard-coded on the
    // page already; only render additional titles here.
    var extra = books.filter(function (b) { return (b.title || "").trim().toLowerCase() !== "27 thoughts of a transformer"; });
    if (!extra.length) return;
    mount.innerHTML = extra.map(function (b) {
      return (
        '<article class="book-feature" style="margin-top:2.5rem;">' +
        '<div class="book-cover-slot" aria-hidden="true">' +
        (b.cover_url ? '<img src="' + escapeHtml(b.cover_url) + '" alt="">' : "Book cover to be added") +
        "</div><div>" +
        "<h3>" + escapeHtml(b.title) + "</h3>" +
        '<p class="book-byline">By ' + escapeHtml(b.author || "Evans Gyakye") + "</p>" +
        "<p>" + escapeHtml(b.description) + "</p>" +
        '<ul class="purchase-list">' +
        (b.site_purchase_url ? '<li><a href="' + escapeHtml(b.site_purchase_url) + '">Buy on this site</a></li>' : "") +
        (b.amazon_url ? '<li><a href="' + escapeHtml(b.amazon_url) + '" rel="nofollow noopener" target="_blank">Buy on Amazon</a></li>' : "") +
        (b.selar_url ? '<li><a href="' + escapeHtml(b.selar_url) + '" rel="nofollow noopener" target="_blank">Buy on Selar</a></li>' : "") +
        "</ul></div></article>"
      );
    }).join("");
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
      return (
        '<blockquote class="card" style="font-style:italic;">' +
        "\u201C" + escapeHtml(t.quote) + "\u201D" +
        '<footer style="margin-top:0.9rem; font-style:normal; font-size:0.9rem; color:var(--gold-deep);">' +
        "&mdash; " + escapeHtml(t.name) +
        (t.role || t.organisation ? ", " + escapeHtml([t.role, t.organisation].filter(Boolean).join(", ")) : "") +
        "</footer></blockquote>"
      );
    }).join("");
    mount.appendChild(list);
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
      return (
        '<a class="card" href="' + escapeHtml(m.url || "#") + '" target="_blank" rel="noopener" style="text-decoration:none; display:block;">' +
        '<span class="card-index">' + escapeHtml((m.media_type || "").toUpperCase()) + "</span>" +
        "<h3>" + escapeHtml(m.title) + "</h3>" +
        (m.outlet ? "<p>" + escapeHtml(m.outlet) + "</p>" : "") +
        "</a>"
      );
    }).join("");
    mount.appendChild(list);
  }

  async function renderExtraProjects() {
    var mount = document.querySelector("[data-extra-projects]");
    if (!mount) return;
    var items = await api.fetchProjects();
    var known = ["success factors", "yammall"];
    var extra = items.filter(function (p) { return known.indexOf((p.name || "").trim().toLowerCase()) === -1; });
    if (!extra.length) return;
    mount.innerHTML = extra.map(function (p) {
      return (
        '<article class="card">' +
        "<h3>" + escapeHtml(p.name) + "</h3>" +
        "<p>" + escapeHtml(p.description) + "</p>" +
        (p.link_url ? '<div class="btn-group"><a class="btn btn-outline" href="' + escapeHtml(p.link_url) + '" target="_blank" rel="noopener">Learn more</a></div>' : "") +
        "</article>"
      );
    }).join("");
  }

  window.siteRender = {
    renderExtraBooks,
    renderArticles,
    renderTestimonials,
    renderMedia,
    renderExtraProjects,
  };
})();
