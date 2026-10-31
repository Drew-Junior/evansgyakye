(function () {
  "use strict";

  var els = {};

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function esc(v) {
    if (v == null) return "";
    return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function sb() { return window.supabaseClient; }

  // =====================================================================
  // Content-type configuration. Add a new content type by adding an entry
  // here -- the list view, add/edit modal and delete action are generated
  // from this config, so no per-type UI code is needed.
  // =====================================================================
  var CONFIGS = {
    books: {
      label: "Books",
      table: "books",
      order: { column: "sort_order", ascending: true },
      listColumns: ["title", "author", "price_ghs", "published"],
      fields: [
        { key: "title", label: "Title", type: "text", required: true },
        { key: "author", label: "Author", type: "text", default: "Evans Gyakye" },
        { key: "description", label: "Description", type: "textarea", required: true },
        { key: "price_ghs", label: "Price (GHS) — set above 0 to enable the On this site option (pay with MoMo or card via Paystack). Leave at 0 to hide it", type: "number", default: 0 },
        { key: "cover_url", label: "Cover image", type: "image" },
        { key: "site_purchase_url", label: "Link for \"On this site\" (only used when the price is 0)", type: "text" },
        { key: "amazon_url", label: "Amazon page for this book (full https:// link)", type: "text" },
        { key: "selar_url", label: "Selar page for this book (full https:// link)", type: "text" },
        { key: "sort_order", label: "Sort order", type: "number", default: 0 },
        { key: "published", label: "Published", type: "checkbox", default: true },
      ],
    },
    articles: {
      label: "Think Articles",
      table: "articles",
      order: { column: "created_at", ascending: false },
      listColumns: ["title", "category", "published"],
      fields: [
        { key: "title", label: "Title", type: "text", required: true },
        { key: "slug", label: "Slug (url-safe, unique)", type: "text", required: true },
        { key: "category", label: "Category", type: "select", options: ["build", "become", "lead", "think", "believe"], required: true },
        { key: "excerpt", label: "Excerpt", type: "textarea", required: true },
        { key: "body_html", label: "Body (HTML)", type: "textarea", required: true },
        { key: "cover_url", label: "Cover image", type: "image" },
        { key: "published_at", label: "Published date", type: "datetime-local" },
        { key: "published", label: "Published", type: "checkbox", default: false },
      ],
    },
    testimonials: {
      label: "Testimonials",
      table: "testimonials",
      order: { column: "sort_order", ascending: true },
      listColumns: ["name", "page_context", "published"],
      fields: [
        { key: "name", label: "Name", type: "text", required: true },
        { key: "role", label: "Role", type: "text" },
        { key: "organisation", label: "Organisation", type: "text" },
        { key: "quote", label: "Quote", type: "textarea", required: true },
        { key: "photo_url", label: "Photo", type: "image" },
        { key: "page_context", label: "Show on", type: "select", options: ["home", "speak"], default: "home" },
        { key: "sort_order", label: "Sort order", type: "number", default: 0 },
        { key: "published", label: "Published", type: "checkbox", default: true },
      ],
    },
    media_mentions: {
      label: "Media",
      table: "media_mentions",
      order: { column: "published_date", ascending: false },
      listColumns: ["title", "media_type", "published"],
      fields: [
        { key: "title", label: "Title", type: "text", required: true },
        { key: "media_type", label: "Type", type: "select", options: ["video", "podcast", "radio", "media", "interview"], required: true },
        { key: "outlet", label: "Outlet", type: "text" },
        { key: "url", label: "Link or uploaded file", type: "file", accept: "image/*,video/*,audio/*,application/pdf" },
        { key: "published_date", label: "Date", type: "date" },
        { key: "published", label: "Published", type: "checkbox", default: true },
      ],
    },
    projects: {
      label: "Projects",
      table: "projects",
      order: { column: "sort_order", ascending: true },
      listColumns: ["name", "status", "published"],
      fields: [
        { key: "name", label: "Name", type: "text", required: true },
        { key: "description", label: "Description", type: "textarea", required: true },
        { key: "image_url", label: "Image", type: "image" },
        { key: "status", label: "Status", type: "text" },
        { key: "link_url", label: "Link URL", type: "text" },
        { key: "sort_order", label: "Sort order", type: "number", default: 0 },
        { key: "published", label: "Published", type: "checkbox", default: true },
      ],
    },
  };

  var state = { section: "books", editingId: null };

  // =====================================================================
  // Auth
  // =====================================================================
  async function checkSession() {
    if (!sb()) { showConfigNote(); return; }
    var { data } = await sb().auth.getSession();
    if (data && data.session) {
      showApp();
    } else {
      showLogin();
    }
  }

  function showConfigNote() {
    $("#login-config-note").classList.add("is-visible");
    $("#login-form").style.display = "none";
  }

  function showLogin() {
    $(".login-screen").style.display = "flex";
    $(".app-shell").classList.remove("is-visible");
  }

  function showApp() {
    $(".login-screen").style.display = "none";
    $(".app-shell").classList.add("is-visible");
    renderSection(state.section);
  }

  async function handleLogin(event) {
    event.preventDefault();
    var errorBox = $("#login-error");
    errorBox.classList.remove("is-visible");
    var email = $("#login-email").value.trim();
    var password = $("#login-password").value;
    var { error } = await sb().auth.signInWithPassword({ email: email, password: password });
    if (error) {
      errorBox.textContent = error.message;
      errorBox.classList.add("is-visible");
      return;
    }
    showApp();
  }

  async function handleLogout() {
    if (sb()) await sb().auth.signOut();
    showLogin();
  }

  // =====================================================================
  // Sidebar navigation
  // =====================================================================
  function initNav() {
    $all(".nav-item[data-section]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.section = btn.getAttribute("data-section");
        $all(".nav-item[data-section]").forEach(function (b) { b.classList.remove("is-active"); });
        btn.classList.add("is-active");
        renderSection(state.section);
      });
    });
  }

  function renderSection(section) {
    if (CONFIGS[section]) return renderContentTypeSection(section);
    if (section === "newsletter") return renderNewsletterSection();
    if (section === "messages") return renderMessagesSection();
    if (section === "orders") return renderOrdersSection();
    if (section === "settings") return renderSettingsSection();
  }

  // =====================================================================
  // Generic content-type list + modal form
  // =====================================================================
  async function renderContentTypeSection(key) {
    var cfg = CONFIGS[key];
    var panel = $("#main-panel");
    panel.innerHTML =
      '<div class="panel-header"><div><h2>' + esc(cfg.label) + '</h2>' +
      '<p>Manage the ' + esc(cfg.label.toLowerCase()) + ' shown on the public site.</p></div>' +
      '<button class="btn" data-add>+ Add ' + esc(cfg.label.replace(/s$/, "")) + '</button></div>' +
      '<table class="data-table"><thead><tr>' +
      cfg.listColumns.map(function (c) { return "<th>" + esc(prettify(c)) + "</th>"; }).join("") +
      '<th style="width:1%;">Actions</th></tr></thead><tbody id="table-body">' +
      '<tr class="empty-row"><td colspan="' + (cfg.listColumns.length + 1) + '">Loading\u2026</td></tr>' +
      "</tbody></table>";

    $("[data-add]", panel).addEventListener("click", function () { openModal(key, null); });

    if (!sb()) {
      $("#table-body").innerHTML = '<tr class="empty-row"><td colspan="' + (cfg.listColumns.length + 1) + '">Connect Supabase in assets/js/supabase-client.js to manage content.</td></tr>';
      return;
    }

    var { data, error } = await sb().from(cfg.table).select("*").order(cfg.order.column, { ascending: cfg.order.ascending });
    var tbody = $("#table-body");
    if (error) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="' + (cfg.listColumns.length + 1) + '">Could not load: ' + esc(error.message) + "</td></tr>";
      return;
    }
    if (!data || !data.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="' + (cfg.listColumns.length + 1) + '">Nothing here yet \u2014 add the first one.</td></tr>';
      return;
    }
    tbody.innerHTML = data.map(function (row) {
      return "<tr>" + cfg.listColumns.map(function (c) { return "<td>" + renderCell(c, row[c]) + "</td>"; }).join("") +
        '<td class="actions">' +
        (key === "articles" ? '<button class="btn btn-outline btn-sm" data-copy-link="' + esc(row.slug) + '">Copy link</button>' : "") +
        '<button class="btn btn-outline btn-sm" data-edit="' + row.id + '">Edit</button>' +
        '<button class="btn btn-danger btn-sm" data-delete="' + row.id + '">Delete</button></td></tr>';
    }).join("");

    $all("[data-edit]", tbody).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var row = data.find(function (r) { return String(r.id) === btn.getAttribute("data-edit"); });
        openModal(key, row);
      });
    });
    $all("[data-copy-link]", tbody).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var link = window.location.origin + "/article.html?slug=" + encodeURIComponent(btn.getAttribute("data-copy-link"));
        var label = btn.textContent;
        function done() { btn.textContent = "Copied!"; setTimeout(function () { btn.textContent = label; }, 1800); }
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(done, function () { window.prompt("Copy this link:", link); });
        else window.prompt("Copy this link:", link);
      });
    });
    $all("[data-delete]", tbody).forEach(function (btn) {
      btn.addEventListener("click", async function () {
        if (!confirm("Delete this entry? This cannot be undone.")) return;
        await sb().from(cfg.table).delete().eq("id", btn.getAttribute("data-delete"));
        renderContentTypeSection(key);
      });
    });
  }

  function prettify(key) { return key.replace(/_/g, " ").replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }

  function renderCell(col, value) {
    if (col === "published") return value ? '<span class="badge badge-published">Published</span>' : '<span class="badge badge-draft">Draft</span>';
    if (col === "price_ghs") return "GHS " + Number(value || 0).toFixed(2);
    return esc(value);
  }

  function openModal(key, row) {
    var cfg = CONFIGS[key];
    state.editingId = row ? row.id : null;
    var backdrop = $("#modal-backdrop");
    backdrop.innerHTML =
      '<div class="modal"><h3>' + (row ? "Edit" : "Add") + " " + esc(cfg.label.replace(/s$/, "")) + '</h3>' +
      '<form id="entry-form">' +
      cfg.fields.map(function (f) { return renderField(f, row); }).join("") +
      '<div class="modal-actions">' +
      '<button type="button" class="btn btn-outline" data-cancel>Cancel</button>' +
      '<button type="submit" class="btn">Save</button>' +
      "</div></form></div>";
    backdrop.classList.add("is-visible");

    $("[data-cancel]", backdrop).addEventListener("click", closeModal);
    $("#entry-form", backdrop).addEventListener("submit", function (event) { saveEntry(event, key); });

    wireUploads(backdrop, cfg.fields);
  }

  // Wires every upload button inside `root` for fields of type image/file.
  function wireUploads(root, fields) {
    fields.filter(function (f) { return f.type === "image" || f.type === "file"; }).forEach(function (f) {
      var trigger = $('[data-upload-trigger="' + f.key + '"]', root);
      var fileInput = $("#f-" + f.key + "-file", root);
      var statusEl = $('[data-upload-status="' + f.key + '"]', root);
      var urlInput = $("#f-" + f.key, root);
      if (!trigger || !fileInput) return;
      trigger.addEventListener("click", function () { fileInput.click(); });
      fileInput.addEventListener("change", async function () {
        var file = fileInput.files[0];
        if (!file) return;
        statusEl.textContent = "Uploading\u2026 (large videos can take a while)";
        try {
          var url = await uploadImage(file);
          urlInput.value = url;
          var previewEl = $('[data-image-preview="' + f.key + '"]', root);
          var html = file.type.indexOf("image/") === 0
            ? '<img src="' + esc(url) + '" alt="" style="max-width:120px;max-height:120px;border-radius:8px;margin-top:0.5rem;display:block;" data-image-preview="' + f.key + '">'
            : '<a href="' + esc(url) + '" target="_blank" rel="noopener" style="display:inline-block;margin-top:0.5rem;font-size:0.85rem;" data-image-preview="' + f.key + '">View uploaded file</a>';
          if (previewEl) previewEl.outerHTML = html;
          statusEl.textContent = "Uploaded.";
        } catch (err) {
          statusEl.textContent = "Upload failed: " + (err && err.message ? err.message : String(err));
        }
      });
    });
  }

  async function uploadImage(file) {
    var sbc = sb();
    if (!sbc) throw new Error("Supabase not configured");
    var ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    var path = "uploads/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + "." + ext;
    var { error } = await sbc.storage.from("media").upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) {
      var message = error.message || String(error);
      if (/size|large|exceed|413|payload/i.test(message)) {
        message += " \u2014 this file is bigger than your Supabase storage limit (50 MB on the free plan). Compress it, or upload the video to YouTube and paste its link instead.";
      }
      throw new Error(message);
    }
    var { data } = sbc.storage.from("media").getPublicUrl(path);
    return data.publicUrl;
  }

  function renderField(f, row) {
    var value = row ? row[f.key] : f.default;
    if (f.type === "textarea") {
      return '<div class="field"><label for="f-' + f.key + '">' + esc(f.label) + "</label>" +
        '<textarea id="f-' + f.key + '" name="' + f.key + '"' + (f.required ? " required" : "") + ">" + esc(value) + "</textarea></div>";
    }
    if (f.type === "select") {
      return '<div class="field"><label for="f-' + f.key + '">' + esc(f.label) + "</label>" +
        '<select id="f-' + f.key + '" name="' + f.key + '"' + (f.required ? " required" : "") + ">" +
        f.options.map(function (o) { return '<option value="' + esc(o) + '"' + (o === value ? " selected" : "") + ">" + esc(prettify(o)) + "</option>"; }).join("") +
        "</select></div>";
    }
    if (f.type === "checkbox") {
      return '<div class="checkbox-row"><input type="checkbox" id="f-' + f.key + '" name="' + f.key + '"' + (value ? " checked" : "") + ">" +
        '<label for="f-' + f.key + '">' + esc(f.label) + "</label></div>";
    }
    if (f.type === "image" || f.type === "file") {
      var accept = f.accept || "image/*";
      var isImg = f.type === "image" || /\.(png|jpe?g|gif|webp|svg|avif)(\?|$)/i.test(String(value || ""));
      var preview = value
        ? (isImg
            ? '<img src="' + esc(value) + '" alt="" style="max-width:120px;max-height:120px;border-radius:8px;margin-top:0.5rem;display:block;" data-image-preview="' + f.key + '">'
            : '<a href="' + esc(value) + '" target="_blank" rel="noopener" style="display:inline-block;margin-top:0.5rem;font-size:0.85rem;" data-image-preview="' + f.key + '">View current file</a>')
        : '<div data-image-preview="' + f.key + '"></div>';
      return '<div class="field"><label for="f-' + f.key + '">' + esc(f.label) + "</label>" +
        '<input type="text" id="f-' + f.key + '" name="' + f.key + '" value="' + esc(value == null ? "" : value) + '" placeholder="Paste a link, or upload a file below">' +
        '<div style="margin-top:0.5rem; display:flex; align-items:center; gap:0.6rem;">' +
        '<input type="file" accept="' + esc(accept) + '" id="f-' + f.key + '-file" style="display:none;">' +
        '<button type="button" class="btn btn-outline btn-sm" data-upload-trigger="' + f.key + '">Upload file</button>' +
        '<span class="field-hint" data-upload-status="' + f.key + '"></span>' +
        "</div>" + preview + "</div>";
    }
    var inputType = f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "datetime-local" ? "datetime-local" : "text";
    var displayValue = value;
    if (f.type === "datetime-local" && value) displayValue = String(value).slice(0, 16);
    return '<div class="field"><label for="f-' + f.key + '">' + esc(f.label) + "</label>" +
      '<input type="' + inputType + '" id="f-' + f.key + '" name="' + f.key + '" value="' + esc(displayValue == null ? "" : displayValue) + '"' + (f.required ? " required" : "") + "></div>";
  }

  function closeModal() { $("#modal-backdrop").classList.remove("is-visible"); $("#modal-backdrop").innerHTML = ""; }

  async function saveEntry(event, key) {
    event.preventDefault();
    var cfg = CONFIGS[key];
    var form = event.target;
    var payload = {};
    cfg.fields.forEach(function (f) {
      var el = $("#f-" + f.key, form);
      if (f.type === "checkbox") { payload[f.key] = el.checked; return; }
      if (f.type === "number") { payload[f.key] = el.value === "" ? null : Number(el.value); return; }
      payload[f.key] = el.value === "" ? null : el.value;
    });
    if (key === "articles" && payload.slug) {
      payload.slug = payload.slug.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    }

    var query = state.editingId
      ? sb().from(cfg.table).update(payload).eq("id", state.editingId)
      : sb().from(cfg.table).insert(payload);
    var { error } = await query;
    if (error) { alert("Could not save: " + error.message); return; }
    closeModal();
    renderContentTypeSection(key);
  }

  // =====================================================================
  // Newsletter subscribers (read + delete only)
  // =====================================================================
  async function renderNewsletterSection() {
    var panel = $("#main-panel");
    panel.innerHTML =
      '<div class="panel-header"><div><h2>Newsletter Subscribers</h2>' +
      "<p>Everyone who has joined \u201CKeep Thinking With Me.\u201D</p></div></div>" +
      '<table class="data-table"><thead><tr><th>Name</th><th>Email</th><th>Subscribed</th><th style="width:1%;">Actions</th></tr></thead>' +
      '<tbody id="table-body"><tr class="empty-row"><td colspan="4">Loading\u2026</td></tr></tbody></table>';

    if (!sb()) { $("#table-body").innerHTML = '<tr class="empty-row"><td colspan="4">Connect Supabase to view subscribers.</td></tr>'; return; }

    var { data, error } = await sb().from("newsletter_subscribers").select("*").order("subscribed_at", { ascending: false });
    var tbody = $("#table-body");
    if (error) { tbody.innerHTML = '<tr class="empty-row"><td colspan="4">Could not load: ' + esc(error.message) + "</td></tr>"; return; }
    if (!data || !data.length) { tbody.innerHTML = '<tr class="empty-row"><td colspan="4">No subscribers yet.</td></tr>'; return; }
    tbody.innerHTML = data.map(function (row) {
      return "<tr><td>" + esc(row.name || "\u2014") + "</td><td>" + esc(row.email) + "</td><td>" +
        esc(new Date(row.subscribed_at).toLocaleDateString()) + '</td><td class="actions">' +
        '<button class="btn btn-danger btn-sm" data-delete="' + row.id + '">Remove</button></td></tr>';
    }).join("");
    $all("[data-delete]", tbody).forEach(function (btn) {
      btn.addEventListener("click", async function () {
        if (!confirm("Remove this subscriber?")) return;
        await sb().from("newsletter_subscribers").delete().eq("id", btn.getAttribute("data-delete"));
        renderNewsletterSection();
      });
    });
  }

  // =====================================================================
  // Contact / enquiry messages
  // =====================================================================
  async function renderMessagesSection() {
    var panel = $("#main-panel");
    panel.innerHTML =
      '<div class="panel-header"><div><h2>Messages</h2>' +
      "<p>Enquiries submitted through the Contact page.</p></div></div>" +
      '<table class="data-table"><thead><tr><th>Type</th><th>Name</th><th>Email</th><th>Status</th><th>Received</th><th style="width:1%;">Actions</th></tr></thead>' +
      '<tbody id="table-body"><tr class="empty-row"><td colspan="6">Loading\u2026</td></tr></tbody></table>';

    if (!sb()) { $("#table-body").innerHTML = '<tr class="empty-row"><td colspan="6">Connect Supabase to view messages.</td></tr>'; return; }

    var { data, error } = await sb().from("contact_submissions").select("*").order("submitted_at", { ascending: false });
    var tbody = $("#table-body");
    if (error) { tbody.innerHTML = '<tr class="empty-row"><td colspan="6">Could not load: ' + esc(error.message) + "</td></tr>"; return; }
    if (!data || !data.length) { tbody.innerHTML = '<tr class="empty-row"><td colspan="6">No messages yet.</td></tr>'; return; }
    tbody.innerHTML = data.map(function (row) {
      return "<tr><td>" + esc(prettify(row.enquiry_type)) + "</td><td>" + esc(row.name) + "</td><td>" + esc(row.email) +
        "</td><td>" + esc(prettify(row.status)) + "</td><td>" + esc(new Date(row.submitted_at).toLocaleDateString()) +
        '</td><td class="actions"><button class="btn btn-outline btn-sm" data-view="' + row.id + '">View</button>' +
        '<button class="btn btn-danger btn-sm" data-delete="' + row.id + '">Delete</button></td></tr>';
    }).join("");

    $all("[data-view]", tbody).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var row = data.find(function (r) { return String(r.id) === btn.getAttribute("data-view"); });
        openMessageModal(row);
      });
    });
    $all("[data-delete]", tbody).forEach(function (btn) {
      btn.addEventListener("click", async function () {
        if (!confirm("Delete this message?")) return;
        await sb().from("contact_submissions").delete().eq("id", btn.getAttribute("data-delete"));
        renderMessagesSection();
      });
    });
  }

  function openMessageModal(row) {
    var backdrop = $("#modal-backdrop");
    backdrop.innerHTML =
      '<div class="modal"><h3>' + esc(row.name) + " \u2014 " + esc(prettify(row.enquiry_type)) + "</h3>" +
      "<p><strong>Email:</strong> " + esc(row.email) + "</p>" +
      (row.organisation ? "<p><strong>Organisation:</strong> " + esc(row.organisation) + "</p>" : "") +
      '<p style="white-space:pre-wrap;">' + esc(row.message) + "</p>" +
      '<div class="field"><label for="status-select">Status</label><select id="status-select">' +
      ["new", "read", "archived"].map(function (s) { return '<option value="' + s + '"' + (s === row.status ? " selected" : "") + ">" + prettify(s) + "</option>"; }).join("") +
      "</select></div>" +
      '<div class="modal-actions"><button type="button" class="btn btn-outline" data-close>Close</button>' +
      '<button type="button" class="btn" data-save-status>Update Status</button></div></div>';
    backdrop.classList.add("is-visible");
    $("[data-close]", backdrop).addEventListener("click", closeModal);
    $("[data-save-status]", backdrop).addEventListener("click", async function () {
      await sb().from("contact_submissions").update({ status: $("#status-select", backdrop).value }).eq("id", row.id);
      closeModal();
      renderMessagesSection();
    });
  }

  // =====================================================================
  // Orders (Paystack purchases)
  // =====================================================================
  async function renderOrdersSection() {
    var panel = $("#main-panel");
    panel.innerHTML =
      '<div class="panel-header"><div><h2>Orders</h2>' +
      "<p>Book purchases made through the site via Paystack.</p></div></div>" +
      '<table class="data-table"><thead><tr><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th>Date</th><th style="width:1%;">Actions</th></tr></thead>' +
      '<tbody id="table-body"><tr class="empty-row"><td colspan="6">Loading\u2026</td></tr></tbody></table>';

    if (!sb()) { $("#table-body").innerHTML = '<tr class="empty-row"><td colspan="6">Connect Supabase to view orders.</td></tr>'; return; }

    var { data, error } = await sb().from("orders").select("*").order("created_at", { ascending: false });
    var tbody = $("#table-body");
    if (error) { tbody.innerHTML = '<tr class="empty-row"><td colspan="6">Could not load: ' + esc(error.message) + "</td></tr>"; return; }
    if (!data || !data.length) { tbody.innerHTML = '<tr class="empty-row"><td colspan="6">No orders yet.</td></tr>'; return; }

    var statusBadge = { paid: "badge-published", pending: "badge-draft", failed: "badge-draft" };

    tbody.innerHTML = data.map(function (row) {
      var itemsSummary = (row.items || []).map(function (i) { return i.title + " \u00d7" + i.qty; }).join(", ");
      return "<tr><td>" + esc(row.customer_name) + "<br><span style='color:var(--grey);font-size:0.8rem;'>" + esc(row.customer_email) + "</span></td>" +
        "<td>" + esc(itemsSummary) + "</td>" +
        "<td>" + esc(row.currency) + " " + Number(row.total_amount).toFixed(2) + "</td>" +
        '<td><span class="badge ' + (statusBadge[row.status] || "badge-draft") + '">' + esc(prettify(row.status)) + "</span></td>" +
        "<td>" + esc(new Date(row.created_at).toLocaleDateString()) + '</td>' +
        '<td class="actions"><button class="btn btn-danger btn-sm" data-delete="' + row.id + '">Delete</button></td></tr>';
    }).join("");

    $all("[data-delete]", tbody).forEach(function (btn) {
      btn.addEventListener("click", async function () {
        if (!confirm("Delete this order record? This does not refund any payment.")) return;
        await sb().from("orders").delete().eq("id", btn.getAttribute("data-delete"));
        renderOrdersSection();
      });
    });
  }

  // =====================================================================
  // Site settings (homepage background video + footer social links)
  // Self-contained: only needs the existing helpers $, esc, sb(),
  // renderField() and uploadImage().
  // =====================================================================
  var SETTINGS_FIELDS = [
    { key: "hero_video_url", label: "Background video \u2014 upload an MP4 or WebM, or paste a link to one", type: "image", accept: "video/mp4,video/webm" },
    { key: "hero_poster_url", label: "Poster picture (shown while the video loads)", type: "image" },
    { key: "social_instagram", label: "Instagram profile link", type: "text" },
    { key: "social_facebook", label: "Facebook page link", type: "text" },
    { key: "social_x", label: "X (Twitter) profile link", type: "text" },
    { key: "social_linkedin", label: "LinkedIn profile link", type: "text" },
    { key: "social_youtube", label: "YouTube channel link", type: "text" },
    { key: "social_tiktok", label: "TikTok profile link", type: "text" },
  ];

  async function renderSettingsSection() {
    var panel = $("#main-panel");
    panel.innerHTML =
      '<div class="panel-header"><div><h2>Site Settings</h2>' +
      "<p>Details used across the public site.</p></div></div>" +
      '<form id="settings-form" style="max-width:560px;background:#fff;border:1px solid var(--border);border-radius:12px;padding:1.5rem;">' +
      '<p class="field-hint">Loading\u2026</p></form>';

    var form = $("#settings-form");
    if (!sb()) { form.innerHTML = '<p class="field-hint">Connect Supabase to manage settings.</p>'; return; }

    var { data, error } = await sb().from("site_settings").select("key, value");
    if (error) {
      form.innerHTML = '<p class="field-hint">Could not load settings: ' + esc(error.message) + " (have you run the site_settings SQL in Supabase?)</p>";
      return;
    }
    var current = {};
    (data || []).forEach(function (r) { current[r.key] = r.value; });

    var imageFields = SETTINGS_FIELDS.filter(function (f) { return f.type === "image"; });
    var textFields = SETTINGS_FIELDS.filter(function (f) { return f.type !== "image"; });

    form.innerHTML =
      '<h3 style="margin:0 0 0.25rem;font-size:1rem;">Homepage background video</h3>' +
      '<p class="field-hint" style="margin:0 0 0.75rem;">Plays silently behind the welcome text. Use a short looping clip (10\u201320 seconds) compressed to under 10 MB; free Supabase storage allows up to 50 MB per file. Leave it empty to use the file at assets/video/hero.mp4 instead.</p>' +
      imageFields.map(function (f) { return renderField(f, current); }).join("") +
      '<h3 style="margin:1.5rem 0 0.25rem;font-size:1rem;">Social media (shown in the footer)</h3>' +
      '<p class="field-hint" style="margin:0 0 0.75rem;">Paste the full profile link, starting with https://. Leave a box empty to hide that network.</p>' +
      textFields.map(function (f) { return renderField(f, current); }).join("") +
      '<div style="display:flex; align-items:center; gap:0.75rem; margin-top:1rem;">' +
      '<button type="submit" class="btn">Save settings</button>' +
      '<span class="field-hint" id="settings-status"></span></div>';

    // Upload buttons -> Supabase Storage -> fill the link field
    imageFields.forEach(function (f) {
      var trigger = $('[data-upload-trigger="' + f.key + '"]', form);
      var fileInput = $("#f-" + f.key + "-file", form);
      var uploadStatus = $('[data-upload-status="' + f.key + '"]', form);
      var urlInput = $("#f-" + f.key, form);
      trigger.addEventListener("click", function () { fileInput.click(); });
      fileInput.addEventListener("change", async function () {
        var file = fileInput.files[0];
        if (!file) return;
        uploadStatus.textContent = "Uploading\u2026";
        try {
          var url = await uploadImage(file);
          urlInput.value = url;
          var previewEl = $('[data-image-preview="' + f.key + '"]', form);
          if (previewEl) {
            previewEl.outerHTML = file.type.indexOf("image/") === 0
              ? '<img src="' + esc(url) + '" alt="" style="max-width:120px;max-height:120px;border-radius:8px;margin-top:0.5rem;display:block;" data-image-preview="' + f.key + '">'
              : '<a href="' + esc(url) + '" target="_blank" rel="noopener" style="display:inline-block;margin-top:0.5rem;font-size:0.85rem;" data-image-preview="' + f.key + '">View uploaded file</a>';
          }
          uploadStatus.textContent = "Uploaded \u2014 now click Save settings.";
        } catch (err) {
          uploadStatus.textContent = "Upload failed: " + (err && err.message ? err.message : String(err));
        }
      });
    });

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      var statusEl = $("#settings-status");
      var rows = [];
      var problems = [];
      SETTINGS_FIELDS.forEach(function (f) {
        var value = $("#f-" + f.key, form).value.trim();
        var allowSitePath = f.type === "image" && /^\/[^/]/.test(value);
        if (value && !allowSitePath && !/^https?:\/\//i.test(value)) problems.push(f.label);
        rows.push({ key: f.key, value: value || null, updated_at: new Date().toISOString() });
      });
      if (problems.length) {
        statusEl.textContent = "These must start with https:// (video and picture boxes may also start with /): " + problems.join(", ");
        return;
      }
      var { error: saveError } = await sb().from("site_settings").upsert(rows, { onConflict: "key" });
      statusEl.textContent = saveError ? "Could not save: " + saveError.message : "Saved.";
    });
  }

  // =====================================================================
  // Init
  // =====================================================================
  document.addEventListener("DOMContentLoaded", function () {
    $("#login-form").addEventListener("submit", handleLogin);
    $("#logout-btn").addEventListener("click", handleLogout);
    initNav();
    checkSession();
  });
})();
