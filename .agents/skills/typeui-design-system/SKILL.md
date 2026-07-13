# Design System â€” Agent Instructions

This skill describes the visual design language for all UI output. Every component, layout, and page should follow the design specs in the module files below. These describe *what the design looks like* â€” you choose how to implement the styles.

## Style
An Amazon-inspired ecommerce interface with clean product grids, functional typography, and dense information hierarchy optimized for browsing and purchasing â€” big product photos, compact cards, and a utilitarian layout that puts merchandise first


## Before Writing Any Code

1. **Read every module that applies.** For a landing page, read at minimum: `layout.md`, `typography.md`, `colors.md`, `buttons.md`, `cards.md`, `shadows.md`, `radius.md`, `borders.md`. Do NOT write JSX until you have loaded all relevant modules.

## Critical Rules

- **Tokens are AGNOSTIC, NOT Tailwind classes:** The tokens defined in the `.md` files (like `neutral-primary-soft`, `heading`, `border-default`) are agnostic design system tokens, NOT literal Tailwind classes. Do not blindly use classes like `bg-neutral-primary-soft` unless you have explicitly mapped them in the CSS/Tailwind configuration. You must implement the mapping yourself.

- **Cross-reference modules.** A card containing buttons must satisfy both `cards.md` AND `buttons.md`.
- **Dark mode is automatic.** The CSS custom properties resolve differently in light/dark via `@media (prefers-color-scheme: dark)`. Never manually swap colors.
- **Every interactive element needs hover, focus, and disabled states** â€” defined in the relevant module.
- **Use semantic HTML:** proper heading hierarchy (`h1`â†’`h6`), `<button>` for actions, `<a>` for navigation, ARIA attributes where needed.

## Module Index

### Foundation (read first for any UI work)
- [colors.md](colors.md) â€” all background, text, and border color tokens
- [typography.md](typography.md) â€” heading scale, paragraphs, labels, links
- [layout.md](layout.md) â€” spacing rhythm, containers, animation, visual depth
- [radius.md](radius.md) â€” border-radius scale
- [shadows.md](shadows.md) â€” elevation tokens
- [borders.md](borders.md) â€” border widths and styles

### Components
- [buttons.md](buttons.md) â€” button variants, sizes, states, glint effect
- [button-group.md](button-group.md) â€” grouped button structure
- [cards.md](cards.md) â€” card structure, background, interactivity
- [inputs.md](inputs.md) â€” form controls, labels, states
- [alerts.md](alerts.md) â€” alert variants
- [badges.md](badges.md) â€” badge variants, sizes, dismissible chips
- [lists.md](lists.md) â€” list components
- [avatars.md](avatars.md) â€” avatar variants, sizes, indicators
- [icon-shapes.md](icon-shapes.md) â€” icon containers

### Complex Components
- [accordion.md](accordion.md) â€” accordion variants
- [dropdown.md](dropdown.md) â€” dropdown menus
- [modals.md](modals.md) â€” modal dialogs
- [tabs.md](tabs.md) â€” tab navigation
- [tables.md](tables.md) â€” table structure
- [pagination.md](pagination.md) â€” pagination components
- [sidebars.md](sidebars.md) â€” sidebar navigation
- [radios-checkboxes-toggle.md](radios-checkboxes-toggle.md) â€” selection controls
- [tooltips-popovers.md](tooltips-popovers.md) â€” tooltips and popovers
- [content.md](content.md) â€” grid system, responsiveness

---

## Source file: `accordion.md`

# Accordion

> Dependencies: `colors.md`, `radius.md`

## Core Specs

- **Wrapper:** full width, 1px border (border-default color), 8px radius â€” clips first/last item corners
- **Item separator:** 1px bottom border (border-default) on every item except last

## Trigger (Button)

- **Layout:** flex, space-between, full width
- **Padding:** 16px horizontal, 12px vertical
- **Font:** 13px, medium weight
- **Text color:** heading
- **Background:** neutral-secondary-soft
- **Hover:** neutral-tertiary-soft background
- **Focus:** outline none, 2px ring in brand color
- **Transition:** colors, 150ms
- **Open state:** neutral-tertiary-soft background

## Panel (Content)

- **Padding:** 16px horizontal, 12px vertical
- **Background:** neutral-primary-soft
- **Top border:** 1px, border-default color
- **Font:** 13px, body color, 1.5 line-height

## Chevron Icon

- Size: 16x16px
- Color: body text color
- Closed: 0deg rotation
- Open: 180deg rotation
- Transition: transform, 150ms

## Variants

### Default (Collapse)
One panel open at a time. Items stacked inside a single shared bordered/rounded wrapper.

### Separated Cards
Each item is independent â€” has its own 1px border, 8px radius, and shadow-2xs. 8px bottom margin between items. No shared outer border.

### Always Open
Multiple panels can expand simultaneously. Same styling as Default.

### Flush
No outer border. Trigger and panel have transparent backgrounds. Only bottom border dividers between items. Use inside containers that already provide a background.

## States

| State | Trigger appearance |
|---|---|
| Closed | heading text, neutral-secondary-soft background |
| Open | heading text, neutral-tertiary-soft background |
| Hover | neutral-tertiary-soft background |
| Focus | 2px brand ring, no outline |
| Disabled | fg-disabled text, not-allowed cursor, no hover/focus |

---

## Source file: `alerts.md`

# Alerts

> Dependencies: `colors.md`, `radius.md`

## Core Specs

- **Padding:** 12px
- **Radius:** 8px (base)
- **Border:** 1px
- **Heading:** 14px, medium weight
- **Body:** 13px, normal weight, 1.5 line-height

## Variants

### Brand
- **Background:** brand-softer
- **Border:** border-brand-subtle
- **Text:** fg-brand-strong

### Success
- **Background:** success-soft
- **Border:** border-success-subtle
- **Text:** fg-success-strong

### Danger
- **Background:** danger-soft
- **Border:** border-danger-subtle
- **Text:** fg-danger-strong

### Warning
- **Background:** warning-soft
- **Border:** border-warning-subtle
- **Text:** fg-warning

---

## Source file: `avatars.md`

# Avatars

> Dependencies: `colors.md`, `radius.md`

## Core Specs

- **Circular shape:** fully rounded (9999px)
- **Rounded square shape:** 8px radius
- **Default size:** 36x36px
- **Image fit:** cover

## Sizes

| Size | Dimensions | Radius |
|---|---|---|
| Extra Small | 18x18px | 2px |
| Small | 24x24px | 2px |
| Base | 32x32px | 8px |
| Large | 40x40px | 8px |
| XL | 48x48px | 8px |
| 2XL | 56x56px | 8px |

## Bordered Avatar

- 4px padding, fully rounded, 2px outline in border-default color
- Alternative: 2px box-shadow ring in border-default color

## Stacked Avatars

- Displayed in a row (flex)
- Each avatar: 36x36px, fully rounded, 2px border in border-buffer color
- Overlap: -12px negative margin on all except first

### Stacked Counter
- Same size as avatars (36x36px), fully rounded
- Background: dark-strong, text: white, 11px font, medium weight
- Same overlap margin as other avatars

## Avatar with Text

- Flex row, 8px gap between avatar and text
- Avatar: 36x36px, fully rounded, cover fit
- Name: heading color, medium weight
- Subtitle: 13px, body color

---

## Source file: `badges.md`

# Badges

> Dependencies: `colors.md`, `radius.md`

## Core Specs

- **Border:** 1px
- **Default radius:** 4px
- **Pill radius:** 9999px

## Sizes

| Size | Font size | Horizontal padding | Vertical padding |
|---|---|---|---|
| Default (small) | 11px | 6px | 2px |
| Large | 12px | 8px | 3px |

## Variants

### Brand
- **Background:** brand-softer
- **Border:** border-brand-subtle
- **Text:** fg-brand-strong

### Alternative (Neutral Soft)
- **Background:** neutral-primary-soft
- **Border:** border-default
- **Text:** heading

### Gray (Neutral Medium)
- **Background:** neutral-secondary-medium
- **Border:** border-default
- **Text:** heading

### Danger
- **Background:** danger-soft
- **Border:** border-danger-subtle
- **Text:** fg-danger-strong

### Success
- **Background:** success-soft
- **Border:** border-success-subtle
- **Text:** fg-success-strong

### Warning
- **Background:** warning-soft
- **Border:** border-warning-subtle
- **Text:** fg-warning

### Dark
- **Background:** dark
- **Border:** transparent
- **Text:** white

## Pill Badges

Use 9999px radius instead of 4px on any variant.

## Badges with Icons

- Icon size (default): 12x12px
- Icon size (large): 14x14px
- Icon spacing: 4px margin next to label

## Icon-only Badge

Square shape â€” equalize dimensions to 24x24px, no horizontal text padding.

## Dismissible Badges

Badge content + a close button. Close button hover backgrounds per variant:

| Variant | Close button hover background |
|---|---|
| Brand | brand-soft |
| Alternative | neutral-tertiary |
| Gray | neutral-quaternary |
| Danger | danger-medium |
| Success | success-medium |
| Warning | warning-medium |

## Dot / Notification Badge

- Positioned absolutely: -4px top, -4px right
- Size: 12x12px, fully rounded
- 2px border in border-buffer color
- Background: danger

---

## Source file: `borders.md`

# Borders

## Width Scale

| Context | Width |
|---|---|
| Default (inputs, buttons, cards) | 1px |
| Emphasis / focus | 2px |

## Rules

- Use solid borders by default
- Dashed borders only for special cases like file dropzones
- Components in the same family must use matching border widths
- Never mix 1px and 2px borders within a single component

## Usage

| Context | Width |
|---|---|
| Inputs / selects / textareas | 1px default; 2px on focus or error |
| Buttons | 1px for variants that require outlining |
| Cards / containers | 1px subtle; avoid stacked heavy borders |

---

## Source file: `button-group.md`

# Button Groups

> Dependencies: `buttons.md`, `colors.md`, `radius.md`

## Core Specs

- **Wrapper:** inline-flex, 8px radius, shadow-xs
- **Children overlap:** -1px left margin on all except first button
- **Buttons inside the group must NOT have individual shadows.** Only the wrapper has a shadow.

## Anatomy

### Wrapper
- Display: inline-flex
- Radius: 8px
- Shadow: shadow-xs

### First Button
- 8px radius on inline-start side only, 0 on inline-end

### Middle Button(s)
- No radius (0 on all corners)

### Last Button
- 8px radius on inline-end side only, 0 on inline-start

### All buttons except first
- -1px left margin to overlap borders

## Rules

- Buttons inside groups follow all styles from `buttons.md` (background, border, focus rings) except individual shadows
- Icon-only buttons: 16x16px icon, match height of text buttons

---

## Source file: `buttons.md`

# Buttons

> Dependencies: `colors.md`, `radius.md`, `shadows.md`

## Core Specs (every button except ghost and disabled)

- **Radius:** 8px (base) or 9999px for pills
- **Border:** 1px solid
- **Shadow:** shadow-xs
- **Gradient:** Every button except ghost and disabled uses a gradient background:
  - `linear-gradient(#0a50c0 0%, #0244aa 25%, #013a96 50%, #013080 75%, #012060 100%)`
- **Font weight:** 500 (medium)
- **Font:** "Open Sans"
- **Box sizing:** border-box
- **Transition:** color transitions on hover

## Sizes

| Size | Font size | Horizontal padding | Vertical padding |
|---|---|---|---|
| Extra small | 11px | 10px | 4px |
| Small | 12px | 12px | 6px |
| Base (default) | 13px | 14px | 8px |
| Large | 14px | 16px | 10px |
| Extra large | 14px | 20px | 12px |

## Variants

### Brand
- **Background:** brand token
- **Border:** transparent
- **Text:** black
- **Hover:** brand-strong background
- **Focus ring:** 4px, brand-medium color

### Secondary
- **Background:** neutral-secondary-medium
- **Border:** border-default-medium
- **Text:** body color
- **Hover:** neutral-tertiary-medium background, heading text color
- **Focus ring:** 4px, neutral-tertiary color

### Tertiary
- **Background:** neutral-primary-soft
- **Border:** border-default
- **Text:** body color
- **Hover:** neutral-secondary-medium background, heading text color
- **Focus ring:** 4px, neutral-tertiary-soft color

### Success
- **Background:** success token
- **Border:** transparent
- **Text:** white
- **Hover:** success-strong background
- **Focus ring:** 4px, success-medium color

### Danger
- **Background:** danger token
- **Border:** transparent
- **Text:** white
- **Hover:** danger-strong background
- **Focus ring:** 4px, danger-medium color

### Warning
- **Background:** warning token
- **Border:** transparent
- **Text:** white
- **Hover:** warning-strong background
- **Focus ring:** 4px, warning-medium color

### Dark
- **Background:** dark token
- **Border:** transparent
- **Text:** white
- **Hover:** dark-strong background
- **Focus ring:** 4px, neutral-tertiary color

### Ghost (NO shadow, NO gradient)
- **Background:** transparent
- **Border:** transparent
- **Text:** heading color
- **Hover:** neutral-secondary-medium background
- **Focus ring:** 4px, neutral-tertiary color
- **No shadow, no gradient effect**

### Disabled (NO shadow, NO gradient)
- **Background:** disabled token
- **Border:** border-default-medium
- **Text:** fg-disabled color
- **Cursor:** not-allowed
- **No hover, no focus, no shadow, no gradient**

## Icons in Buttons

- Icon size: 16x16px
- Icon color: match text color (e.g., black for brand buttons)
- Spacing: 8px gap between icon and label
- Layout: inline-flex, vertically centered

---

## Source file: `cards.md`

# Cards

> Dependencies: `colors.md`, `radius.md`, `shadows.md`, `typography.md`

## Core Specs

- **Background:** neutral-primary-soft
- **Border:** 1px, border-default color
- **Radius:** 8px (base)
- **Shadow:** shadow-2xs

## Card Heading

- Desktop: 18px, medium weight, heading color
- Mobile: 14px, medium weight, heading color
- Never skip heading levels â€” the page hierarchy must logically arrive at the card heading level.

## States

### Static Card (no interactivity)
- Background: neutral-primary-soft
- Border: 1px, border-default
- Radius: 8px
- Shadow: shadow-2xs
- No hover styles. Non-interactive cards must NOT have hover background changes.

### Interactive Card (clickable)
- Same base styles as static card
- Hover: neutral-secondary-medium background
- Transition: colors
- Cursor: pointer

## Rules

- Background: neutral-primary-soft
- Border: 1px, border-default
- Radius: 8px
- Shadow: shadow-2xs
- Interactive hover: neutral-secondary-medium background
- Non-interactive: no hover styles

---

## Source file: `colors.md`

# Color Tokens

## Background Tokens

### Neutral
| Token | Light | Dark |
|---|---|---|
| neutral-primary-soft | #FFFFFF | #0F1111 |
| neutral-primary | #FFFFFF | #000000 |
| neutral-primary-medium | #FFFFFF | #191E1E |
| neutral-primary-strong | #FFFFFF | #2D3333 |
| neutral-secondary-soft | #F7F8F8 | #0F1111 |
| neutral-secondary | #F7F8F8 | #000000 |
| neutral-secondary-medium | #F0F2F2 | #191E1E |
| neutral-secondary-strong | #E9ECEC | #2D3333 |
| neutral-tertiary-soft | #EAEDED | #0F1111 |
| neutral-tertiary | #EAEDED | #191E1E |
| neutral-tertiary-medium | #E3E6E6 | #2D3333 |
| neutral-quaternary | #D5D9D9 | #2D3333 |
| quaternary-medium | #D5D9D9 | #3D4444 |
| gray | #BBBFBF | #3D4444 |

### Brand
| Token | Light | Dark |
|---|---|---|
| brand-softer | #FEF7ED | #3D2A0F |
| brand-soft | #FCECD3 | #5C3F18 |
| brand | #F3A848 | #F3A848 |
| brand-medium | #F8D4A0 | #5C3F18 |
| brand-strong | #D4882A | #F3A848 |

### Status
| Token | Light | Dark |
|---|---|---|
| success-soft | #F0FCF5 | #002C22 |
| success | #007A55 | #009966 |
| success-medium | #D0FAE5 | #004F3B |
| success-strong | #006045 | #007A55 |
| danger-soft | #FEF0F0 | #4D0218 |
| danger | #CC0C39 | #CC0C39 |
| danger-medium | #FFE0E3 | #8B0836 |
| danger-strong | #A30028 | #A30028 |
| warning-soft | #FFF7ED | #7C2D12 |
| warning | #F97316 | #F97316 |
| warning-medium | #FFEDD5 | #7C2D12 |
| warning-strong | #C2410C | #C2410C |

### Button Glint (CSS custom properties, used for the glint box-shadow effect)
| Variable | Light | Dark |
|---|---|---|
| `--color-1-400` | rgba(255,255,255,0.20) | rgba(255,255,255,0.10) |
| `--color-1-700` | rgba(0,0,0,0.08) | rgba(0,0,0,0.20) |

### Utility
| Token | Light | Dark |
|---|---|---|
| dark | #131A22 | #131A22 |
| dark-strong | #0F1111 | #2D3333 |
| disabled | #EAEDED | #191E1E |

### Accent
| Token | Value (same both modes) |
|---|---|
| purple | #A855F7 |
| sky | #0EA5E9 |
| teal | #007185 |
| pink | #DB2777 |
| cyan | #06B6D4 |
| fuchsia | #C026D3 |
| indigo | #4F46E5 |
| orange | #F3A848 |

## Text Color Tokens

### Base
| Token | Light | Dark |
|---|---|---|
| white | #FFFFFF | #FFFFFF |
| black | #0F1111 | #0F1111 |
| heading | #0F1111 | #FFFFFF |
| body | #565959 | #A4A9A9 |
| body-subtle | #767676 | #A4A9A9 |

### Brand
| Token | Light | Dark |
|---|---|---|
| fg-brand-subtle | #F8D4A0 | #5C3F18 |
| fg-brand | #D4882A | #F3A848 |
| fg-brand-strong | #B87320 | #F8D4A0 |

### Status
| Token | Light | Dark |
|---|---|---|
| fg-success | #047857 | #065F46 |
| fg-success-strong | #065F46 | #10B981 |
| fg-danger | #CC0C39 | #F43F5E |
| fg-danger-strong | #8B0836 | #F87171 |
| fg-warning-subtle | #EA580C | #F97316 |
| fg-warning | #7C2D12 | #FBBF24 |
| fg-disabled | #949494 | #565959 |

### Informational / Accent
| Token | Light | Dark |
|---|---|---|
| fg-yellow | #FACC15 | #FACC15 |
| fg-info | #232F3E | #93C5FD |
| fg-purple | #9333EA | #A855F7 |
| fg-purple-strong | #7E3AF2 | #DDD6FE |
| fg-cyan | #007185 | #06B6D4 |
| fg-indigo | #4F46E5 | #4F46E5 |
| fg-pink | #DB2777 | #DB2777 |
| fg-lime | #65A30D | #84CC16 |

## Border Color Tokens

| Token | Light | Dark |
|---|---|---|
| border-dark | #131A22 | #3D4444 |
| border-buffer | #FFFFFF | #000000 |
| border-buffer-medium | #FFFFFF | #191E1E |
| border-buffer-strong | #FFFFFF | #2D3333 |
| border-muted | #F7F8F8 | #0F1111 |
| border-light-subtle | #EAEDED | #0F1111 |
| border-light | #EAEDED | #191E1E |
| border-light-medium | #EAEDED | #2D3333 |
| border-default-subtle | #D5D9D9 | #0F1111 |
| border-default | #D5D9D9 | #191E1E |
| border-default-medium | #D5D9D9 | #2D3333 |
| border-default-strong | #BBBFBF | #3D4444 |
| border-success-subtle | #A7F3D0 | #064E3B |
| border-success | #047857 | #065F46 |
| border-danger-subtle | #FECDD3 | #8B0836 |
| border-danger | #CC0C39 | #CC0C39 |
| border-warning-subtle | #FED7AA | #7C2D12 |
| border-warning | #EA580C | #F97316 |
| border-brand-subtle | #F8D4A0 | #5C3F18 |
| border-brand-light | #F3A848 | #F3A848 |
| border-brand | #D4882A | #F3A848 |
| border-dark-subtle | #131A22 | #2D3333 |
| border-purple | #A855F7 | #A855F7 |
| border-orange | #F3A848 | #F3A848 |

## Semantic Usage Rules

- Page/section backgrounds: neutral-primary-soft (default), neutral-secondary-soft (alternating)
- Primary buttons: brand background
- Headings: heading text color
- Body text: body text color
- CTA links: fg-brand text color
- Default borders: border-default
- Status borders match intent: success â†’ border-success, danger â†’ border-danger, warning â†’ border-warning
- Disabled: disabled background + fg-disabled text

## Prohibited

- No raw hex/rgb values in component code â€” always use design tokens
- No brand text color for long-form paragraphs
- No accent text tokens (fg-purple, etc.) for body copy or navigation
- No brand/accent backgrounds for large layout surfaces (pages, sections) unless it's a hero/campaign area
- No manual light/dark value swapping â€” let the CSS custom properties handle it

---

## Source file: `content.md`

# Content & Grid System

> Dependencies: `layout.md`, `typography.md`

## Containers

| Type | Max width | Horizontal padding |
|---|---|---|
| Standard | 1440px | 16px |
| Internal (reading) | 768px | â€” (45â€“75 char line length) |

## Vertical Padding

| Breakpoint | Vertical padding |
|---|---|
| Mobile | 24px |
| Tablet (â‰¥768px) | 32px |
| Desktop (â‰¥1024px) | 48px or 64px for hero/feature sections |

## Grid System

Mobile-first with flexible desktop configurations.

| Context | Gap |
|---|---|
| Standard content/cards | 16px |
| Compact widgets/metadata | 8px |

### Responsive Columns

| Breakpoint | Columns |
|---|---|
| Mobile (default) | 1â€“2 |
| Small/Tablet (â‰¥640px) | 2â€“4 |
| Desktop (â‰¥1024px) | 3â€“12 |

Full support for 6, 7, 8, 9+ column grids where needed.

## Breakpoints

| Name | Width |
|---|---|
| Small | 640px |
| Medium | 768px |
| Large | 1024px |
| Extra large | 1280px |
| 2x Extra large | 1536px |

## Rules

- Always design mobile-first
- Use layout shifts (column â†’ row) to accommodate horizontal space
- Lists: 16px indentation, 8px vertical gap between items
- Body copy: 14px, 1.6 line-height
- All interactive links follow brand underline/hover protocol

---

## Source file: `dropdown.md`

# Dropdown

> Dependencies: `colors.md`, `radius.md`, `shadows.md`, `inputs.md`

## Core Specs

### Chevron Icon
- Size: 16x16px
- Spacing: 6px left margin, -2px right margin
- Color: inherits from trigger button

### Menu Container
- Background: neutral-primary-soft
- Border: 1px, border-default
- Radius: 8px (base)
- Shadow: shadow-sm
- Z-index: elevated above content

### Menu List
- Padding: 6px
- Font: 13px, body color, medium weight

### Menu Item
- Layout: inline-flex, vertically centered, full width
- Padding: 6px horizontal, 6px vertical
- Radius: 4px (default)
- Hover: neutral-tertiary-medium background, heading text
- Transition: colors, 150ms

## Trigger Sizes

| Size | Font size | Horizontal padding | Vertical padding |
|---|---|---|---|
| Small | 12px | 10px | 6px |
| Base | 13px | 14px | 8px |
| Large | 14px | 16px | 10px |

## Icon-only Trigger

- Padding: 8px
- Min size: 40x40px
- Icon: 20x20px

## Variants

### Default
- Menu width: 176px, items have 4px radius

### With Divider
- Top border (border-default) between child groups, skip first group

### With Header
- Header padding: 12px horizontal, 8px vertical
- Bottom border: border-default
- Name: heading color, 13px, semibold weight
- Email: body-subtle color, 13px, truncated

### With Icons
- Icon before label: 16x16px, 8px right margin, body color
- On hover, icon color changes to heading

### With Checkbox / Radio
- Inputs: 16x16px, 2px radius, focus ring in brand-soft
- Helper text: 11px, body-subtle color, 2px top margin

### With Search
- Search input at top of menu following `inputs.md` specs
- Left icon: 10px left padding, input 32px left padding

### Scrollable
- Max height: 192px, vertical scroll overflow

## States

| State | Appearance |
|---|---|
| Focused trigger | no outline, 2px brand ring |
| Hover item | neutral-tertiary-medium background, heading text |
| Active/open item | neutral-tertiary-soft background, heading text |
| Disabled item | fg-disabled text, not-allowed cursor, no pointer events |

---

## Source file: `icon-shapes.md`

# Icon Shapes

> Dependencies: `colors.md`, `radius.md`

## Core Specs

- Box sizing: border-box
- Icon must be perfectly centered (inline-flex, centered both axes)
- Circle: fully rounded (9999px)
- Rounded square: 8px radius (MD/LG/XL), 4px radius (XS/SM)

## Sizes

| Size | Container | Icon |
|---|---|---|
| XS | 24x24px | 14x14px |
| SM | 32x32px | 16x16px |
| MD | 40x40px | 20x20px |
| LG | 48x48px | 24x24px |
| XL | 56x56px | 28x28px |

## Color Variants

### Brand
- Shape: circle
- Background: brand-softer
- Icon color: fg-brand-strong

### Gray
- Shape: circle
- Background: neutral-secondary-soft
- Icon color: body

### Danger
- Shape: circle
- Background: danger-soft
- Icon color: fg-danger-strong

### Success
- Shape: circle
- Background: success-soft
- Icon color: fg-success-strong

### Warning
- Shape: circle
- Background: warning-soft
- Icon color: fg-warning

---

## Source file: `inputs.md`

# Inputs

> Dependencies: `colors.md`, `radius.md`

## Core Specs

- **Display:** block, full width
- **Radius:** 8px (base)
- **Border:** 1px, border-default-medium
- **Background:** neutral-secondary-medium
- **Shadow:** shadow-2xs
- **Font:** 13px, heading color
- **Padding:** 10px horizontal, 8px vertical
- **Placeholder:** body color
- **Transition:** all properties, 200ms

## Label

- Display: block
- Font: 13px, medium weight, heading color
- Margin bottom: 6px
- Label `htmlFor` must match the input `id`

## States

### Default
- Border: border-default-medium
- Background: neutral-secondary-medium

### Hover
- Border: border-default-strong

### Focus
- No outline
- Border: border-brand
- Ring: 1px, brand color

### Success
- Border: border-success
- Focus ring: 1px, success color

### Error / Danger
- Border: border-danger
- Focus ring: 1px, danger color

### Disabled
- Background: disabled
- Text: fg-disabled
- Cursor: not-allowed

## Input with Icons

- Icon size: 16x16px
- Icon color: body
- Container: relative positioned wrapper
- Start icon: absolutely positioned left, 10px left padding â€” input gets 32px left padding
- End icon: absolutely positioned right, 10px right padding â€” input gets 32px right padding
- Icons vertically centered within the wrapper

## Rules

- Every input must have a unique `id`
- Every label must have a matching `htmlFor`
- Padding: 10px horizontal, 8px vertical unless overridden for icon variants
- No arbitrary hex or hardcoded colors

---

## Source file: `layout.md`

# Layout & Spacing

## Spacing Rhythm

Base unit: **4px**. All spacing values should be multiples of 4px.

| Context | Value |
|---|---|
| Section vertical padding | 48px |
| Section header â†’ content | 24px or 32px |
| Heading â†’ paragraph | 12px |
| Container horizontal padding | 16px |
| Flex/grid row gap | 12px |
| Card grid gap | 16px |
| Wide component grid gap | 24px |
| Column layout gap | 32px |

## Container

Standard section container: max-width 1440px, centered, 16px horizontal padding.

Every major section wraps content in this container.

## Content Composition Order

Inside each section, follow this order:
1. Heading (`h1`â€“`h3`)
2. Leading paragraph
3. Normal paragraph(s)
4. Lists, CTA links, or component grids

## Section Pattern

Each section has:
- 48px vertical padding
- A background color (alternate between neutral-primary-soft and neutral-secondary-soft)
- A centered container (max-width 1440px, 16px horizontal padding)
- A section header area with 24px bottom margin
- Section content below

## Motion & Animation

- Prefer CSS-native: `transition`, `animation`, `@keyframes`. Use Motion library only when CSS cannot achieve the behavior.
- Keep animations minimal and functional â€” transitions should be quick and subtle, focused on hover states and content reveals.
- Avoid heavy page-load animations. Prioritize instant content display over choreographed entrance effects.

## Backgrounds & Visual Depth

- Default to clean, flat backgrounds with subtle color differentiation between sections.
- Use simple white cards on light gray backgrounds for clear content separation.
- Product imagery should be the primary visual element â€” backgrounds and UI chrome should stay minimal and unobtrusive.
- Every visual treatment must serve a functional purpose (separation, hierarchy, or emphasis). No decorative effects that compete with product content.

## Must

- All sections: consistent 48px vertical padding
- All containers: max-width 1440px, centered, 16px horizontal padding
- Section headers: 24px or 32px bottom margin
- Consistent vertical rhythm, no crowded sections
- Layouts readable and properly spaced on both desktop and mobile

---

## Source file: `lists.md`

# Lists

> Dependencies: `colors.md`

## Core Specs

- Item spacing: 12px vertical gap between list items
- Text: body color

## List Icons

- Size: 18x18px
- Prevent squishing: no shrink
- Spacing: 6px right margin between icon and text
- Active/featured icon: fg-brand color
- Neutral icon: body color

## Inactive / Disabled Items

Strikethrough text with body color decoration on the list item.

## Pattern

Vertical flex list with 12px gap. Each item is a flex row with centered alignment â€” icon (18x18, no-shrink, 6px right margin) followed by a span of body-colored text.

---

## Source file: `modals.md`

# Modals

> Dependencies: `colors.md`, `radius.md`, `shadows.md`, `buttons.md`, `inputs.md`

## Core Specs

### Overlay (Backdrop)
- Fixed, covers full screen
- Z-index: 40
- Background: black at 50% opacity
- Backdrop blur: small amount

### Content Container
- Background: neutral-primary
- Radius: 8px (base)
- Shadow: shadow-lg
- Padding: 16px

## Anatomy

### Header
- Bottom border: border-default
- Top corners rounded (8px)
- Title: 18px, semibold weight, heading color
- Close button: Ghost variant from `buttons.md`, 6px padding

### Body
- Vertical padding: 16px
- Vertical spacing between elements: 16px
- Text: 14px, 1.6 line-height, body color

### Footer
- Top border: border-default
- Bottom corners rounded (8px)

## Variants

### Default (Information)
Standard header + body + footer with primary/secondary action buttons.

### Pop-up (Confirmation)
Centered text, prominent icon, reduced padding:
- Body: 16px padding, text centered
- Icon: centered, 12px bottom margin, 40x40px, gray color

### Form Modal
Body contains inputs following `inputs.md`. Vertical spacing between form elements: 12px.

## Rules

- Backdrop covers full screen with fixed positioning
- Content: neutral-primary background, 8px radius, shadow-lg
- Header/Footer separated by border-default borders
- Close button must be present and functional
- Accessibility: `role="dialog"`, implement focus trap in code
- Dark mode automatic via token system

---

## Source file: `pagination.md`

# Pagination

> Dependencies: `colors.md`, `radius.md`

## Container

Font: 13px. Items displayed as flex with -1px overlap for seamless borders.

## Pagination Item

- Layout: flex, centered both axes
- Size: 32x32px (or 36x36px)
- Text: body color, medium weight
- Background: neutral-secondary-medium
- Border: 1px, border-default-medium
- Hover: neutral-tertiary-medium background, heading text
- Focus: no outline
- Overlap: -1px left margin

## Previous / Next Buttons

- Horizontal padding: 10px, height: 32px
- First item: 8px radius on inline-start side
- Last item: 8px radius on inline-end side

## Active Page Item

- Text: fg-brand color
- Background: neutral-tertiary-medium
- Hover text: fg-brand (stays same)

## Rules

- Display as flex with -1px child overlap for seamless borders
- Items: neutral-secondary-medium background, border-default-medium border, body text
- Active: fg-brand text, neutral-tertiary-medium background
- First item: rounded start, Last item: rounded end
- All items need hover and focus states

---

## Source file: `radios-checkboxes-toggle.md`

# Radios, Checkboxes & Toggles

> Dependencies: `colors.md`, `radius.md`

## Checkbox

- Size: 16x16px
- Radius: 2px
- Border: 1px, border-default-medium
- Background: neutral-secondary-medium
- Focus ring: 2px, brand-soft

### Disabled
- Border: border-light
- Text: fg-disabled

## Radio

- Size: 16x16px
- Radius: fully rounded
- Border: 1px, border-default-medium
- Background: neutral-secondary-medium
- Focus ring: 2px, brand-soft
- Checked: border-brand, indicator: neutral-primary color

### Disabled
- Border: border-light-medium
- Text: fg-disabled

Group all radio items under the same `name` attribute.

## Toggle

### Track
- Fully rounded
- Background: neutral-quaternary
- Focus-within ring: 2px, brand-soft
- Checked track: brand background
- Disabled track: neutral-tertiary background

### Thumb
- Fully rounded
- Background: white
- Border: border-buffer

### Disabled
- Track: neutral-tertiary background
- Label: fg-disabled text

## Rules

- All selection inputs must have `id` matching label `htmlFor`
- Focus states use the appropriate brand token for each control type
- Disabled states: no hover/focus interaction

---

## Source file: `radius.md`

# Border Radius

| Token | Value | Default usage |
|---|---|---|
| base | 8px | Buttons, cards, inputs, modals, sections |
| default | 4px | Badges, tooltips, dropdown items, small controls |
| sm | 2px | Checkboxes, tiny elements |
| full | 9999px | Pills, avatars, toggles, dot indicators |

## Rules

- 8px is the default radius across the product
- Never use arbitrary radius values outside this scale
- Radius must be consistent within each component family

---

## Source file: `shadows.md`

# Shadows

| Token | CSS value |
|---|---|
| shadow-2xs | `0 1px rgb(0 0 0 / 0.04)` |
| shadow-xs | `0 1px 2px 0 rgb(0 0 0 / 0.04)` |
| shadow-sm | `0 1px 2px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)` |
| shadow-md | `0 2px 4px -1px rgb(0 0 0 / 0.06), 0 1px 3px -1px rgb(0 0 0 / 0.06)` |
| shadow-lg | `0 6px 12px -3px rgb(0 0 0 / 0.08), 0 3px 5px -3px rgb(0 0 0 / 0.06)` |
| shadow-xl | `0 14px 20px -5px rgb(0 0 0 / 0.08), 0 6px 8px -5px rgb(0 0 0 / 0.06)` |
| shadow-2xl | `0 20px 40px -10px rgb(0 0 0 / 0.15)` |

## Component Mapping

| Component type | Token |
|---|---|
| Subtle separators, tiny UI details | shadow-2xs |
| Inputs, buttons, small controls, lightweight cards | shadow-2xs or shadow-xs |
| Standard cards, popovers, dropdowns | shadow-xs or shadow-sm |
| Prominent cards, sticky surfaces | shadow-sm or shadow-md |
| Modals, high-priority overlays | shadow-md or shadow-lg |
| Hero overlays, top-level emphasis (sparingly) | shadow-xl |

## Rules

- Use only these tokens â€” no custom box-shadow values
- Keep elevation steps intentional; avoid jumping multiple levels
- Components in the same family share the same baseline elevation
- Hover/focus on interactive elevated elements: step up by one level
- Never stack multiple shadow tokens on one element
- Never use shadow-xl/shadow-2xl for dense list items or body containers

---

## Source file: `sidebars.md`

# Sidebars

> Dependencies: `colors.md`, `radius.md`, `typography.md`, `badges.md`, `alerts.md`

## Core Specs

- Background: neutral-primary-soft
- Right border: 1px, border-default (for left-sidebar); left border for right-sidebar
- Width: 240px

## Anatomy

### Outer Container
Hidden on mobile, visible at small breakpoint. Needs a toggle/trigger for mobile.

### Inner Wrapper
- Full height, vertical scroll overflow
- Padding: 10px horizontal, 12px vertical

### Navigation List
- Vertical spacing: 4px between items
- Font weight: medium

### Navigation Item
- Layout: flex, vertically centered
- Padding: 8px horizontal, 6px vertical
- Text: heading color
- Radius: 8px (base)
- Hover: neutral-secondary-medium background
- Transition: colors
- Icon: 18x18px, body color, hover â†’ heading color, 75ms transition
- Label: 10px left margin from icon

### Active Item
- Background: neutral-secondary-strong
- Text: fg-brand-strong

### Separator
- 12px top padding, 12px top margin
- Top border: border-default
- 4px vertical spacing below

### Bottom CTA / Card
- Padding: 12px
- Top margin: 16px
- Radius: 8px (base)
- Background: brand-softer
- Can also use any alert variant from `alerts.md`

## Rules

- Responsive: hidden on mobile with a trigger mechanism
- Icons: 18x18px, body color (hover: heading color)
- Multi-level menus: indent with 36px left padding
- Spacing follows 4px grid
- Only neutral, brand, or status tokens â€” no arbitrary colors

---

## Source file: `tables.md`

# Tables

> Dependencies: `colors.md`, `radius.md`, `shadows.md`

## Wrapper

- Horizontal scroll overflow
- Background: neutral-primary-soft
- Radius: 8px (base)
- Border: 1px, border-default
- Shadow: shadow-2xs

## Table Element

- Full width, left-aligned text (right-aligned for RTL)
- Font: 13px, body color

## Table Head

- Font: 12px, body color, medium weight
- Background: neutral-secondary-soft
- Bottom border: border-default
- Cell padding: 16px horizontal, 10px vertical

## Table Body

- Row background: neutral-primary
- Row bottom border: border-default (omit on last row to avoid doubling with wrapper border)
- Row hover: neutral-secondary-soft background (optional)
- Row header: medium weight, heading color, no-wrap
- Cell padding: 16px horizontal, 12px vertical

## Rules

- Wrapper must have horizontal scroll overflow for responsive scrolling
- Last row: omit bottom border to avoid doubling with wrapper border
- Row headers: always `scope="row"` for semantic structure
- Hover on rows is optional
- No arbitrary hex codes â€” use token colors only

---

## Source file: `tabs.md`

# Tabs

> Dependencies: `colors.md`, `radius.md`, `shadows.md`

## Core Specs

- Typography: 13px, medium weight, body color
- Transitions: all properties, 200ms

## Variants

### 1. Underline (Default)

**Wrapper:** bottom border, border-default

**Tab Item:**
- Padding: 12px horizontal, 12px vertical
- Bottom border: 2px, transparent
- Top corners: 8px radius
- Transition: colors, 150ms

| State | Appearance |
|---|---|
| Active | fg-brand text, border-brand bottom border |
| Inactive | transparent bottom border; hover â†’ heading text, border-default-strong bottom border |
| Disabled | fg-disabled text, not-allowed cursor |

### 2. Pills

**Tab Item:**
- Padding: 12px horizontal, 8px vertical
- Radius: 8px (base)
- Font weight: medium
- Transition: all, 200ms

| State | Appearance |
|---|---|
| Active | brand background, white text, shadow-xs |
| Inactive | body text; hover â†’ neutral-secondary-soft background, heading text |
| Disabled | fg-disabled text, not-allowed cursor |

### 3. Full Width

Children overlap with -1px left margin on all except first.

**Tab Item:**
- Full width, centered text
- Padding: 12px horizontal, 12px vertical
- Background: neutral-primary-soft
- Border: 1px, border-default
- Transition: colors, 150ms
- Hover: neutral-secondary-medium background, heading text

| State | Appearance |
|---|---|
| Active | neutral-secondary-soft background, fg-brand text |
| First item | rounded start (8px) |
| Last item | rounded end (8px) |

## Tabs with Icons

- Icon size: 16x16px or 20x20px
- Spacing: 8px right margin
- Layout: inline-flex, centered
- Icons inherit the text color of the tab state

---

## Source file: `tooltips-popovers.md`

# Tooltips & Popovers

> Dependencies: `colors.md`, `radius.md`, `shadows.md`

## Tooltips

### Core Specs
- Padding: 10px horizontal, 6px vertical
- Font: 12px, medium weight
- Radius: 4px (default)
- Shadow: shadow-2xs
- Transition: opacity, 300ms

### Dark (Default)
- Background: dark
- Text: white
- Border: transparent

### Light
- Background: neutral-primary-medium
- Text: heading color
- Border: 1px, border-default

## Popovers

### Core Specs
- Background: neutral-primary
- Radius: 8px (base)
- Shadow: shadow-sm
- Border: 1px, border-default
- Transition: opacity, 300ms

### Header / Title
- Padding: 10px horizontal, 6px vertical
- Background: neutral-secondary-soft
- Bottom border: border-default
- Font: 13px, medium weight, heading color

### Body / Content
- Standard: 10px horizontal, 6px vertical padding; 13px, body color
- Rich: 12px padding; 13px, body color

## Arrows

- Size: 8x8px rotated 45deg
- Color must match the background of the tooltip/popover variant

## Rules

- Tooltips: 4px radius
- Popovers: 8px radius
- Dark tooltips: dark background, white text
- Light tooltips/popovers: semantic neutral background + border tokens
- Arrows match parent background color

---

## Source file: `typography.md`

# Typography

> Dependencies: `colors.md`

## Core Rules

- **Font:** "Open Sans", sans-serif â€” configured at app level, never override
- **Headings:** semibold weight (600), heading text color
- **Body copy:** body text color, never use brand color for paragraphs longer than one sentence
- **Semantic HTML:** Use `h1`â€“`h6` in order, never skip levels

## Heading Scale

### Desktop

| Element | Size | Line-height | Letter-spacing | Margin-bottom |
|---|---|---|---|---|
| `h1` | 36px | 1.15 | -0.4px | 16px |
| `h2` | 28px | 1.2 | â€” | â€” |
| `h3` | 24px | 1.25 | â€” | â€” |
| `h4` | 20px | 1.3 | â€” | â€” |
| `h5` | 18px | 1.4 | â€” | â€” |
| `h6` | 16px | 1.4 | â€” | â€” |

### Responsive

| Element | Tablet (â‰¥768px) | Mobile (default) |
|---|---|---|
| `h1` | 30px | 24px |
| `h2` | 24px | 20px |
| `h3` | 22px | 18px |
| `h4` | 18px | 16px |
| `h5` | 16px | 15px |
| `h6` | 15px | 14px |

Mobile-first: start with mobile sizes, scale up at tablet and desktop breakpoints.

Never reduce line-height below 1.1 for any heading.

## Paragraphs

### Leading Paragraph
- Size: 18px
- Weight: normal
- Color: body
- Line-height: 1.6
- Max width: ~70 characters

### Normal Paragraph
- Size: 14px
- Weight: normal
- Color: body
- Line-height: 1.6
- Max width: ~75 characters

### Small Supporting Copy
- Size: 12px
- Weight: normal
- Color: body
- Line-height: 1.5
- Use only for helper text, legal text, captions, metadata.

## UI Labels

| Context | Size | Weight |
|---|---|---|
| Button labels | 14px | 500 (medium) |
| Input labels | 13px or 14px | 500 (medium) |
| Captions / meta / badges | 11px or 12px | 500 (medium) |

Do not apply paragraph line-height (1.6) to control labels.

## Links

- **Inline links:** Same size as surrounding text, fg-brand color, underline, hover â†’ no underline
- **CTA links:** fg-brand color, medium weight, underline, hover â†’ no underline

## Emphasis

- `<strong>` for high-priority emphasis in body text
- `<em>` for tone emphasis only, not visual hierarchy
- All-caps only for short labels: uppercase, 0.4px letter-spacing, 11px or 12px

## Dark Mode

Hierarchy stays identical. Only color tokens change (automatic via CSS custom properties). Size, weight, and spacing remain constant.
