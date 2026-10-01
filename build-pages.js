const fs = require("fs");
const path = require("path");

const BASE = "https://www.evansgyakye.com";
const OUT = "/home/claude/evans-site";

const FONT_LINKS = `  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap">`;

const NAV_ITEMS = [
  { label: "About", href: "/about.html" },
  { label: "Books", href: "/books.html" },
  { label: "Think", href: "/think.html" },
  { label: "Speak", href: "/speak.html" },
  { label: "Advisory", href: "/advisory.html" },
  { label: "Projects", href: "/projects.html" },
  { label: "Contact", href: "/contact.html" },
];

function header(activeHref) {
  const links = NAV_ITEMS.map((item) => {
    const current = item.href === activeHref ? ' aria-current="page"' : "";
    return `        <li><a href="${item.href}"${current}>${item.label}</a></li>`;
  }).join("\n");
  return `  <header class="site-header">
    <nav class="nav container" aria-label="Primary">
      <a class="brand" href="/">Evans Gyakye</a>
      <button class="nav-toggle" aria-expanded="false" aria-controls="primary-nav">Menu</button>
      <ul class="nav-links" id="primary-nav">
${links}
      </ul>
    </nav>
  </header>`;
}

function footer() {
  return `  <footer class="site-footer">
    <div class="container footer-grid">
      <div>
        <p style="margin:0 0 0.5rem; font-family: var(--font-serif); font-size:1.1rem; color:var(--ivory);">Evans Gyakye</p>
        <p style="margin:0;">Author &middot; Business Strategist &middot; Entrepreneur &middot; Advisor &middot; Speaker</p>
      </div>
      <nav aria-label="Footer">
        <ul class="footer-nav">
${NAV_ITEMS.map((i) => `          <li><a href="${i.href}">${i.label}</a></li>`).join("\n")}
        </ul>
      </nav>
    </div>
    <div class="container footer-bottom">
      &copy; <span id="year"></span> Evans Gyakye. All rights reserved.
    </div>
  </footer>

  <script>document.getElementById("year").textContent = new Date().getFullYear();</script>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="/assets/js/supabase-client.js"></script>
  <script src="/assets/js/data.js"></script>
  <script src="/assets/js/main.js"></script>`;
}

function breadcrumbs(trail) {
  // trail: [{label, href}] last item current page (no href)
  const items = trail
    .map((t, i) => {
      const isLast = i === trail.length - 1;
      return isLast
        ? `<li aria-current="page">${t.label}</li>`
        : `<li><a href="${t.href}">${t.label}</a></li>`;
    })
    .join("\n          ");
  return `    <nav class="breadcrumbs container" aria-label="Breadcrumb">
      <ol>
          ${items}
      </ol>
    </nav>`;
}

function breadcrumbJsonLd(trail) {
  const itemListElement = trail.map((t, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: t.label,
    item: t.href ? `${BASE}${t.href}` : undefined,
  }));
  return JSON.stringify(
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement },
    null,
    2
  );
}

function page({ slug, title, description, activeHref, trail, extraJsonLd, bodyHtml, robots, extraScript }) {
  const canonical = `${BASE}${activeHref}`;
  const jsonLdBlocks = [breadcrumbJsonLd(trail)];
  if (extraJsonLd) jsonLdBlocks.push(JSON.stringify(extraJsonLd, null, 2));

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <link rel="canonical" href="${canonical}">
  ${robots ? `<meta name="robots" content="${robots}">\n  ` : ""}<meta property="og:type" content="website">
  <meta property="og:site_name" content="Evans Gyakye">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${BASE}/assets/images/og-cover.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${BASE}/assets/images/og-cover.jpg">

  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="alternate icon" href="/favicon.ico">
  <link rel="apple-touch-icon" href="/assets/images/apple-touch-icon.png">
  <meta name="theme-color" content="#111111">

  <link rel="stylesheet" href="/assets/css/style.css">
${FONT_LINKS}
${jsonLdBlocks.map((b) => `  <script type="application/ld+json">\n${b}\n  </script>`).join("\n")}
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>

${header(activeHref)}
${breadcrumbs(trail)}

  <main id="main">
${bodyHtml}
  </main>

${footer()}
${extraScript ? `  <script>\n${extraScript}\n  </script>\n` : ""}</body>
</html>
`;
  fs.writeFileSync(path.join(OUT, slug), html);
  console.log("wrote", slug);
}

/* ===================== ABOUT ===================== */
page({
  slug: "about.html",
  title: "About Evans Gyakye — Author, Strategist & Speaker",
  description: "The story, vision, mission and values behind Evans Gyakye — author, business strategist, speaker and entrepreneur.",
  activeHref: "/about.html",
  trail: [{ label: "Home", href: "/" }, { label: "About" }],
  extraJsonLd: {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: { "@id": `${BASE}/#person` },
  },
  bodyHtml: `    <section class="page-header">
      <div class="container">
        <span class="section-label">The Man Behind the Ideas</span>
        <h1>About Evans Gyakye</h1>
        <p class="lede">Author, business strategist, speaker and entrepreneur.</p>
      </div>
    </section>

    <section aria-labelledby="story-heading">
      <div class="container" style="max-width:760px;">
        <h2 id="story-heading" class="visually-hidden">My story</h2>
        <p>
          I have a curious mind, a restless imagination, and a soft spot for ideas that refuse
          to leave me alone. I read to discover, write to make sense of things, lead to make
          things happen, and build because some ideas are far too exciting to remain in a
          notebook.
        </p>
        <p>
          My world sits at the intersection of ideas and action, personal growth and purposeful
          work, big questions and practical solutions. I enjoy exploring what people are capable
          of becoming, what businesses can grow into, and what becomes possible when we dare to
          think beyond the familiar.
        </p>
        <p>
          Through my books, business advisory, speaking, and entrepreneurial ventures, I turn
          curiosity into conversations, conversations into ideas, and ideas into work that
          matters. I believe in challenging perspectives, discovering potential, and building
          things that make a difference.
        </p>
      </div>
    </section>

    <section aria-labelledby="vision-heading">
      <div class="container grid grid-2">
        <div class="card">
          <h3 id="vision-heading">My Vision</h3>
          <p>To become a leading African voice with global influence in transformational thinking, leadership, personal development, business, and purposeful living.</p>
        </div>
        <div class="card">
          <h3>My Mission</h3>
          <p>To help people think better, discover their potential, and turn ideas into purposeful action.</p>
        </div>
      </div>
    </section>

    <section aria-labelledby="values-heading">
      <div class="container">
        <div class="section-head">
          <span class="section-label">What I Stand On</span>
          <h2 id="values-heading">My Values</h2>
        </div>
        <div class="grid grid-3">
          <div class="card"><h3>Spirituality</h3><p>I want my life to remain anchored in God, conscious that the blessings and influence entrusted to me come with accountability to Him.</p></div>
          <div class="card"><h3>Family</h3><p>Family is where I draw strength, find rest, and have the freedom to love without performance.</p></div>
          <div class="card"><h3>Happiness</h3><p>I choose to find reasons to be happy and enjoy the life I am building rather than measuring it against someone else's.</p></div>
          <div class="card"><h3>Peace</h3><p>I want to be able to sleep at night knowing I did what was right, at peace with my Maker and myself.</p></div>
          <div class="card"><h3>Love</h3><p>I try to show up for people when life is difficult, not only when everything is going well.</p></div>
          <div class="card"><h3>Knowledge</h3><p>I know enough to know that I do not know enough — so I read, observe, listen, ask questions, and keep learning.</p></div>
          <div class="card"><h3>Humanity</h3><p>I never want achievement to make me forget the value of a human life. How I treat people matters to me.</p></div>
          <div class="card"><h3>Excellence</h3><p>I am fascinated by progress. Even the smallest improvement counts — I expect myself to keep getting better.</p></div>
          <div class="card"><h3>Respect</h3><p>I try to treat people with respect regardless of their position, status, or what they can do for me.</p></div>
          <div class="card"><h3>Prosperity &amp; Wealth</h3><p>I want to create wealth because I believe resources can be a force for good and greater capacity to help others.</p></div>
          <div class="card"><h3>Hard Work</h3><p>Storms do not respond to wishes. I believe in putting my mind, energy, and effort behind the things I want to achieve.</p></div>
          <div class="card"><h3>Rest</h3><p>My body has limits, and I have learned to respect them — sometimes the wisest thing is to rest and continue with a clearer mind.</p></div>
          <div class="card"><h3>Leadership</h3><p>Before we lead others, we must learn to lead ourselves — our choices, habits, character, and responses.</p></div>
          <div class="card"><h3>Purpose</h3><p>I want my life to be useful — to lift people, develop people, and leave people better than I found them.</p></div>
        </div>
      </div>
    </section>

    <section class="final-cta" aria-labelledby="about-cta-heading">
      <div class="container">
        <span class="section-label">Let's Begin With an Idea</span>
        <h2 id="about-cta-heading">What are you building?</h2>
        <p>Whether it's a speaking engagement, business advisory, a book, or a partnership — I'd be glad to hear about it.</p>
        <div class="btn-group" style="justify-content:center;">
          <a class="btn btn-primary" href="/contact.html">Start a Conversation</a>
        </div>
      </div>
    </section>
`,
});

/* ===================== BOOKS ===================== */
page({
  slug: "books.html",
  title: "Books by Evans Gyakye — 27 Thoughts of a Transformer",
  description: "Explore books by Evans Gyakye, including 27 Thoughts of a Transformer — available on this site, Amazon and Selar.",
  activeHref: "/books.html",
  trail: [{ label: "Home", href: "/" }, { label: "Books" }],
  bodyHtml: `    <section class="page-header">
      <div class="container">
        <span class="section-label">Books That Make You Think</span>
        <h1>Ideas worth spending time with</h1>
        <p class="lede">Each book is available directly on this site, on Amazon, and on Selar.</p>
      </div>
    </section>

    <section aria-labelledby="book-27-heading" id="27-thoughts">
      <div class="container">
        <article class="book-feature">
          <div class="book-cover-slot" aria-hidden="true">Book cover to be added</div>
          <div>
            <h2 id="book-27-heading" itemprop="name">27 Thoughts of a Transformer</h2>
            <p class="book-byline">By Evans Gyakye</p>
            <p>
              You can copy a person's actions without understanding the thinking that produced
              them. In this book, I invite readers to look beyond what transformers — mentors,
              leaders, innovators, and people who make meaningful impact — do, and begin
              examining how they think.
            </p>
            <p>
              We often admire the results of great people and attempt to reproduce their
              actions. But actions are usually the visible expression of an invisible thought
              pattern. Mindsets fuel actions, and actions shaped by the right mindset are more
              likely to produce results that can be sustained. This book is more than a
              collection of lessons to apply — it is a mindset checkbook: a personal examination
              of the thoughts, beliefs, perspectives, and convictions that influence the way we
              live, lead, work, and pursue purpose.
            </p>
            <ul class="purchase-list">
              <li><a href="/contact.html?enquiry=books">Buy on this site</a></li>
              <li><a href="#" rel="nofollow noopener" target="_blank">Buy on Amazon</a></li>
              <li><a href="#" rel="nofollow noopener" target="_blank">Buy on Selar</a></li>
            </ul>
          </div>
        </article>
      </div>
    </section>

    <section aria-labelledby="more-books-heading">
      <div class="container">
        <div class="section-head">
          <span class="section-label">Coming Next</span>
          <h2 id="more-books-heading">More books, added as they're published</h2>
          <p>New titles will appear here as soon as they're ready — managed through the admin dashboard, no redesign required.</p>
        </div>
        <div data-extra-books></div>
      </div>
    </section>
`,
  extraScript: `if (window.siteRender) { window.siteRender.renderExtraBooks(); }`,
});

/* ===================== THINK (archive) ===================== */
const categories = [
  { slug: "build", name: "Build", desc: "Business, strategy, entrepreneurship, organisations, African enterprise." },
  { slug: "become", name: "Become", desc: "Personal development, potential, purpose, careers, transformation." },
  { slug: "lead", name: "Lead", desc: "Leadership, people, teams, influence, responsibility." },
  { slug: "think", name: "Think", desc: "Ideas, observations, questions, society, work, the future." },
  { slug: "believe", name: "Believe", desc: "Faith, spirituality, values, character, meaning, and the intersection of faith with life and work." },
];

page({
  slug: "think.html",
  title: "Think — The Thinking Room | Evans Gyakye",
  description: "Ideas worth turning over. Articles from Evans Gyakye on Build, Become, Lead, Think and Believe.",
  activeHref: "/think.html",
  trail: [{ label: "Home", href: "/" }, { label: "Think" }],
  extraJsonLd: { "@context": "https://schema.org", "@type": "CollectionPage", name: "The Thinking Room" },
  bodyHtml: `    <section class="page-header">
      <div class="container">
        <span class="section-label">The Thinking Room</span>
        <h1>Ideas worth turning over</h1>
        <p class="lede">
          Questions worth asking, perspectives worth challenging. From business and leadership
          to personal development, entrepreneurship, life, Africa, books, and the occasional
          thought that refuses to leave me alone.
        </p>
      </div>
    </section>

    <section aria-labelledby="archive-heading">
      <div class="container">
        <h2 id="archive-heading" class="visually-hidden">Article archive</h2>
        <ul class="filter-tabs" role="tablist" aria-label="Filter articles by category">
          <li role="presentation"><button type="button" role="tab" aria-pressed="true" data-category="all">All</button></li>
${categories.map((c) => `          <li role="presentation"><button type="button" role="tab" aria-pressed="false" data-category="${c.slug}">${c.name}</button></li>`).join("\n")}
        </ul>

        <div data-articles-list></div>
        <div class="empty-state" role="status" data-articles-empty>
          <p><strong>New articles are on their way.</strong></p>
          <p>Once published from the admin dashboard, they'll appear here — organised under Build, Become, Lead, Think and Believe.</p>
        </div>
      </div>
    </section>

    <section aria-labelledby="categories-heading">
      <div class="container">
        <div class="section-head">
          <span class="section-label">Categories</span>
          <h2 id="categories-heading">Five ways to think out loud</h2>
        </div>
        <div class="grid grid-5">
${categories
  .map(
    (c, i) => `          <div class="card">
            <span class="card-index">0${i + 1} — ${c.name}</span>
            <h3>${c.name}</h3>
            <p>${c.desc}</p>
          </div>`
  )
  .join("\n")}
        </div>
      </div>
    </section>
`,
  extraScript: `if (window.siteRender) {
      window.siteRender.renderArticles("all");
      document.querySelectorAll(".filter-tabs [data-category]").forEach(function (btn) {
        btn.addEventListener("click", function () { window.siteRender.renderArticles(btn.getAttribute("data-category")); });
      });
      var allTab = document.querySelector('.filter-tabs [role="tab"]:not([data-category])');
      if (allTab) allTab.addEventListener("click", function () { window.siteRender.renderArticles("all"); });
    }`,
});
{
  const html = `<!DOCTYPE html>
<!--
  DEV TEMPLATE — not a live content page.
  This is the markup pattern the CMS/admin dashboard should render into for
  each individual Think article. Replace every {{token}} with real data from
  the Articles content type (title, category, image, body, date, tags).
  Delete this comment block once the templating is wired to the dashboard.
-->
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{article.title}} — Evans Gyakye</title>
  <meta name="description" content="{{article.excerpt}}">
  <link rel="canonical" href="${BASE}/think/{{article.slug}}.html">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Evans Gyakye">
  <meta property="og:title" content="{{article.title}}">
  <meta property="og:description" content="{{article.excerpt}}">
  <meta property="og:url" content="${BASE}/think/{{article.slug}}.html">
  <meta property="og:image" content="{{article.socialImage}}">
  <meta name="twitter:card" content="summary_large_image">

  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/assets/css/style.css">
${FONT_LINKS}
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "{{article.title}}",
    "description": "{{article.excerpt}}",
    "image": "{{article.socialImage}}",
    "datePublished": "{{article.publishedDate}}",
    "dateModified": "{{article.modifiedDate}}",
    "author": { "@id": "${BASE}/#person" },
    "publisher": { "@id": "${BASE}/#person" },
    "mainEntityOfPage": "${BASE}/think/{{article.slug}}.html"
  }
  </script>
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
${header("/think.html")}
    <nav class="breadcrumbs container" aria-label="Breadcrumb">
      <ol>
          <li><a href="/">Home</a></li>
          <li><a href="/think.html">Think</a></li>
          <li><a href="/think.html?category={{article.category}}">{{article.categoryLabel}}</a></li>
          <li aria-current="page">{{article.title}}</li>
      </ol>
    </nav>

  <main id="main">
    <article>
      <header class="page-header">
        <span class="section-label">{{article.categoryLabel}}</span>
        <h1>{{article.title}}</h1>
        <p class="lede">{{article.excerpt}}</p>
        <p class="field-hint">Published {{article.publishedDateDisplay}}</p>
      </header>
      <section class="container" style="max-width:720px;">
        {{article.bodyHtml}}
      </section>
    </article>
  </main>
${footer()}
</body>
</html>
`;
  fs.writeFileSync(path.join(OUT, "post-template.html"), html);
  console.log("wrote post-template.html (dev reference)");
}

/* ===================== SPEAK ===================== */
const speakingTopics = [
  "Leadership & Transformation",
  "Business Strategy",
  "Entrepreneurship",
  "Personal Growth",
  "Purpose & Performance",
  "Innovation & Opportunity",
  "Future of Work",
  "African Business & Enterprise",
];

page({
  slug: "speak.html",
  title: "Invite Evans Gyakye to Speak — Keynotes & Leadership Conversations",
  description: "Book Evans Gyakye to speak on leadership, business strategy, entrepreneurship and personal growth at your conference, event or organisation.",
  activeHref: "/speak.html",
  trail: [{ label: "Home", href: "/" }, { label: "Speak" }],
  extraJsonLd: {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: "Speaking engagement",
    provider: { "@id": `${BASE}/#person` },
  },
  bodyHtml: `    <section class="page-header">
      <div class="container">
        <span class="section-label">Bring Me Into the Room</span>
        <h1>Ideas worth sharing, conversations worth having</h1>
        <p class="lede">
          I enjoy conversations that stretch our thinking and create room for new
          possibilities. My speaking draws from my personal and professional journey, my
          writing, my entrepreneurial interests, and my ongoing exploration of how people and
          organisations grow.
        </p>
      </div>
    </section>

    <section aria-labelledby="topics-heading">
      <div class="container">
        <div class="section-head">
          <span class="section-label">Speaking Topics</span>
          <h2 id="topics-heading">What I speak about</h2>
        </div>
        <div class="grid grid-3">
${speakingTopics.map((t) => `          <div class="card"><h3>${t}</h3></div>`).join("\n")}
        </div>
      </div>
    </section>

    <section aria-labelledby="audiences-heading">
      <div class="container">
        <div class="section-head">
          <span class="section-label">Where I Speak</span>
          <h2 id="audiences-heading">Audiences and settings</h2>
          <p>
            Conferences, corporate events, universities, leadership programmes, professional
            communities, churches and other gatherings where thoughtful conversations can make
            a difference and inspire growth.
          </p>
        </div>
      </div>
    </section>

    <section aria-labelledby="speak-testimonials-heading">
      <div class="container" data-testimonials-mount>
        <div class="section-head">
          <span class="section-label">In Their Words</span>
          <h2 id="speak-testimonials-heading">Testimonials &amp; media clips</h2>
        </div>
        <div class="empty-state" role="status">
          <p><strong>Testimonials and media clips are on their way.</strong></p>
          <p>These will appear here once added through the admin dashboard.</p>
        </div>
      </div>
    </section>

    <section class="final-cta" aria-labelledby="speak-cta-heading">
      <div class="container">
        <span class="section-label">Let's Begin With an Idea</span>
        <h2 id="speak-cta-heading">Invite Evans to speak</h2>
        <p>Tell me about your event, audience and the outcome you're hoping for.</p>
        <div class="btn-group" style="justify-content:center;">
          <a class="btn btn-primary" href="/contact.html?enquiry=speaking">Invite Me to Speak</a>
        </div>
      </div>
    </section>
`,
  extraScript: `if (window.siteRender) { window.siteRender.renderTestimonials("speak", "[data-testimonials-mount]"); }`,
});

/* ===================== ADVISORY ===================== */
page({
  slug: "advisory.html",
  title: "Business Advisory with Evans Gyakye — Strategy, Growth & Market Entry",
  description: "Business advisory services from Evans Gyakye: strategy, business development, market entry and growth for entrepreneurs, founders and organisations.",
  activeHref: "/advisory.html",
  trail: [{ label: "Home", href: "/" }, { label: "Advisory" }],
  extraJsonLd: {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: "Business advisory",
    provider: { "@id": `${BASE}/#person` },
  },
  bodyHtml: `    <section class="page-header">
      <div class="container">
        <span class="section-label">Business Advisory</span>
        <h1>Good ideas need good strategy</h1>
        <p class="lede">
          A business idea can be exciting. An opportunity can look promising. But what happens
          next requires careful thought: the market, the problem you're solving, your
          resources, your relationships, your priorities, and what it takes to move from an
          idea to an organised course of action. My professional experience across trade,
          business development, operations, and venture-building informs my approach.
        </p>
      </div>
    </section>

    <section aria-labelledby="pillars-heading">
      <div class="container">
        <div class="section-head">
          <span class="section-label">How I Can Contribute</span>
          <h2 id="pillars-heading">Advisory pillars</h2>
        </div>
        <div class="grid grid-2">
          <div class="card"><h3>Business Strategy</h3><p>Clarifying direction, priorities, positioning, and the choices that influence where a business goes next.</p></div>
          <div class="card"><h3>Business Development</h3><p>Exploring opportunities, developing commercial relationships, and identifying ways to expand business activity.</p></div>
          <div class="card"><h3>Market Entry &amp; Opportunities</h3><p>Examining market contexts, trade opportunities, potential partnerships, and considerations involved in entering new markets.</p></div>
          <div class="card"><h3>Growth &amp; Transformation</h3><p>Helping businesses think through growth pathways, operational priorities, and opportunities to improve how they work.</p></div>
        </div>
      </div>
    </section>

    <section aria-labelledby="who-heading">
      <div class="container">
        <div class="section-head">
          <span class="section-label">Who I Work With</span>
          <h2 id="who-heading">Entrepreneurs, founders, and growing businesses</h2>
          <p>I welcome conversations with entrepreneurs, founders, small and growing businesses, and organisations looking for strategic thinking or business development support. Every business has its own circumstances — my starting point is to understand yours.</p>
        </div>
      </div>
    </section>

    <section aria-labelledby="process-heading">
      <div class="container">
        <div class="section-head">
          <span class="section-label">How We Can Work Together</span>
          <h2 id="process-heading">A simple, honest process</h2>
        </div>
        <ol class="step-list">
          <li><span class="step-num" aria-hidden="true">1</span><div><h3>Start with a conversation</h3><p>Tell me about your business, your ambitions, and the challenge or opportunity you are considering.</p></div></li>
          <li><span class="step-num" aria-hidden="true">2</span><div><h3>Understand the situation</h3><p>We examine the relevant context, clarify the questions, and identify what needs attention.</p></div></li>
          <li><span class="step-num" aria-hidden="true">3</span><div><h3>Explore a practical way forward</h3><p>We consider strategic options and develop an approach suited to the objectives and scope of the engagement.</p></div></li>
          <li><span class="step-num" aria-hidden="true">4</span><div><h3>Agree on the next steps</h3><p>Where appropriate, we define the work, deliverables, responsibilities, and any follow-up support.</p></div></li>
        </ol>
      </div>
    </section>

    <section class="final-cta" aria-labelledby="advisory-cta-heading">
      <div class="container">
        <span class="section-label">Have a Business Idea or Challenge on Your Mind?</span>
        <h2 id="advisory-cta-heading">Let's discuss what you're building</h2>
        <div class="btn-group" style="justify-content:center;">
          <a class="btn btn-primary" href="/contact.html?enquiry=advisory">Discuss Your Business</a>
        </div>
      </div>
    </section>
`,
});

/* ===================== PROJECTS ===================== */
page({
  slug: "projects.html",
  title: "Projects & Ventures by Evans Gyakye — Success Factors & Yammall",
  description: "Real ventures Evans Gyakye has built, including Success Factors, a personal development movement, and Yammall, an agricultural trade venture.",
  activeHref: "/projects.html",
  trail: [{ label: "Home", href: "/" }, { label: "Projects" }],
  bodyHtml: `    <section class="page-header">
      <div class="container">
        <span class="section-label">Building Beyond the Desk</span>
        <h1>Success stories in progress</h1>
      </div>
    </section>

    <section aria-labelledby="projects-grid-heading">
      <div class="container">
        <h2 id="projects-grid-heading" class="visually-hidden">Projects</h2>
        <div class="grid grid-2">
          <article class="card" id="success-factors">
            <h3>Success Factors</h3>
            <p>
              Discover your potential. Activate your gifts. Pursue your purpose. Success
              Factors is a personal development movement centred on potential discovery, gifts
              activation, and the pursuit of purpose.
            </p>
          </article>
          <article class="card" id="yammall">
            <h3>Yammall</h3>
            <p>
              Exploring opportunities in agricultural trade. Yammall is connected to my
              interests in business development, agricultural enterprise, and market
              opportunities — reflecting how products, markets, partnerships, and commercial
              planning come together in building business opportunities.
            </p>
          </article>
        </div>
        <div class="grid grid-2" data-extra-projects style="margin-top:var(--gap);"></div>
      </div>
    </section>
`,
  extraScript: `if (window.siteRender) { window.siteRender.renderExtraProjects(); }`,
});

/* ===================== CONTACT ===================== */
page({
  slug: "contact.html",
  title: "Contact Evans Gyakye — Speaking, Advisory, Books & Media Enquiries",
  description: "Start a conversation with Evans Gyakye about a speaking engagement, business advisory, a book, a media opportunity, or a partnership.",
  activeHref: "/contact.html",
  trail: [{ label: "Home", href: "/" }, { label: "Contact" }],
  extraJsonLd: {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    about: { "@id": `${BASE}/#person` },
  },
  bodyHtml: `    <section class="page-header">
      <div class="container">
        <span class="section-label">Let's Connect</span>
        <h1>Start a conversation</h1>
        <p class="lede">
          Whether you are reaching out about a speaking engagement, business advisory, a book,
          a media opportunity, or a potential partnership, I welcome thoughtful conversations.
          Tell me a little about yourself, what you are working on, and what you would like to
          discuss.
        </p>
      </div>
    </section>

    <section aria-labelledby="form-heading">
      <div class="container">
        <h2 id="form-heading" class="visually-hidden">Contact form</h2>
        <form class="contact-form" data-contact-form novalidate>
          <fieldset>
            <legend>Enquiry type</legend>
            <div class="radio-grid">
              <label><input type="radio" name="enquiryType" value="speaking"> Speaking invitation</label>
              <label><input type="radio" name="enquiryType" value="advisory"> Business advisory</label>
              <label><input type="radio" name="enquiryType" value="books"> Books</label>
              <label><input type="radio" name="enquiryType" value="media"> Media</label>
              <label><input type="radio" name="enquiryType" value="partnership"> Partnership</label>
              <label><input type="radio" name="enquiryType" value="general"> General enquiry</label>
            </div>
          </fieldset>

          <div class="field">
            <label for="contact-name">Your name</label>
            <input id="contact-name" name="name" type="text" autocomplete="name" required>
          </div>
          <div class="field">
            <label for="contact-email">Email address</label>
            <input id="contact-email" name="email" type="email" autocomplete="email" required>
          </div>
          <div class="field">
            <label for="contact-org">Organisation (optional)</label>
            <input id="contact-org" name="organisation" type="text" autocomplete="organization">
          </div>
          <div class="field">
            <label for="contact-message">Your message</label>
            <textarea id="contact-message" name="message" required></textarea>
          </div>

          <button class="btn btn-primary" type="submit">Send Message</button>
          <p data-form-status role="status" aria-live="polite" style="margin-top:0.9rem; font-size:0.9rem; color:var(--gold-deep);"></p>
        </form>
      </div>
    </section>
`,
});

console.log("done");
