# Brand, README and assets

The README explains the product direction, current evidence and next useful action. Product goals stay labeled as planned until implementation and acceptance evidence exist. Maxi selected blue and red as the principal brand colors on 2026-11-05.

## Visual identity

Use a dark navy canvas, generous spacing and a split blue/red M. Blue anchors the identity; red adds emphasis. Keep both colors visible without using a gradient for text. This is the repository identity, not a decision about the future application's component framework.

| Token | Value | Use |
|---|---|---|
| Blue | `#2563EB` | Primary brand accent, marks and strokes |
| Red | `#EF4444` | Secondary brand accent, marks and strokes |
| Navy | `#080F20` | Artwork background |
| White | `#F8FAFC` | Headings on navy |
| Body | `#B9C7DE` | Supporting text on navy |
| Muted | `#8CA0BD` | Labels on navy |
| Red text | `#B91C1C` | Small red text on white or a badge with white text |

Use Segoe UI with Arial and sans-serif fallbacks in SVG text. All explanatory content also appears as ordinary README text. Color never carries a status on its own. Brand red is an accent: it does not meet 4.5:1 against white for small text. Check contrast against the actual composed background when adding text or gradients.

## Asset inventory

All artwork is original MaexSocial vector work, authored for this repository and covered by its [license](../LICENSE). There are no third-party logos, screenshots or remote resources embedded in the assets.

| Asset | Size | Purpose |
|---|---|---|
| [Logo mark](../.github/assets/logo-mark.svg) | 128 × 128 | Compact identity on its own navy tile |
| [Wordmark](../.github/assets/logo-wordmark.svg) | 580 × 110 | Name and mark on navy |
| [README banner](../.github/assets/banner.svg) | 1280 × 560 | Brand introduction and clearly labeled concept art |
| [Workflow](../.github/assets/flow.svg) | 1200 × 320 | Planned facts → create → publish → learn sequence |
| [Social preview source](../.github/assets/social-preview.svg) | 1280 × 640 | Editable repository-sharing artwork |
| [Social preview PNG](../.github/assets/social-preview.png) | 1280 × 640 | Raster export ready for repository settings |

Keep SVGs self-contained with a viewBox, title, description and accessible image label. README image references need meaningful alternative text. The flow's numbered text equivalent preserves its meaning on narrow screens. Keep the mark's proportions, colors and background intact when reusing it.

The social-preview files are prepared assets. A settings upload has not been performed; adding a file alone does not change GitHub's repository social preview.

## README structure and references

The sequence is brand → purpose and current stage → planned capabilities → workflow → gates → evidence → getting started → documentation → contribution and license. Use only real CI badges and dated evidence; do not add invented adoption counts, performance claims or application screenshots.

Layout references inspected on 2026-11-05 were [Supabase](https://github.com/supabase/supabase) for clear product/docs navigation, [n8n](https://github.com/n8n-io/n8n) for a compact introduction and useful entry points, and [Immich](https://github.com/immich-app/immich) for readable documentation links and capability presentation. Maex-Voice-Agent remains the workflow reference. These are structural references; their text, visual assets and product claims are not reused.

## Verification and maintenance

Before merging asset changes, parse every SVG, inspect the actual rendered artwork and review the README at desktop and narrow widths. Verify local images as well as Markdown links. Check that navy artwork remains legible within light and dark page surroundings. Keep PNG exports synchronized with their SVG source.

Update README and status when a gate passes. Add real product screenshots only after the application produces them. Store temporary rendering files in ignored `work/`. Record verification results in the change's PR.
