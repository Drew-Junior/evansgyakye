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
})();
