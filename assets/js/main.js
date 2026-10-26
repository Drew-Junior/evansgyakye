(function () {
  "use strict";

  var toggle = document.querySelector(".nav-toggle");
  var links = document.querySelector(".nav-links");

  if (toggle && links) {
    toggle.addEventListener("click", function () {
      var isOpen = links.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(isOpen));
    });

    links.addEventListener("click", function (event) {
      if (event.target.tagName === "A" && links.classList.contains("is-open")) {
        links.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  // Newsletter form: submits to Supabase when configured; otherwise shows
  // an honest "not yet wired up" message rather than a fake success.
  var newsletterForm = document.querySelector("[data-newsletter-form]");
  if (newsletterForm) {
    newsletterForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var status = newsletterForm.querySelector("[data-form-status]");
      var email = newsletterForm.querySelector("#newsletter-email").value;
      var name = newsletterForm.querySelector("#newsletter-name").value;
      if (window.siteData) {
        window.siteData.subscribeToNewsletter(name, email).then(function (result) {
          if (!status) return;
          status.textContent = result.ok
            ? "Thank you \u2014 you're on the list."
            : "Something went wrong \u2014 please try again shortly.";
        });
      } else if (status) {
        status.textContent = "Signup isn't connected yet \u2014 check back soon.";
      }
      newsletterForm.reset();
    });
  }

  // Contact form: submits to Supabase when configured; otherwise shows an
  // honest "not yet wired up" message rather than a fake success.
  var contactForm = document.querySelector("[data-contact-form]");
  if (contactForm) {
    contactForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var status = contactForm.querySelector("[data-form-status]");
      var payload = {
        enquiryType: (contactForm.querySelector('input[name="enquiryType"]:checked') || {}).value,
        name: contactForm.querySelector("#contact-name").value,
        email: contactForm.querySelector("#contact-email").value,
        organisation: contactForm.querySelector("#contact-org").value,
        message: contactForm.querySelector("#contact-message").value,
      };
      if (window.siteData) {
        window.siteData.submitContactForm(payload).then(function (result) {
          if (!status) return;
          status.textContent = result.ok
            ? "Thank you \u2014 your message has been received."
            : "Something went wrong \u2014 please try again shortly.";
        });
      } else if (status) {
        status.textContent = "This form isn't connected yet \u2014 please email directly for now.";
      }
      contactForm.reset();
    });

    // Pre-select enquiry type from a ?enquiry= query param (e.g. links from Speak/Advisory/Books pages).
    var params = new URLSearchParams(window.location.search);
    var enquiry = params.get("enquiry");
    if (enquiry) {
      var match = contactForm.querySelector('input[name="enquiryType"][value="' + enquiry + '"]');
      if (match) match.checked = true;
    }
  }

  // Think archive: category filter tabs (client-side only until articles exist).
  var tabs = document.querySelectorAll(".filter-tabs [role='tab']");
  if (tabs.length) {
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        tabs.forEach(function (t) { t.setAttribute("aria-pressed", "false"); });
        tab.setAttribute("aria-pressed", "true");
        // Article list will be filtered here once articles are wired up to the dashboard.
      });
    });
  }

  // Scroll-reveal: fade/slide in sections and cards as they enter the
  // viewport. Respects prefers-reduced-motion via the CSS rule in
  // style.css, and degrades gracefully if IntersectionObserver is missing.
  (function initScrollReveal() {
    var targets = document.querySelectorAll(
      "section .section-head, section .card, .book-feature, .quote-block, .page-header, .step-list li"
    );
    if (!targets.length) return;

    targets.forEach(function (el) { el.classList.add("reveal"); });

    if (!("IntersectionObserver" in window)) {
      targets.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );

    targets.forEach(function (el) { observer.observe(el); });
  })();

  // Page loader: hide once everything has finished loading. A minimum
  // display time avoids an ugly flash on fast connections.
  (function initPageLoader() {
    var loader = document.getElementById("page-loader");
    if (!loader) return;
    var minTime = 500;
    var start = Date.now();
    function hide() {
      var elapsed = Date.now() - start;
      var wait = Math.max(0, minTime - elapsed);
      setTimeout(function () {
        loader.classList.add("is-hidden");
        setTimeout(function () { loader.remove(); }, 450);
      }, wait);
    }
    if (document.readyState === "complete") hide();
    else window.addEventListener("load", hide);
  })();

  // Homepage background video. Plays silently on a loop. A video uploaded in
  // Dashboard -> Site Settings replaces the default file (assets/video/hero.mp4).
  (function initHeroVideo() {
    var video = document.querySelector("[data-hero-video]");
    if (!video) return;
    var toggle = document.querySelector("[data-hero-toggle]");

    function label() {
      if (!toggle) return;
      toggle.textContent = video.paused ? "Play video" : "Pause video";
      toggle.setAttribute("aria-label", video.paused ? "Play background video" : "Pause background video");
    }

    var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var saveData = navigator.connection && navigator.connection.saveData;
    if (reduceMotion || saveData) {
      video.removeAttribute("autoplay");
      video.pause();
    }

    video.addEventListener("loadeddata", function () { if (toggle) toggle.hidden = false; label(); });
    video.addEventListener("play", label);
    video.addEventListener("pause", label);
    if (toggle) {
      toggle.addEventListener("click", function () {
        if (video.paused) {
          var attempt = video.play();
          if (attempt && attempt.catch) attempt.catch(function () {});
        } else {
          video.pause();
        }
      });
    }

    if (window.siteData && window.siteData.fetchSettings) {
      window.siteData.fetchSettings(["hero_video_url", "hero_poster_url"]).then(function (s) {
        var ok = function (u) { return /^https?:\/\//i.test(u || "") || /^\/[^/]/.test(u || ""); };
        if (ok(s.hero_poster_url)) video.setAttribute("poster", s.hero_poster_url);
        if (ok(s.hero_video_url)) {
          while (video.firstChild) video.removeChild(video.firstChild);
          video.src = s.hero_video_url;
          video.load();
          if (!reduceMotion && !saveData) {
            var attempt = video.play();
            if (attempt && attempt.catch) attempt.catch(function () {});
          }
        }
      });
    }
  })();
})();
