export function renderSignedOut(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Signed out · MaexSocial</title>
  <style>
    :root {
      color-scheme: dark;
      --color-primary: #00E5FF;
      --color-accent: #FF5E5B;
      --color-base: #0B0F19;
      --color-surface: #161F30;
      --color-text: #F8FAFC;
      --color-muted: #C2CBD8;
      --color-line: #394659;
      --page-width: 74rem;
      --page-gutter: clamp(1.25rem, 4vw, 3.5rem);
      --font-body: system-ui, sans-serif;
      --font-label: ui-monospace, monospace;
      background: var(--color-base);
      color: var(--color-text);
      font: 1rem/1.6 var(--font-body);
    }
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; }
    :focus-visible { outline: 3px solid var(--color-accent); outline-offset: 5px; }
    .skip {
      position: absolute;
      z-index: 1;
      inset: 1rem auto auto var(--page-gutter);
      transform: translateY(calc(-100% - 2rem));
      border-radius: .35rem;
      padding: .65rem 1rem;
      color: var(--color-base);
      background: var(--color-primary);
      font-weight: 700;
    }
    .skip:focus { transform: none; }
    .site-header, .entry { padding-inline: var(--page-gutter); }
    .site-header { border-bottom: 1px solid var(--color-line); }
    .brand {
      display: flex;
      align-items: center;
      gap: .75rem;
      max-width: var(--page-width);
      margin: auto;
      padding-block: 1.15rem;
      font-size: 1.2rem;
      font-weight: 750;
      letter-spacing: -.04em;
    }
    .brand-mark { display: block; width: 2rem; height: 2rem; }
    .brand-mark path:first-child { stroke: var(--color-primary); }
    .brand-mark path:last-child { stroke: var(--color-accent); }
    .entry { padding-block: clamp(2.5rem, 8vw, 8rem); }
    .entry-grid { display: grid; gap: 2.25rem; max-width: var(--page-width); margin: auto; }
    .intro h1 {
      margin: 0;
      max-width: 15ch;
      font-size: clamp(2.75rem, 6.25vw, 5.35rem);
      font-weight: 800;
      line-height: .99;
      letter-spacing: -.052em;
      text-wrap: balance;
    }
    .intro h1 span { color: var(--color-primary); }
    .intro > p {
      max-width: 35ch;
      margin: 1.5rem 0 0;
      color: var(--color-muted);
      font-size: clamp(1rem, 1.7vw, 1.25rem);
    }
    .session {
      margin-top: clamp(1.75rem, 4vw, 3rem);
      padding: .15rem 0 .15rem 1rem;
      border-inline-start: 2px solid var(--color-accent);
    }
    .session h2 { margin: 0; font-size: 1rem; }
    .session p { margin: .2rem 0 0; color: var(--color-muted); }
    .example {
      position: relative;
      border: 1px solid var(--color-line);
      border-radius: 1.25rem;
      background: var(--color-surface);
      padding: clamp(1.25rem, 3.1vw, 2.5rem);
    }
    .example::before {
      position: absolute;
      inset: -1px auto auto clamp(1.25rem, 3.1vw, 2.5rem);
      width: 4rem;
      height: 2px;
      background: var(--color-primary);
      content: '';
    }
    .example-label, .draft-meta dt {
      font: 600 .8rem/1.35 var(--font-label);
      letter-spacing: .075em;
      text-transform: uppercase;
    }
    .example-label { margin: 0 0 .9rem; color: var(--color-primary); }
    .example h2 {
      max-width: 16ch;
      margin: 0;
      font-size: clamp(1.8rem, 3.3vw, 3rem);
      line-height: 1.05;
      letter-spacing: -.05em;
      text-wrap: balance;
    }
    .example-intro { margin: .8rem 0 1.6rem; color: var(--color-muted); }
    .example summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      min-height: 3rem;
      border-radius: .45rem;
      padding: .65rem .95rem;
      background: var(--color-primary);
      color: var(--color-base);
      font-weight: 750;
      cursor: pointer;
      list-style: none;
    }
    .example summary::-webkit-details-marker { display: none; }
    .example summary:hover { text-decoration: underline; text-underline-offset: .2em; }
    .chevron {
      flex: none;
      width: .6rem;
      height: .6rem;
      margin: -.2rem .15rem 0 0;
      border: solid currentColor;
      border-width: 0 2px 2px 0;
      transform: rotate(45deg);
    }
    details[open] .chevron { margin-top: .2rem; transform: rotate(225deg); }
    .draft-text {
      margin-top: 1rem;
      border-radius: .65rem;
      padding: 1rem;
      background: var(--color-base);
    }
    .draft-text h3 { margin: 0 0 .4rem; font-size: .9rem; color: var(--color-muted); }
    .draft-text p { margin: 0; }
    .draft-meta { margin: 1rem 0 0; }
    .draft-meta div {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: space-between;
      gap: .2rem 1rem;
      border-top: 1px solid var(--color-line);
      padding-block: .65rem;
    }
    .draft-meta div:last-child { padding-bottom: 0; }
    .draft-meta dt { color: var(--color-muted); }
    .draft-meta dd { margin: 0; }
    .draft-meta .review-state { color: var(--color-accent); font-weight: 650; }
    @media (min-width: 50rem) {
      .entry-grid {
        grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
        align-items: start;
        gap: clamp(2rem, 5vw, 5rem);
      }
      .example { margin-top: .5rem; }
    }
  </style>
</head>
<body>
  <a class="skip" href="#main">Skip to content</a>
  <header class="site-header">
    <div class="brand">
      <svg class="brand-mark" viewBox="0 0 80 80" fill="none" stroke-width="12"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M8 72V8l32 32"/><path d="M40 40L72 8v64"/>
      </svg>
      MaexSocial
    </div>
  </header>
  <main id="main" class="entry" tabindex="-1">
    <div class="entry-grid">
      <section class="intro" aria-labelledby="entry-heading">
        <h1 id="entry-heading">Good local posts <span>start with a draft.</span></h1>
        <p>See what a post says, where it would appear and whether it has been reviewed.</p>
        <div class="session">
          <h2>You are signed out</h2>
          <p>Customer sign-in is unavailable in this local preview.</p>
        </div>
      </section>
      <section class="example" aria-labelledby="example-heading">
        <p class="example-label">Example draft</p>
        <h2 id="example-heading">Saturday at the repair bench</h2>
        <p class="example-intro">A fictional bicycle shop shares its weekend repair hours.</p>
        <details>
          <summary>Inspect sample draft <span class="chevron" aria-hidden="true"></span></summary>
          <div class="draft-text">
            <h3>Post text</h3>
            <p>Our repair bench is open on Saturday from 10 am to 2 pm. Bring your bike by for a quick safety check before your next ride.</p>
          </div>
          <dl class="draft-meta">
            <div><dt>Location</dt><dd>Harbor &amp; Spoke · Riverside</dd></div>
            <div><dt>Channel</dt><dd>Google Business Profile</dd></div>
            <div><dt>Review status</dt><dd class="review-state">Awaiting review</dd></div>
          </dl>
        </details>
      </section>
    </div>
  </main>
</body>
</html>`;
}
