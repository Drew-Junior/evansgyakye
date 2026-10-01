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
      listColumns: ["title", "author", "published"],
      fields: [
        { key: "title", label: "Title", type: "text", required: true },
        { key: "author", label: "Author", type: "text", default: "Evans Gyakye" },
        { key: "description", label: "Description", type: "textarea", required: true },
        { key: "cover_url", label: "Cover image URL", type: "text" },
        { key: "site_purchase_url", label: "Buy on this site (URL)", type: "text" },
        { key: "amazon_url", label: "Amazon URL", type: "text" },
        { key: "selar_url", label: "Selar URL", type: "text" },
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
        { key: "cover_url", label: "Cover image URL", type: "text" },
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
        { key: "photo_url", label: "Photo URL", type: "text" },
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
        { key: "url", label: "URL", type: "text" },
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
        { key: "image_url", label: "Image URL", type: "text" },
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
        '<td class="actions"><button class="btn btn-outline btn-sm" data-edit="' + row.id + '">Edit</button>' +
        '<button class="btn btn-danger btn-sm" data-delete="' + row.id + '">Delete</button></td></tr>';
    }).join("");

    $all("[data-edit]", tbody).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var row = data.find(function (r) { return String(r.id) === btn.getAttribute("data-edit"); });
        openModal(key, row);
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
  // Init
  // =====================================================================
  document.addEventListener("DOMContentLoaded", function () {
    $("#login-form").addEventListener("submit", handleLogin);
    $("#logout-btn").addEventListener("click", handleLogout);
    initNav();
    checkSession();
  });
})();
