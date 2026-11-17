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
  // Calls an Edge Function and ALWAYS returns its JSON answer (also for 4xx replies).
  async function invokeFn(name, body) {
    var res = await sb().functions.invoke(name, { body: body });
    if (res.error && !res.data) {
      try {
        var ctx = res.error.context && (await res.error.context.json());
        if (ctx) return ctx;
      } catch (e) { /* not JSON */ }
      return { ok: false, code: "unreachable", error: "Could not reach the server function (" + name + "). Is it deployed?" };
    }
    return res.data || { ok: false, code: "unreachable" };
  }

  var IDLE_MS = 30 * 60 * 1000;      // sign out after 30 minutes without activity
  var MFA_MAX_WRONG = 5;             // wrong authenticator codes before being signed out
  var idleTimer = null, lockTimer = null, mfaWrong = 0, mfaFactorId = null;

  function loginMessage(text) {
    var box = $("#login-error");
    box.textContent = text || "";
    box.classList.toggle("is-visible", !!text);
  }

  async function checkSession() {
    if (!sb()) { showConfigNote(); return; }
    var { data } = await sb().auth.getSession();
    if (data && data.session) { await afterPassword(); } else { showLogin(); }
  }

  function showConfigNote() {
    $("#login-config-note").classList.add("is-visible");
    $("#login-form").style.display = "none";
  }

  function showLogin() {
    stopIdleTimer();
    $(".login-screen").style.display = "flex";
    $(".app-shell").classList.remove("is-visible");
    $("#login-form").style.display = "";
    $("#mfa-form").style.display = "none";
  }

  function showApp() {
    $(".login-screen").style.display = "none";
    $(".app-shell").classList.add("is-visible");
    startIdleTimer();
    renderSection(state.section);
  }

  // ---- Idle sign-out ---------------------------------------------------
  function resetIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(async function () {
      if (sb()) await sb().auth.signOut();
      showLogin();
      loginMessage("You were signed out after 30 minutes of inactivity.");
    }, IDLE_MS);
  }
  function startIdleTimer() {
    ["mousemove", "keydown", "click", "touchstart", "scroll"].forEach(function (ev) {
      document.addEventListener(ev, resetIdle, { passive: true });
    });
    resetIdle();
  }
  function stopIdleTimer() {
    clearTimeout(idleTimer);
    ["mousemove", "keydown", "click", "touchstart", "scroll"].forEach(function (ev) {
      document.removeEventListener(ev, resetIdle);
    });
  }

  // ---- Step 1: password (counted and limited on the server) -----------
  function lockCountdown(seconds) {
    var btn = $("#login-form button[type=submit]");
    clearInterval(lockTimer);
    btn.disabled = true;
    var left = seconds;
    function tick() {
      if (left <= 0) { clearInterval(lockTimer); btn.disabled = false; loginMessage(""); return; }
      var m = Math.floor(left / 60), sec = String(left % 60).padStart(2, "0");
      loginMessage("Too many sign-in attempts. Please wait " + m + ":" + sec + " before trying again.");
      left -= 1;
    }
    tick();
    lockTimer = setInterval(tick, 1000);
  }

  async function handleLogin(event) {
    event.preventDefault();
    loginMessage("");
    var btn = $("#login-form button[type=submit]");
    var email = $("#login-email").value.trim();
    var password = $("#login-password").value;
    btn.disabled = true;
    var r = await invokeFn("admin-login", { email: email, password: password });
    if (r && r.ok && r.access_token && r.refresh_token) {
      var set = await sb().auth.setSession({ access_token: r.access_token, refresh_token: r.refresh_token });
      $("#login-password").value = "";
      btn.disabled = false;
      if (set.error) { loginMessage("Could not start your session. Please try again."); return; }
      await afterPassword();
      return;
    }
    if (r && r.code === "locked") { lockCountdown(Number(r.retry_after) || 900); return; }
    btn.disabled = false;
    if (r && r.code === "invalid") loginMessage("Incorrect email or password.");
    else if (r && r.code === "setup") loginMessage("Sign-in is not set up yet. Finish the setup steps (APP_SECRET).");
    else loginMessage("Sign-in is unavailable right now. Please try again shortly.");
  }

  // ---- Step 2: authenticator code (MFA) -------------------------------
  async function afterPassword() {
    var lvl = await sb().auth.mfa.getAuthenticatorAssuranceLevel();
    var d = lvl.data || {};
    if (d.currentLevel === "aal2") { showApp(); return; }
    if (d.nextLevel === "aal2") { await showMfaChallenge(); return; }
    await showMfaEnroll();
  }

  function showMfaScreen(intro, enrolling) {
    $(".login-screen").style.display = "flex";
    $(".app-shell").classList.remove("is-visible");
    $("#login-form").style.display = "none";
    $("#mfa-form").style.display = "";
    $("#mfa-intro").textContent = intro;
    $("#mfa-enroll-box").style.display = enrolling ? "" : "none";
    $("#mfa-code").value = "";
    $("#mfa-code").focus();
    loginMessage("");
  }

  async function showMfaChallenge() {
    var f = await sb().auth.mfa.listFactors();
    var verified = (f.data && f.data.totp || []).filter(function (x) { return x.status === "verified"; })[0];
    if (!verified) { await showMfaEnroll(); return; }
    mfaFactorId = verified.id;
    showMfaScreen("Enter the 6-digit code from your authenticator app.", false);
  }

  async function showMfaEnroll() {
    // Remove any half-finished set-up from an earlier attempt, then start a new one.
    var f = await sb().auth.mfa.listFactors();
    var all = (f.data && f.data.all) || [];
    for (var i = 0; i < all.length; i++) {
      if (all[i].status === "unverified") await sb().auth.mfa.unenroll({ factorId: all[i].id });
    }
    var en = await sb().auth.mfa.enroll({ factorType: "totp", friendlyName: "Dashboard " + new Date().toISOString().slice(0, 10) });
    if (en.error || !en.data) {
      showLogin();
      loginMessage("Could not start two-step set-up: " + ((en.error && en.error.message) || "unknown error"));
      return;
    }
    mfaFactorId = en.data.id;
    $("#mfa-qr").src = en.data.totp.qr_code;
    $("#mfa-secret").textContent = en.data.totp.secret;
    showMfaScreen("First-time set-up: scan this QR code with an authenticator app (Google Authenticator, Microsoft Authenticator, Authy\u2026), then enter the 6-digit code it shows. Save the key below somewhere safe: it lets you restore the app if you lose your phone.", true);
  }

  async function handleMfa(event) {
    event.preventDefault();
    var code = $("#mfa-code").value.replace(/\s+/g, "");
    if (!/^\d{6}$/.test(code)) { loginMessage("Enter the 6 digits from your app."); return; }
    var btn = $("#mfa-form button[type=submit]");
    btn.disabled = true;
    var r = await sb().auth.mfa.challengeAndVerify({ factorId: mfaFactorId, code: code });
    btn.disabled = false;
    if (r.error) {
      mfaWrong += 1;
      if (mfaWrong >= MFA_MAX_WRONG) {
        mfaWrong = 0;
        await sb().auth.signOut();
        showLogin();
        loginMessage("Too many wrong codes. You have been signed out; please sign in again.");
        return;
      }
      loginMessage("That code was not accepted. " + (MFA_MAX_WRONG - mfaWrong) + " tries left.");
      $("#mfa-code").value = "";
      return;
    }
    mfaWrong = 0;
    loginMessage("");
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
    if (section === "popup") return renderPopupSection();
    if (section === "bookfiles") return renderBookFilesSection();
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
  // Book files: the actual PDFs/EPUBs buyers receive after paying.
  // Stored in the PRIVATE "book-files" bucket (no public address);
  // buyers only ever get temporary links created by the server.
  // =====================================================================
  var BOOK_BUCKET = "book-files";
  var BOOK_MAX_BYTES = 50 * 1024 * 1024;

  function safeBookFileName(name) {
    var ext = /\.epub$/i.test(name) ? "epub" : "pdf";
    var base = String(name).replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "book";
    return base + "." + ext;
  }
  function megabytes(n) { return n ? (n / 1048576).toFixed(1) + " MB" : ""; }

  async function renderBookFilesSection() {
    var panel = $("#main-panel");
    panel.innerHTML =
      '<div class="panel-header"><div><h2>Book Files</h2>' +
      "<p>The PDF or EPUB each buyer receives after paying. Files are stored privately; buyers only get a temporary link (valid 7 days).</p></div></div>" +
      '<p class="field-hint" id="bookfiles-status" role="status" style="margin-bottom:0.75rem;"></p>' +
      '<table class="data-table"><thead><tr><th>Book</th><th>Price</th><th>File</th><th style="width:1%;">Actions</th></tr></thead>' +
      '<tbody id="table-body"><tr class="empty-row"><td colspan="4">Loading\u2026</td></tr></tbody></table>';
    var tbody = $("#table-body");
    if (!sb()) { tbody.innerHTML = '<tr class="empty-row"><td colspan="4">Connect Supabase to manage book files.</td></tr>'; return; }

    var booksRes = await sb().from("books").select("id, title, price_ghs").order("sort_order", { ascending: true });
    var filesRes = await sb().from("book_files").select("*");
    if (booksRes.error) { tbody.innerHTML = '<tr class="empty-row"><td colspan="4">Could not load: ' + esc(booksRes.error.message) + "</td></tr>"; return; }
    if (filesRes.error) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="4">Could not load files: ' + esc(filesRes.error.message) + " (have you run book-delivery.sql in Supabase?)</td></tr>";
      return;
    }
    var books = booksRes.data || [];
    var byBook = {};
    (filesRes.data || []).forEach(function (f) { byBook[f.book_id] = f; });
    if (!books.length) { tbody.innerHTML = '<tr class="empty-row"><td colspan="4">Add a book first under Books.</td></tr>'; return; }

    var statusEl = $("#bookfiles-status");
    tbody.innerHTML = books.map(function (b) {
      var f = byBook[b.id];
      var price = Number(b.price_ghs) > 0 ? "GHS " + Number(b.price_ghs).toFixed(2) : "<span style='color:var(--grey);'>Not sold on site</span>";
      var fileCell = f
        ? esc(f.file_name || "file") + (f.file_size ? " <span style='color:var(--grey);font-size:0.8rem;'>(" + megabytes(f.file_size) + ")</span>" : "")
        : (Number(b.price_ghs) > 0 ? "<span style='color:#9a3412;'>\u26A0 No file yet \u2014 buyers cannot receive this book</span>" : "<span style='color:var(--grey);'>No file</span>");
      return "<tr><td>" + esc(b.title) + "</td><td>" + price + "</td><td>" + fileCell + "</td>" +
        '<td class="actions" style="white-space:nowrap;">' +
        '<input type="file" accept=".pdf,.epub,application/pdf,application/epub+zip" data-file-for="' + esc(b.id) + '" style="display:none;">' +
        '<button class="btn btn-outline btn-sm" data-upload="' + esc(b.id) + '">' + (f ? "Replace" : "Upload") + "</button>" +
        (f ? ' <button class="btn btn-danger btn-sm" data-remove="' + esc(b.id) + '">Remove</button>' : "") + "</td></tr>";
    }).join("");

    $all("[data-upload]", tbody).forEach(function (btn) {
      var id = btn.getAttribute("data-upload");
      var input = $('[data-file-for="' + id + '"]', tbody);
      btn.addEventListener("click", function () { input.click(); });
      input.addEventListener("change", async function () {
        var file = input.files[0];
        input.value = "";
        if (!file) return;
        var isEpub = /\.epub$/i.test(file.name), isPdf = /\.pdf$/i.test(file.name);
        if (!isEpub && !isPdf) { statusEl.textContent = "Please choose a PDF or EPUB file."; return; }
        if (file.type && file.type !== "application/pdf" && file.type !== "application/epub+zip") { statusEl.textContent = "That file type is not allowed. Use PDF or EPUB."; return; }
        if (file.size > BOOK_MAX_BYTES) { statusEl.textContent = "That file is over 50 MB. Please compress it first."; return; }

        btn.disabled = true;
        statusEl.textContent = "Uploading " + file.name + "\u2026";
        var cleanName = safeBookFileName(file.name);
        var path = id + "/" + Date.now() + "-" + cleanName;
        var up = await sb().storage.from(BOOK_BUCKET).upload(path, file, { contentType: isEpub ? "application/epub+zip" : "application/pdf", upsert: false });
        if (up.error) { statusEl.textContent = "Upload failed: " + up.error.message; btn.disabled = false; return; }

        var old = byBook[id];
        var saved = await sb().from("book_files").upsert(
          { book_id: id, file_path: path, file_name: cleanName, file_size: file.size, updated_at: new Date().toISOString() },
          { onConflict: "book_id" }
        );
        if (saved.error) {
          await sb().storage.from(BOOK_BUCKET).remove([path]); // don't leave an orphan behind
          statusEl.textContent = "Could not save: " + saved.error.message;
          btn.disabled = false;
          return;
        }
        if (old && old.file_path) { await sb().storage.from(BOOK_BUCKET).remove([old.file_path]); }
        renderBookFilesSection();
      });
    });

    $all("[data-remove]", tbody).forEach(function (btn) {
      btn.addEventListener("click", async function () {
        var id = btn.getAttribute("data-remove");
        var f = byBook[id];
        if (!f || !confirm("Remove this book file? Buyers will no longer be able to receive it until you upload a new one.")) return;
        var del = await sb().from("book_files").delete().eq("book_id", id);
        if (del.error) { statusEl.textContent = "Could not remove: " + del.error.message; return; }
        await sb().storage.from(BOOK_BUCKET).remove([f.file_path]);
        renderBookFilesSection();
      });
    });
  }

  // =====================================================================
  // Newsletter pop-up settings (stored in site_settings, public_popup_* keys)
  // =====================================================================
  var POPUP_KEYS = ["public_popup_enabled", "public_popup_delay", "public_popup_days",
    "public_popup_label", "public_popup_title", "public_popup_text", "public_popup_button"];

  async function renderPopupSection() {
    var panel = $("#main-panel");
    panel.innerHTML =
      '<div class="panel-header"><div><h2>Newsletter Pop-up</h2>' +
      "<p>An optional invitation that appears on the homepage and article pages. Visitors choose whether to open it. Sign-ups appear under Newsletter.</p></div></div>" +
      '<form id="popup-form" style="max-width:560px;background:#fff;border:1px solid var(--border);border-radius:12px;padding:1.5rem;">' +
      '<p class="field-hint">Loading\u2026</p></form>';
    var form = $("#popup-form");
    if (!sb()) { form.innerHTML = '<p class="field-hint">Connect Supabase to manage the pop-up.</p>'; return; }

    var { data, error } = await sb().from("site_settings").select("key, value").in("key", POPUP_KEYS);
    if (error) {
      form.innerHTML = '<p class="field-hint">Could not load settings: ' + esc(error.message) + " (have you run the site_settings SQL in Supabase?)</p>";
      return;
    }
    var cur = {};
    (data || []).forEach(function (r) { cur[r.key] = r.value; });
    var on = cur.public_popup_enabled !== "off";

    function input(key, label, max, ph, type) {
      return '<div class="field"><label for="f-' + key + '">' + esc(label) + "</label>" +
        '<input type="' + (type || "text") + '" id="f-' + key + '" maxlength="' + max + '" placeholder="' + esc(ph) + '" value="' + esc(cur[key] == null ? "" : cur[key]) + '"></div>';
    }
    form.innerHTML =
      '<div class="checkbox-row"><input type="checkbox" id="f-popup-on"' + (on ? " checked" : "") + ">" +
      '<label for="f-popup-on">Show the pop-up to visitors</label></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">' +
      input("public_popup_delay", "Appears after (seconds)", 3, "8", "number") +
      input("public_popup_days", "After it is closed, wait (days)", 3, "7", "number") + "</div>" +
      '<p class="field-hint" style="margin:-0.5rem 0 1rem;">Seconds: 3\u2013120 (default 8). Days: 1\u2013365 (default 7). Visitors who subscribe never see it again.</p>' +
      input("public_popup_label", "Small heading", 60, "A Letter From My Thinking Room") +
      input("public_popup_title", "Title", 80, "Keep thinking with me") +
      '<div class="field"><label for="f-public_popup_text">Message</label>' +
      '<textarea id="f-public_popup_text" maxlength="400" placeholder="Every so often, I send an idea worth thinking about\u2026">' + esc(cur.public_popup_text == null ? "" : cur.public_popup_text) + "</textarea></div>" +
      input("public_popup_button", "Button text", 30, "Join the Conversation") +
      '<p class="field-hint" style="margin:-0.5rem 0 1rem;">Leave a box empty to use the default wording shown in grey.</p>' +
      '<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">' +
      '<button type="submit" class="btn">Save pop-up settings</button>' +
      '<a class="btn btn-outline" href="/?popup=preview" target="_blank" rel="noopener">Preview pop-up</a>' +
      '<span class="field-hint" id="popup-status"></span></div>';

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      var statusEl = $("#popup-status");
      function val(k) { return $("#f-" + k, form).value.trim(); }
      var delay = val("public_popup_delay"), days = val("public_popup_days");
      if (delay && !(/^\d+$/.test(delay) && +delay >= 3 && +delay <= 120)) { statusEl.textContent = "Seconds must be a whole number from 3 to 120."; return; }
      if (days && !(/^\d+$/.test(days) && +days >= 1 && +days <= 365)) { statusEl.textContent = "Days must be a whole number from 1 to 365."; return; }
      var rows = [{ key: "public_popup_enabled", value: $("#f-popup-on", form).checked ? "on" : "off" }];
      POPUP_KEYS.slice(1).forEach(function (k) { rows.push({ key: k, value: val(k) || null }); });
      var stamp = new Date().toISOString();
      rows.forEach(function (r) { r.updated_at = stamp; });
      var { error: saveError } = await sb().from("site_settings").upsert(rows, { onConflict: "key" });
      statusEl.textContent = saveError ? "Could not save: " + saveError.message : "Saved. Use Preview pop-up to see it.";
    });
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
      "<p>Book purchases made through the site via Paystack. Paid orders are delivered automatically. Each link allows a few downloads; use New link or Email book to give a customer a fresh set.</p></div></div>" +
      '<p class="field-hint" id="orders-status" role="status" style="margin-bottom:0.75rem;"></p>' +
      '<table class="data-table"><thead><tr><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th>Delivery</th><th>Date</th><th style="width:1%;">Actions</th></tr></thead>' +
      '<tbody id="table-body"><tr class="empty-row"><td colspan="7">Loading\u2026</td></tr></tbody></table>';

    if (!sb()) { $("#table-body").innerHTML = '<tr class="empty-row"><td colspan="7">Connect Supabase to view orders.</td></tr>'; return; }

    var { data, error } = await sb().from("orders").select("*").order("created_at", { ascending: false });
    var tbody = $("#table-body");
    if (error) { tbody.innerHTML = '<tr class="empty-row"><td colspan="7">Could not load: ' + esc(error.message) + "</td></tr>"; return; }
    if (!data || !data.length) { tbody.innerHTML = '<tr class="empty-row"><td colspan="7">No orders yet.</td></tr>'; return; }

    var statusBadge = { paid: "badge-published", pending: "badge-draft", failed: "badge-draft" };
    var deliveryLabel = { pending: "Waiting", sending: "Sending\u2026", sent: "Emailed", link_only: "Link shown on site", failed: "Needs attention" };
    var statusEl = $("#orders-status");

    tbody.innerHTML = data.map(function (row) {
      var itemsSummary = (row.items || []).map(function (i) { return i.title + " \u00d7" + i.qty; }).join(", ");
      var paid = row.status === "paid";
      var delivery = paid
        ? '<span title="' + esc(row.delivery_note || "") + '">' + esc(deliveryLabel[row.delivery_status] || prettify(row.delivery_status || "")) + "</span>" +
          (row.delivery_note ? "<br><span style='color:var(--grey);font-size:0.75rem;'>" + esc(row.delivery_note) + "</span>" : "")
        : (row.delivery_note ? "<span style='color:var(--grey);font-size:0.75rem;'>" + esc(row.delivery_note) + "</span>" : "\u2014");
      return "<tr><td>" + esc(row.customer_name) + "<br><span style='color:var(--grey);font-size:0.8rem;'>" + esc(row.customer_email) + "</span></td>" +
        "<td>" + esc(itemsSummary) + "</td>" +
        "<td>" + esc(row.currency) + " " + Number(row.total_amount).toFixed(2) + "</td>" +
        '<td><span class="badge ' + (statusBadge[row.status] || "badge-draft") + '">' + esc(prettify(row.status)) + "</span></td>" +
        "<td>" + delivery + "</td>" +
        "<td>" + esc(new Date(row.created_at).toLocaleDateString()) + '</td>' +
        '<td class="actions" style="white-space:nowrap;">' +
        (paid ? '<button class="btn btn-outline btn-sm" data-email-order="' + row.id + '">Email book</button> ' +
                '<button class="btn btn-outline btn-sm" data-link-order="' + row.id + '">Copy link</button> ' +
                '<button class="btn btn-outline btn-sm" data-newlink-order="' + row.id + '">New link</button> ' : "") +
        '<button class="btn btn-danger btn-sm" data-delete="' + row.id + '">Delete</button></td></tr>';
    }).join("");

    function linkFor(d) { return window.location.origin + "/download.html#t=" + d.token; }
    function copyText(text, done) {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { window.prompt("Copy this link:", text); });
      else window.prompt("Copy this link:", text);
    }

    $all("[data-email-order]", tbody).forEach(function (btn) {
      btn.addEventListener("click", async function () {
        if (!confirm("Email the customer a FRESH download link now? Their old link will stop working.")) return;
        btn.disabled = true; statusEl.textContent = "Sending\u2026";
        var r = await invokeFn("resend-delivery", { order_id: btn.getAttribute("data-email-order"), send_email: true, reset: true });
        var msg = r.ok ? "Emailed." : (r.status === "link_only" ? "E-mail is not set up yet (add the Resend key). Use Copy link meanwhile." : (r.note || r.error || "Could not send."));
        renderOrdersSection().then(function () { $("#orders-status").textContent = msg; });
      });
    });

    function wireLink(attr, reset) {
      $all("[" + attr + "]", tbody).forEach(function (btn) {
        btn.addEventListener("click", async function () {
          if (reset && !confirm("Create a NEW link with a fresh set of downloads? The customer's old link will stop working.")) return;
          btn.disabled = true; statusEl.textContent = "Creating link\u2026";
          var r = await invokeFn("resend-delivery", { order_id: btn.getAttribute(attr), send_email: false, reset: reset });
          btn.disabled = false;
          if (!r.ok || !r.downloads || !r.downloads.length) { statusEl.textContent = r.error || "No file has been uploaded for this order yet (see Book Files)."; return; }
          var text = r.downloads.map(function (d) { return d.title + ": " + linkFor(d); }).join("\n");
          copyText(text, function () { statusEl.textContent = (reset ? "New link copied. " : "Link copied. ") + "It allows a limited number of downloads and works for 7 days \u2014 paste it to the customer."; });
        });
      });
    }
    wireLink("data-link-order", false);
    wireLink("data-newlink-order", true);

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
    { key: "public_role_author_img", label: "Author picture", type: "image", accept: "image/jpeg,image/png,image/webp" },
    { key: "public_role_speaker_img", label: "Speaker picture", type: "image", accept: "image/jpeg,image/png,image/webp" },
    { key: "public_role_advisor_img", label: "Business Advisor picture", type: "image", accept: "image/jpeg,image/png,image/webp" },
    { key: "public_role_entrepreneur_img", label: "Entrepreneur picture", type: "image", accept: "image/jpeg,image/png,image/webp" },
    { key: "public_role_thinker_img", label: "Thinker picture", type: "image", accept: "image/jpeg,image/png,image/webp" },
    { key: "public_speak_img", label: "\u201cBring Me Into the Room\u201d picture", type: "image", accept: "image/jpeg,image/png,image/webp" },
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
    var heroFields = imageFields.filter(function (f) { return /^hero_/.test(f.key); });
    var pictureFields = imageFields.filter(function (f) { return /^public_/.test(f.key); });
    var textFields = SETTINGS_FIELDS.filter(function (f) { return f.type !== "image"; });

    form.innerHTML =
      '<h3 style="margin:0 0 0.25rem;font-size:1rem;">Homepage background video</h3>' +
      '<p class="field-hint" style="margin:0 0 0.75rem;">Plays silently behind the welcome text. Use a short looping clip (10\u201320 seconds) compressed to under 10 MB; free Supabase storage allows up to 50 MB per file. Leave it empty to use the file at assets/video/hero.mp4 instead.</p>' +
      heroFields.map(function (f) { return renderField(f, current); }).join("") +
      '<h3 style="margin:1.5rem 0 0.25rem;font-size:1rem;">Homepage pictures</h3>' +
      '<p class="field-hint" style="margin:0 0 0.75rem;">Shown in \u201cWhat I Do\u201d (five role pictures) and \u201cBring Me Into the Room\u201d. Role pictures: portrait, about 800 \u00d7 1000 px. \u201cBring Me Into the Room\u201d picture: square, about 1000 \u00d7 1000 px. JPG, PNG or WebP, under 5 MB. Leave a box empty to use the file in assets/images instead.</p>' +
      pictureFields.map(function (f) { return renderField(f, current); }).join("") +
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
        if (/^public_/.test(f.key)) {
          if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { uploadStatus.textContent = "Please choose a JPG, PNG or WebP picture."; fileInput.value = ""; return; }
          if (file.size > 5 * 1024 * 1024) { uploadStatus.textContent = "That picture is over 5 MB \u2014 please compress it first."; fileInput.value = ""; return; }
        }
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
    $("#mfa-form").addEventListener("submit", handleMfa);
    $("#mfa-cancel").addEventListener("click", handleLogout);
    initNav();
    checkSession();
  });
})();
