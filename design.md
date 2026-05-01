# Design System Inspired by Wispr Flow

## 1. Visual Theme & Atmosphere

Wispr Flow lives in a world of **editorial calm with a handwritten edge**. The product is voice-to-text — fast, intimate, almost confessional — and the marketing site mirrors that personality by setting an enormous, classical serif against a cream-paper background, then letting hand-drawn elements (curved ribbons of speech, squiggly underlines, sticker-like callout pills, marker highlighters) wander across the page as if a thoughtful human were annotating a book. The result is software that markets itself like a *New Yorker* essay rather than a SaaS dashboard. Nothing is glassy, nothing glows, nothing is gradient-purple. The chrome is warm, paper-like, and confidently old-school.

If you remembered nothing else: **cream paper + serif giant + lavender CTA + tilted orange sticker = Wispr Flow.**

**Key Characteristics:**
- **Lumen Cream (#ffffeb)** as the default page background — never pure white; the warmth is the brand
- **EB Garamond at weight 400, never bold** — display is achieved by size and air, not by weight
- **Dawn Lavender (#f0d7ff)** as the *only* primary CTA color — never decorative, always the click
- **Fathom Teal (#034f46)** as the dark counterpart to lumen — used for promo banners, dark sections, and inverted contexts
- **Glow Orange (#ffa946)** reserved for stickers, highlight callouts, and "marked-up" affordances — never for primary chrome
- **2px and 4px borders** are the elevation language; 1px hairlines are not part of the system
- **Section radii up to 5rem** — sections are rounded *slabs* on top of a flat page, not flat sections separated by lines

## 2. Color Palette & Roles

### Primary Brand
- **Lumen** (#ffffeb): cream-ivory page background
- **Vast** (#1a1a1a): near-black for body text on lumen, dark sections, and 2px component borders
- **Fathom** (#034f46): dark teal; promo banner, dark sections
- **Dawn** (#f0d7ff): pale lavender; primary CTA background, active pricing tab, italic-text highlighter
- **Glow** (#ffa946): warm orange; sticker pills, accent button
- **Lumen Dark** (#e4e4d0): muted cream; 4px border on pricing cards
- **Pulse** (#7f1c34): deep wine red; error-text dark, accent only
- **White** (#ffffff): used sparingly — reserved for icon fills inside dark elements
- **Off-white** (#fffdf9): pricing card highlighted variant

### Text
- **Text Primary** (#1a1a1a): default text on lumen
- **Text Secondary** (#ffffeb): default text on Fathom or Vast surfaces
- **Text Tertiary** (#f0d7ff): emphasis text on dark surfaces (rare)
- **Text Alternate** (#ffffff): pure white only for white-on-darkest contexts
- **Text Black 70** (rgba(26,26,26,0.7) / #1a1a1ab3): supporting paragraph copy on lumen
- **Text Black 50** (rgba(26,26,26,0.5) / #1a1a1a80): caption, low-emphasis copy
- **Text Black 20** (#8a8a80): smallest secondary copy
- **Marquee gray** (#8d8d83): muted gray fill

### Semantic
- **Success Background** (#cef5ca) / **Success Text** (#114e0b)
- **Warning Background** (#fcf8d8) / **Warning Text** (#5e5515)
- **Error Background** (#f8e4e4) / **Error Text** (#7f1c34)
- **Focus Ring** (#2d62ff) / keyboard-focus uses **#4d65ff** as 0.125rem outline

### Surface & Border
- **Surface Primary** (#ffffeb / Lumen)
- **Surface Secondary** (#f0d7ff / Dawn) — selected/highlighted surface
- **Surface Tertiary** (#1a1a1a / Vast) — dark surface
- **Surface Alternate** (#ffffff)
- **Border Primary** (rgba(26,26,26,0.3) / #1a1a1a4d): subtle on lumen
- **Border Secondary** (#1a1a1a / Vast): 2px hard outline on buttons, pills
- **Border Alternate** (#222): borders on dark backgrounds
- **Border Lumen-Dark** (#e4e4d0): 4px chunky border on pricing cards

### Neutrals
- **Neutral 000** (#000000) · **Darkest** (#111111) · **Darker** (#222222) · **Dark** (#444444) · **Neutral** (#666666) · **Light** (#aaaaaa) · **Lighter** (#cccccc) · **Lightest** (#eeeeee)

### Alphas (over Vast #1a1a1a)
- 2% #1a1a1a05 — 5% #1a1a1a0d — 10% #1a1a1a1a — 15% #1a1a1a26 — 30% #1a1a1a4d — 50% #1a1a1a80 — 70% #1a1a1ab3 — 90% #1a1a1a

### Alphas (over Lumen #ffffeb)
- 2% #ffffeb05 — 5% #ffffeb0d — 10% #ffffeb1a — 15% #ffffeb26 — 30% #ffffeb4d — 50% #ffffeb80 — 70% #ffffebb3 — 90% #ffffebe6

### Shadows
- **Sticker Offset** (3px 2px 2px #0006): signature shadow on rotated pills/stickers
- **Sticker Active** (3px 2px 2px #0000): zero-alpha "from" state for transitions
- **Editorial Cut** (3px 3px #000): hard pure-black offset, no blur
- **Soft Drop** (0 4px 20px #0000001a): generic mid-elevation drop
- **Dialog/Modal** (0 4px 16px #00000040): elevated overlays
- **Lavender Glow** (0 61px 24px #f0d7ff08, 0 34px 21px #f0d7ff1a, 0 15px 15px #f0d7ff2b, 0 4px 8px #f0d7ff33): featured card bloom
- **Chip Hairline** (0 0 0 1px #0000001a, 0 1px 3px #0000001a): minimal lift on small chips
- **Highlighter Reveal** (inset 0 -25px 0 0 var(--base-color--dawn)): lavender swipe behind italic text
- **Highlighter Reset** (inset 0 0 0 0 var(--base-color--dawn)): "from" state of highlighter animation
- **Toggle Ridge** (0 2px #8c8c82): 2px solid bottom ridge on toggles
- **Focus Ring (inner)** (0 0 0 2px #fff): inner white halo for keyboard focus

## 3. Typography Rules

### Font Families
- **Primary / Display:** `"EB Garamond", Arial, sans-serif` — weights: 400 Regular, 400 Italic. CSS variable: `--font--primary-font`
- **UI / Body:** `Figtree, Arial, sans-serif` — weights: 400, 500, 600, 700. CSS variable: `--font--body-font`

### Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing |
|---|---|---|---|---|---|
| H1 Display | EB Garamond | 7.5rem desktop / 6rem tablet / 3.5rem mobile | 400 | 0.85 | normal |
| H2 | EB Garamond | 4rem desktop / 2.5rem mobile | 400 | 1.1 | normal |
| H3 | EB Garamond | 3rem desktop / 2rem mobile | 400 | 1.1 | normal |
| H4 | EB Garamond | 2rem desktop / 1.5rem mobile | 400 | 1.3 | −0.03em |
| H5 | EB Garamond | 1.25rem desktop / 1.125rem mobile | 400 | 1.3 | normal |
| H6 / Eyebrow | EB Garamond | 1rem desktop / 0.75rem mobile | 400 | 1.3 | normal |
| Body XLarge | Figtree | 1.5rem desktop / 1.25rem mobile | 400 | 1.5 | normal |
| Body Large | Figtree | 1.25rem desktop / 1.125rem mobile | 400 | 1.5 | normal |
| Body Medium | Figtree | 1.125rem desktop / 1rem mobile | 400 | 1.5 | normal |
| Body Regular | Figtree | 1rem | 400 | 1.5 | normal |
| Body Small | Figtree | 0.875rem | 500 | 1.5 | normal |
| Body XSmall | Figtree | 0.8125rem | 500 | 1.4 | normal |
| Tiny | Figtree | 0.75rem | 500 | 1.4 | normal |
| Tag / Eyebrow | Figtree | 1.25rem | 600 | 1.5 | 0.03em |
| Button Primary | Figtree | 1rem | 600 | 1.0 | normal |
| Button Small | Figtree | 0.875rem | 600 | 1.0 | normal |
| Pill / Chip Active | Figtree | 1.25rem | 700 | 1.5 | normal |

### Principles
- Headings are sized, not weighted. Every h1–h6 uses EB Garamond at weight 400.
- Italic is reserved for emphasis, paired with the lavender highlighter.
- Sans is the working voice; serif is the speaking voice.
- All-caps is rare and tracked. Only the eyebrow tag style is uppercase with letter-spacing: 0.03em.
- Button labels are sentence-case.

## 4. Component Stylings

### Button — Primary (.button)
- Background: #f0d7ff (Dawn), Text: #1a1a1a (Vast), Border: 2px solid #1a1a1a
- Border radius: 0.75rem (12px), Padding: 1rem 1.5rem
- Font: Figtree, 1rem, weight 600, line-height 1
- Hover: transform: scale(0.98) over 200ms
- Transition: transform .2s, color .3s

### Button — Small (.button.is-small)
- Border radius: 0.5rem (8px), Padding: 0.6rem 0.75rem, Font size: 0.875rem

### Button — Secondary (.button.is-secondary)
- Background: #ffffeb (Lumen), Border: 2px solid #1a1a1a, Text: #1a1a1a

### Button — Dark (.button.is-dark)
- Background: #1a1a1a (Vast), Text: #ffffeb (Lumen)

### Button — Yellow (.button.is-yellow)
- Background: #ffa946 (Glow), Text: #1a1a1a

### Button — Text (.button.is-text)
- Background: transparent, Border: 2px solid transparent, Text: #000

### Pill — Default (.pill)
- Background: transparent, Border: 2px solid #1a1a1a, Border radius: 100px
- Padding: 0.5rem 1rem, Font: Figtree weight 700
- Shadow (idle): 3px 2px 2px #0000, Transition: box-shadow .3s, transform .3s

### Pill — Active (.pill.active)
- Background: #f0d7ff (Dawn), Transform: rotate(-4deg)
- Shadow: 3px 2px 2px #0006 — signature sticker shadow

### Sticker / Annotation Pill
- Background: #ffa946 (Glow), Border: 2px solid #1a1a1a, Border radius: 100px
- Transform: rotate(-4deg) to rotate(-8deg), Shadow: 3px 2px 2px #0006
- Font: Figtree, weight 700

### Card (general)
- Background: #ffffeb (Lumen), Border: 4px solid #e4e4d0 (Lumen Dark)
- Border radius: 2.5rem desktop / 1.5rem mobile
- Padding: 2rem 1.75rem 1.125rem

### Modal / Dialog
- Background: #ffffeb, Border radius: 2rem, Border: 2px solid #1a1a1a
- Shadow: 0 4px 16px #00000040, Scrim: rgba(26, 26, 26, 0.5)

### Input
- Background: #ffffeb, Border: 2px solid #1a1a1a, Border radius: 0.75rem
- Padding: 1rem 1.25rem, Text: #1a1a1a, Placeholder: #1a1a1a80
- Focus: outline: 0.125rem solid #4d65ff, outline-offset: 0.125rem

## 5. Layout Principles

### Spacing Scale
0.25rem · 0.5rem · 0.75rem · 1rem · 1.25rem · 1.5rem · 1.75rem · 2rem · 2.5rem · 3rem · 4rem · 5rem · 6rem · 8rem · 10rem · 14rem

### Border Radius Scale
- Subtle: 0.125rem (2px), X-Small: 0.25rem (4px), Small: 0.5rem (8px)
- Medium-Small: 0.75rem (12px) — primary button radius
- Medium: 0.875rem (14px), Comfortable: 1rem (16px)
- Standard: 1.5rem (24px), Large: 2rem (32px), X-Large: 2.5rem (40px)
- XX-Large: 3rem (48px), Slab: 4rem (64px), Hero Slab: 5rem (80px)
- Pill: 62rem / 100px, Circle: 50%

### Whitespace Philosophy
- Editorial breathing room, not tight density
- Sections nest with rounded margins, not borders
- Color slabs (lumen → fathom → vast → lumen) with 5rem corner radii

## 6. Depth & Elevation

| Level | Treatment | Use |
|---|---|---|
| 0 — Page | background: #ffffeb; no shadow | Base canvas |
| 0.5 — Section Slab | background: #034f46; border-radius: 5rem | Dark content slabs |
| 1 — Hairline Chip | box-shadow: 0 0 0 1px #0000001a, 0 1px 3px #0000001a | Small chips |
| 2 — Editorial Cut | box-shadow: 3px 3px #000 | Hard offset cards |
| 3 — Sticker | box-shadow: 3px 2px 2px #0006 + rotate(-4deg) | Active pills, stickers |
| 4 — Soft Drop | box-shadow: 0 4px 20px #0000001a | Floating elements |
| 5 — Lavender Glow | 4-layer lavender bloom | Featured card only |
| 6 — Dialog | box-shadow: 0 4px 16px #00000040 | Modals, popovers |
| Focus | outline: 0.125rem solid #4d65ff | Keyboard focus |

## 7. Do's and Don'ts

### Do
- Put every primary CTA on #f0d7ff with 2px black outline and 12px radius
- Set every heading in EB Garamond at weight 400
- Use −4° rotation + offset shadow on stickers and active pills
- Background dark sections in #034f46 with border-radius: 5rem on desktop
- Use 2px and 4px borders
- Default backgrounds to #ffffeb (Lumen), never #ffffff

### Don't
- Don't use #ffffff as page background
- Don't use lavender decoratively — it's a click affordance only
- Don't bold EB Garamond
- Don't introduce gradients
- Don't snap stickers to 0°
- Don't use 1px hairlines for component borders
- Don't full-pill the primary button (12px radius is intentional)
- Don't use semantic blue (#2d62ff) for anything except keyboard focus
- Don't use Fathom teal for body text on lumen

## 8. Responsive Behavior

### Breakpoints

| Name | Width |
|---|---|
| Mobile Portrait | ≤ 479px |
| Mobile Landscape | 480px – 767px |
| Tablet | 768px – 991px |
| Desktop | 992px – 1199px |
| Desktop Mid | 1200px – 1280px |
| Large Desktop | 1281px+ |

## 9. Quick Color Reference

- Page background: #ffffeb (Lumen)
- Body text: #1a1a1a (Vast)
- Primary CTA bg: #f0d7ff (Dawn)
- Dark section bg: #034f46 (Fathom)
- Dark text-on-dark fallback: #ffffeb (Lumen)
- Sticker accent: #ffa946 (Glow)
- Card border (chunky): #e4e4d0 (Lumen Dark)
- Focus ring: #4d65ff
- Component border (default 2px): #1a1a1a (Vast)
