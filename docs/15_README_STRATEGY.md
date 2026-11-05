# Brand, README and assets

The README explains the product direction, current evidence and next useful action. Product goals stay labeled as planned until implementation and acceptance evidence exist. On 2026-11-05 Maxi selected the exact **Deep Tech (Dark Mode)** palette below, replacing the initial blue/red shades. This is the approved color direction for repository artwork and the future application.

## Visual identity

Use a Midnight canvas, Dark Slate cards, generous spacing and a split Cyan-Electric/Warm Coral M. Cyan anchors the identity; coral adds emphasis. Keep both colors visible without using a gradient for text. The palette does not select a component framework or approve the full G2 application design.

| Token | Value | Use |
|---|---|---|
| Primary — Electric Blue / Cyan-Electric | `#00E5FF` | Primary actions, links on dark surfaces, marks and strokes |
| Accent — Coral Red / Warm Coral | `#FF5E5B` | Highlights, secondary emphasis and brand accents |
| Base — Midnight | `#0B0F19` | Page/artwork background and text/icons on filled accents |
| Surface — Dark Slate | `#161F30` | Cards and panels |
| Text — Off-White | `#F8FAFC` | Primary text on Base and Surface |

Use these semantic names when implementing the approved application design:

```css
--color-primary: #00E5FF;
--color-accent: #FF5E5B;
--color-base: #0B0F19;
--color-surface: #161F30;
--color-text: #F8FAFC;
```

These are design specifications; no application theme or component library is implemented yet. Current SVGs are self-contained and use the same five colors directly. Supporting artwork text uses Off-White at 78% opacity, labels at 64%; decorative lines and glows use reduced opacity. Recheck composed colors if the background or opacity changes. GitHub's own light/dark page theme is controlled by GitHub.

Use Segoe UI with Arial and sans-serif fallbacks in SVG text. All explanatory content also appears as ordinary README text. Color never carries a status on its own. Coral is a brand accent, not automatically the error state; future error/success/warning treatments need text or icons and separate semantic design.

### Contrast and future controls

Calculated solid sRGB pairs on 2026-11-05, displayed to two decimals:

| Foreground / background | Contrast | Intended use |
|---|---|---|
| Text / Base | 18.30:1 | Page text |
| Text / Surface | 15.77:1 | Card text |
| Primary / Surface | 10.73:1 | Links and emphasis on dark panels |
| Accent / Surface | 5.50:1 | Coral text on dark panels |
| Base / Primary | 12.45:1 | Text/icons on cyan-filled elements |
| Base / Accent | 6.39:1 | Text/icons on coral-filled elements |

Use Midnight text/icons on filled cyan or coral elements. Off-White on Primary is only 1.47:1 and on Accent 2.87:1, so those combinations are unsuitable for readable labels. Surface against Base is only 1.16:1: use a sufficiently contrasting boundary or another identifying cue where users must recognize a control. Focus indicators, hover states and validation states must be checked on their actual adjacent colors during implementation. Do not rely on a low-opacity decorative card stroke as a control boundary.

README metadata badges use Base/Surface backgrounds because Shields renders their text in white. The live CI badge retains its provider-generated status colors.

Normal text requires at least 4.5:1; meaningful control indicators require 3:1 against adjacent colors under the relevant WCAG criteria. These pair calculations do not establish application accessibility. References: [WCAG text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [WCAG non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).

## Asset inventory

All artwork is original MaexSocial vector work, authored for this repository and covered by its [license](../LICENSE). There are no third-party logos, screenshots or remote resources embedded in the assets.

| Asset | Size | Purpose |
|---|---|---|
| [Logo mark](../.github/assets/logo-mark.svg) | 128 × 128 | Compact identity on its own Midnight tile |
| [Wordmark](../.github/assets/logo-wordmark.svg) | 580 × 110 | Name and mark on Midnight |
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

Before merging asset changes, parse every SVG, inspect the actual rendered artwork and review the README at desktop and narrow widths. Verify local images as well as Markdown links. Check that Midnight artwork remains legible within light and dark page surroundings. Keep PNG exports synchronized with their SVG source.

Update README and status when a gate passes. Add real product screenshots only after the application produces them. Store temporary rendering files in ignored `work/`. Record verification results in the change's PR.
