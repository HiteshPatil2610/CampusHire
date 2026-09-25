# CampusHire — UI Design Language & Context

> **Source of Truth** for the CampusHire design system, UI architecture, and component library.
> Generated from `styles.css` and `motion.js`. All screens, components, and interactions must adhere strictly to these definitions.

---

## 1. Global Page Design Language & Core Foundation

### 1.1 Aesthetic Philosophy
CampusHire uses a **warm, paper-like aesthetic** rather than sterile SaaS white. 
- **Base Canvas:** The page background uses a warm off-white parchment tone (`#FAF9F5`), preventing eye fatigue.
- **Elevation:** Content containers and cards lift slightly off the background using pure white surfaces (`#FFFFFF`) with crisp, hairline borders (`0.5px solid #E6E4DA`) instead of heavy, muddy drop shadows.
- **Brand Accent:** A terracotta / warm coral accent (`#D85A30`) injects energy and warmth while remaining grounded and trustworthy.
- **Hierarchy:** High data density is kept legible and calm through disciplined spacing, subtle status tinting, and structured hairline separators.

---

### 1.2 Global Color Tokens (`:root`)

#### Surface & Text Hierarchy
| Token | Hex | Role & Application |
|---|---|---|
| `--surface-0` | `#FAF9F5` | Global body & page background (warm off-white) |
| `--surface-1` | `#F1EFE7` | Sunken / recessed areas, metric card backgrounds, hover fills |
| `--surface-2` | `#FFFFFF` | Elevated surfaces: cards, modals, sidebar, topbar |
| `--text-primary` | `#1C1C1A` | Headings, primary labels, main body text |
| `--text-secondary` | `#6B6A63` | Subheadings, navigation links, table headers, metadata |
| `--text-muted` | `#9B9A92` | Placeholders, timestamps, subtle hints, inactive indicators |
| `--border` | `#E6E4DA` | Default hairline boundary for cards, dividers, and list rows |
| `--border-strong` | `#D2D0C4` | High-emphasis borders: table header baselines, input borders, OTP boxes |

#### Brand Terracotta Accent
| Token | Hex | Role & Application |
|---|---|---|
| `--accent` | `#D85A30` | Primary action buttons, active indicators, gauge fills, brand dot |
| `--accent-dark` | `#712B13` | Hover states on primary buttons, high-contrast active text |
| `--accent-light` | `#FAECE7` | Active link background, unread notification tint, icon tile base |

#### Semantic Status Clusters
Status colors are strictly categorized into semantic pairs (soft background tint + strong foreground text):

| Semantic State | Background Token | Text Token | Typical Usage |
|---|---|---|---|
| **Success / Positive** | `--teal-light` (`#E1F5EE`) | `--teal` (`#0F6E56`) | Selected, verified, high readiness, active drive |
| **Warning / Attention** | `--amber-light` (`#FAEEDA`) | `--amber` (`#854F0B`) | Pending action, review required, medium readiness |
| **Danger / Critical** | `--red-light` (`#FCEBEB`) | `--red` (`#A32D2D`) | Rejected, overdue deadline, error, irreversible action |
| **Info / Progress** | `--purple-light` (`#EEEDFE`) | `--purple` (`#534AB7`) | In progress, applied state, informational callout |

---

### 1.3 Global Typography (Inter)
All typography uses **Inter** (`font-family: 'Inter', system-ui, -apple-system, sans-serif`).

| Level | Size | Weight | Line Height | Color | Usage |
|---|---|---|---|---|---|
| **Display / Page Title** | `19–20px` | `600` (SemiBold) | `1.3` | `--text-primary` | Top-level screen headings |
| **Section Title** | `15–16px` | `600` (SemiBold) | `1.4` | `--text-primary` | Card titles, group headers |
| **Card Header / Subhead** | `13–14px` | `500` / `600` | `1.4` | `--text-primary` | Sub-section labels, modal titles |
| **Body Copy** | `14px` | `400` (Regular) | `1.6` | `--text-primary` | Descriptive paragraphs, explanations |
| **UI & Form Text** | `13px` | `400` (Regular) | `1.4` | `--text-primary` | Input values, table body cells, nav links |
| **Form Labels** | `12px` | `500` (Medium) | `1.3` | `--text-primary` | Input field labels, filter labels |
| **Table Column Headers** | `12px` | `500` (Medium) | `1.3` | `--text-secondary` | Uppercase/title case table headers |
| **Captions & Hints** | `11–12px` | `400` (Regular) | `1.4` | `--text-muted` | Input hints, timestamps, secondary meta |
| **Badges & Pills** | `11px` | `500` / `600` | `1.2` | Semantic token | Status badges, category tags |
| **KPI Metrics (Large)** | `20–24px` | `600` (SemiBold) | `1.2` | `--text-primary` | Metric counters, summary statistics |

---

### 1.4 Global Spacing & Layout Shells

#### Core Layout Shells
1. **Authenticated App Shell (Admin, Student, Super Admin) — "Chassis & Floating Screen"**
   - **Chassis:** `components/shared/app-shell.tsx`. Full-viewport `flex bg-black`; the sidebar and the bezels share one black background so they read as a single frame.
   - **Canvas:** the page sits in a rounded (`20px`) white canvas inset `py-2.5 pr-2.5 pl-0` — bezels on top, right and bottom, none on the left where it meets the sidebar. The canvas scrolls internally; the shell itself never scrolls.
   - **No header bar.** There is no topbar; notifications, settings, search and sign-out live in the sidebar.
   - **Sidebar (`components/shared/sidebar.tsx`)** has two states, remembered in `localStorage` (`campushire.sidebar.collapsed`):
     - *Dock* (`w-14`): brand button (opens the sidebar), then every nav section as an icon only — same icons and order as the expanded view, groups split by a hairline, active page highlighted, right-anchored tooltips (fixed-position so the scrolling dock can't clip them), unread dot on Notifications — and the user's initials pinned to the bottom, opening an account menu (Settings, Log out).
     - *Expanded* (`w-[260px]`): brand + search toggle + collapse; grouped nav (`text-neutral-200`, `rounded-xl`, 16px icons, active row `bg-neutral-900`); a bottom account card with avatar, name, role label and a Settings link. There is no "New …" primary-action button.
   - Page content keeps `--surface-*` tokens and hairline cards inside the white canvas.

2. **Public & Authentication Shell**
   - **Navbar:** Sticky topbar, `padding: 16px 40px`, `--surface-2` background, brand mark + nav links + CTA.
   - **Auth Container:** Centered single-column layout (`max-width: 380px; margin: 60px auto`).
   - **Auth Card:** `--surface-2` background, `0.5px solid var(--border)`, `border-radius: 12px`, `padding: 32px`.

#### Standard Dimensions & Radii
- **Hairline Borders:** `0.5px solid var(--border)` throughout (except dropzone: `1.5px dashed`).
- **Corner Radii Scale:**
  - `4px`: Mini chart bars, progress fills.
  - `8px` (`--radius`): Buttons, input fields, badges, sidebar links, tag chips, alert tiles.
  - `10px`: Company avatars.
  - `12px`: Standard content cards, auth panels, modal dialogs, metric tiles.
  - `14px`: Drive cards, feature cards.
  - `20px` / `999px`: Status pills, filter chips.
  - `50%`: Circular user avatars, gauge progress tracks, notification dots, toggle knobs.

---

### 1.5 Iconography System
- **Library:** Tabler Icons (Stroke-based, consistent `1.5px` - `2px` stroke weight).
- **Sizes:**
  - `14px`: Inline metric icons, alert icons.
  - `16px`: Sidebar navigation icons (`.ic` fixed width), button icons, feature tiles.
  - `18px`: Topbar action icons (notifications, search).
  - `20–24px`: Primary empty state / modal headers.
- **Rule:** Stroke icons only. Never mix filled, two-tone, or 3D icons.

---

## 2. Student-Facing Component System

> **Design Personality:** Encouraging, warm, clear, with subtle spring/bounce easing (`EASE_STUDENT`) to make milestones feel rewarding.

### 2.1 Placement Drive Card (`.drive-card`)
- **Structure:** Standalone elevated card showing company drive info, eligibility, package, and application state.
- **Style:**
  - Background: `--surface-2` (pure white)
  - Border: `0.5px solid var(--border)`
  - Radius: `14px`
  - Padding: `18px`
- **Internal Elements:**
  - Company Avatar: `44×44px`, `10px` radius, centered logo or company initials on `--surface-1`.
  - Role Title: `15px`, `font-weight: 600`, `--text-primary`.
  - Company & CTC: `13px`, `--text-secondary` with package highlighted in `--text-primary`.
  - Status Badge: Top-right aligned semantic badge (e.g., `.status-progress`, `.status-applied`).
  - Application Stepper: Horizontal mini progress indicator showing drive rounds (Aptitude → Tech Interview → HR → Offer).
- **Interactions:**
  - Hover: Subtle border contrast increase, instant cursor pointer.
  - Entrance: `CampusMotion.fadeInUp` with `EASE_STUDENT` (`cubic-bezier(0.34, 1.56, 0.64, 1)`), staggered by `100ms`.

### 2.2 Readiness Circular Gauge (`.gauge`, `.gauge-inner`)
- **Structure:** Large circular radial score meter for readiness indices.
- **Style:**
  - Outer Ring (`.gauge`): `140×140px`, circular (`50%` radius), conic gradient background:
    `conic-gradient(var(--accent) calc(var(--pct, 70) * 1%), var(--border) 0)`
  - Inner Cutout (`.gauge-inner`): `104×104px`, circular, background `--surface-2`, centered.
  - Center Text: `24px` bold percentage (`600` weight) + `11px` `--text-muted` caption ("Readiness Index").
- **Motion:** Animated fill on page enter paired with a numeric count-up from `0%` to target value over `800ms`.

### 2.3 Student Metric & Progress Cards (`.metric-card`)
- **Structure:** Recessed quick-stats block for individual skills or profile completion.
- **Style:**
  - Background: `--surface-1` (warm recessed beige)
  - Border: None
  - Radius: `12px`
  - Padding: `14px 16px`
- **Progress Track (`.progress-track`):** Height `6px`, background `--border`, `3px` radius, overflow hidden.
- **Progress Fill (`.progress-fill`):** Height `100%`, smooth semantic fill (Terracotta for profile, Teal for readiness, Amber for resume score).
- **Motion:** `CampusMotion.riseIn` from `0%` to designated width on load.

### 2.4 Readiness Trend Bar Chart (`.trend-chart`)
- **Structure:** Historical readiness performance over sequential mock tests.
- **Style:**
  - Container: Flex align-end, `gap: 10px`, `height: 110px`, `padding-top: 10px`.
  - Background Pillar (`.trend-bar`): Flex 1, background `--border`, `height: 90px`, `radius: 4px 4px 0 0`.
  - Active Fill (`.trend-bar-fill`): Width `100%`, background `--accent`, `radius: 4px 4px 0 0`.
  - Label (`.trend-label`): `10px`, `--text-muted`, centered below each bar.
- **Motion:** Staggered vertical rise animation (`riseIn(bars, 'height')`).

### 2.5 Multi-Stage Application Stepper (`.stepper`)
- **Structure:** Interactive or visual stage tracker for recruitment rounds.
- **Style:**
  - Step Dot (`.step-dot2`): `20×20px` circle, `10px` bold number, `#fff` text.
    - Default/Upcoming: Background `--border-strong`.
    - Current Active: Background `--accent`, surrounded by `box-shadow: 0 0 0 3px var(--accent-light)`.
    - Completed: Background `--teal` (`#0F6E56`) with check icon.
  - Connector Line (`.step-line2`): `2px` height, background `--border-strong` (or `--teal` when completed).
  - Step Label: `9px`, `--text-secondary`, `margin-top: 6px`.

### 2.6 Student Profile Tabbed Navigation (`.profile-layout`)
- **Structure:** Split layout with sticky side-tab switcher on the left and full section forms on the right.
- **Style:**
  - Grid: `190px 1fr`, `gap: 24px`, top-aligned.
  - Tab Button (`.profile-tab`): `padding: 9px 12px`, `font-size: 13px`, `--text-secondary`, `border-radius: 8px`.
  - Tab Hover: Background `--surface-1`.
  - Tab Active: Background `--accent-light`, text `--accent-dark`, `font-weight: 500`.

---

## 3. Admin & Super-Admin Component System

> **Design Personality:** Data-dense, high-efficiency, crisp, with snappy ease-out transitions (`EASE_ADMIN`) optimized for rapid scanning and bulk management.

### 3.1 Data Tables (`table`, `th`, `td`)
- **Structure:** Full-width responsive tabular views for student lists, drive registrations, user accounts, and audit trails.
- **Style:**
  - Container: `--surface-2` (white), `0.5px solid var(--border)`, `border-radius: 12px`, overflow hidden.
  - Table: `width: 100%`, `border-collapse: collapse`, `font-size: 13px`.
  - Header Row (`th`): `padding: 10px 8px`, `--text-secondary`, `font-weight: 500`, `font-size: 12px`, text-align left, baseline `0.5px solid var(--border-strong)`.
  - Data Cells (`td`): `padding: 10px 8px`, `--text-primary`, border-bottom `0.5px solid var(--border)`, vertical-align middle. Last row has no bottom border.
  - Row Hover: Background tint `--surface-0` for immediate row tracking.
  - Action Links (`.row-actions a`): `13px`, `--text-secondary`, inline icons, hover color `--accent`.

### 3.2 Admin KPI Summary Tiles (`.kpi-card`)
- **Structure:** Top-of-dashboard performance summary cards (total placed, active drives, batch average readiness).
- **Style:**
  - Background: `--surface-2` (white)
  - Border: `0.5px solid var(--border)`
  - Radius: `12px`
  - Padding: `14px 16px`
  - Metric Value: `20px` bold (`font-weight: 600`), `--text-primary`.
  - Label: `12px`, `--text-secondary`, `font-weight: 500`.
  - Trend Badge: Sub-metric in green/red font indicating month-over-month delta.
- **Motion:** `CampusMotion.scaleIn` (`scale(0.85) → 1`, `opacity 0 → 1`) + animated `countUp` on the numeric value.

### 3.3 Attention & Urgent Action Items (`.attn-item`)
- **Structure:** Highlighted actionable alert rows on the operator home screen (pending approvals, unplaced student threshold warnings).
- **Style:**
  - Container: Flex layout, `gap: 10px`, `padding: 10px 12px`, `border-radius: 8px`, `border: 0.5px solid var(--border)`.
  - Icon Tile (`.attn-icon`): `28×28px`, `border-radius: 7px`, flex centered.
    - Urgent: Background `--red-light`, icon `--red`.
    - Pending: Background `--amber-light`, icon `--amber`.
    - Informational: Background `--surface-1`, icon `--text-secondary`.
  - Content: `12px` title (`font-weight: 500`) with `11px` `--text-muted` helper.

### 3.4 Activity Feed & Audit Streams (`.activity-item`)
- **Structure:** Chronological timeline rows of system actions and student updates.
- **Style:**
  - Row: Flex layout, `gap: 10px`, `padding: 9px 0`, border-bottom `0.5px solid var(--border)`, `font-size: 12px`.
  - Timeline Dot (`.activity-dot`): `6×6px` circle, background `--accent`, top-aligned (`margin-top: 6px`).
  - Timestamp: Right-aligned or secondary caption in `11px`, `--text-muted`.

### 3.5 Drag & Drop File Upload (`.dropzone`)
- **Structure:** Bulk student/drive data import zone.
- **Style:**
  - Background: `--surface-0` (soft parchment)
  - Border: `1.5px dashed var(--border-strong)`
  - Radius: `12px`
  - Padding: `32px`
  - Alignment: Centered icon, `13px` primary prompt, `11px` `--text-muted` file constraint caption (.xlsx, .csv up to 10MB).
  - Hover: Border color shifts to `--accent` with background `--accent-light`.

### 3.6 Toggle Switches & Setting Rows (`.pref-row`, `.toggle-switch`)
- **Structure:** System and privacy preference controls.
- **Style:**
  - Row (`.pref-row`): Flex layout, `justify-content: space-between`, `align-items: center`, `padding: 12px 0`, border-bottom `0.5px solid var(--border)`.
  - Switch Track (`.toggle-switch`): `38×22px`, `border-radius: 12px`, background `--border-strong`, position relative, cursor pointer.
  - Active Track (`.toggle-switch.on`): Background `--accent`.
  - Knob (`.toggle-switch .knob`): `18×18px` circle, `#FFFFFF`, position absolute, `top: 2px; left: 2px; transition: left 0.15s ease`.
  - Active Knob (`.toggle-switch.on .knob`): `left: 18px`.

### 3.7 Danger Zone Panels (`.danger-zone`)
- **Structure:** Visual isolation box for irreversible operations (purge logs, delete department, reset credentials).
- **Style:**
  - Background: `--red-light` (`#FCEBEB`)
  - Border: `0.5px solid var(--red)` (`#A32D2D`)
  - Radius: `12px`
  - Padding: `16px`
  - Action Button: `.btn` with destructive red styling.

---

## 4. Public & Authentication Component System

### 4.1 Auth Card & Form Container
- **Style:**
  - Container: `max-width: 380px`, `margin: 60px auto`.
  - Card: Background `--surface-2` (white), `border: 0.5px solid var(--border)`, `border-radius: 12px`, `padding: 32px`.
  - Brand Mark: `18×18px` square terracotta dot (`5px` radius) paired with `18px` bold title.
  - Footer Link: Centered `12px` navigation hint ("Don't have an account? Sign up").

### 4.2 OTP Verification Digit Grid (`.otp-boxes`)
- **Style:**
  - Container: Flex centered, `gap: 10px`, `margin: 20px 0`.
  - Digit Input (`.otp-box`): `44×52px`, `border: 0.5px solid var(--border-strong)`, `border-radius: 8px`, `font-size: 18px`, `font-weight: 600`, text-align center, background `--surface-2`.
  - Focus: Immediate browser outline / high-contrast border.

### 4.3 Oxford Auth Shell (Sign In / Sign Up only)

> **Scope:** `/sign-in` and `/sign-up` only. This is a deliberate second
> visual language, not a replacement for §1–3's terracotta/parchment system —
> confirmed with the user when it was introduced. It never bleeds into the
> rest of the app because every rule is scoped under `.auth-shell`
> (`components/auth/auth-shell.css`). `/accept-invitation` keeps the app theme.

- **Structure:** `app/(auth)/(split)/layout.tsx` renders
  `components/auth/auth-shell.tsx`, which stays mounted across `/sign-in` ↔
  `/sign-up` (the pages only set metadata), so switching animates instead of
  reloading. Full-viewport black page with a faint 48px grid; 2px bezel
  (`#0A0A0A`, gold hairline) with a slow gold conic light sweep (8s loop);
  white card (20px radius) with a 6-column hairline grid; two form panels and
  a navy→gold gradient tile covering the other half.
- **Motion:** the tile and both form panels slide 800ms
  `cubic-bezier(.65,0,.35,1)`; the forms swap opacity at 340ms while covered by
  the tile; the tile copy staggers out (0/40/80ms) and back in
  (470/560/650ms). `prefers-reduced-motion` disables the slide and sweep.
- **Auth logic stays Clerk's.** Each panel renders Clerk's own
  `<SignIn>`/`<SignUp>` with `routing="hash"`; the outgoing form unmounts
  after the 900ms slide so the two never share the URL hash mid-flow (email
  code, reset password). Clerk still owns credentials, OAuth, OTP and session
  — see `architecture.md`'s "session and identity always come from Clerk"
  invariant. Switching keeps `?redirect_url`.
- **Clerk styling:** via Clerk's stable `cl-*` classes in `auth-shell.css`
  (not `appearance`). Google button = black pill with gold glow; submit =
  Oxford-blue pill with light-blue glow (52px, 999px radius); hover slides the
  glow down and lifts the button 2px. Inputs = 8px radius, `#E2E2E2` border,
  blue focus ring. Labels are visually hidden (placeholders shown);
  "Forgotten password?" sits centred under the password field. Clerk's header
  is hidden on the first step only (the shell supplies the heading); later
  steps keep Clerk's heading and hide the shell's. Wording overrides are in
  `ClerkProvider localization` (`app/layout.tsx`).
- **Local palette** (`--ox-*` custom properties on `.auth-shell`, not the
  app-wide tokens): Oxford blue `#002147` / hover `#012C5E`, gold `#C39A67`,
  ink `#0F0F0F`, bezel `#0A0A0A`, white card, neutrals `#E6E6E6`–`#8C8C8C`.
  Headings set their colour explicitly because the global h1–h6 rule beats
  inheritance.
- **Font:** Schibsted Grotesk via `next/font` (`--font-auth`), auth routes only.
- **Tile CTA:** white pill button (min 220×52px), navy 600 text, switching to
  the other auth route.
- **Responsive:** at `900px` and below the tile is hidden, a single form goes
  full width, and Clerk's footer link ("Don't have an account? Sign up")
  switches between the two routes.

### 4.4 Public Landing Feature Cards (`.icon-tile`)
- **Style:**
  - Feature Card: Background `--surface-2`, `0.5px solid var(--border)`, `14px` radius, `padding: 24px`.
  - Icon Tile (`.icon-tile`): `34×34px`, `8px` radius, flex centered, `font-size: 16px`, `margin-bottom: 12px`.
  - Color Variants: Background `--accent-light` / `--teal-light` / `--amber-light` with matching icon text color.

---

## 5. Universal Micro-Components & Interaction Elements

### 5.1 Buttons (`.btn`)
All buttons share base styles: `display: inline-flex; align-items: center; justify-content: center; gap: 6px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; text-decoration: none`.

| Variant | Class | Background | Text Color | Border | Hover State |
|---|---|---|---|---|---|
| **Primary** | `.btn.btn-primary` | `--accent` (`#D85A30`) | `#FFFFFF` | None | Background `--accent-dark` (`#712B13`) |
| **Outline / Secondary** | `.btn.btn-outline` | `transparent` | `--text-primary` | `0.5px solid var(--border-strong)` | Background `--surface-1` |
| **Small** | `.btn.btn-sm` | Contextual | Contextual | Contextual | `padding: 7px 12px; font-size: 12px` |

### 5.2 Status Badges & Filter Pills
- **Standard Badges (`.badge-*`):** `padding: 2px 9px`, `border-radius: 8px`, `font-size: 11px`, `font-weight: 500`.
  - `.badge-green`: Background `--teal-light`, text `--teal`.
  - `.badge-amber`: Background `--amber-light`, text `--amber`.
  - `.badge-red`: Background `--red-light`, text `--red`.
- **Drive Status Badges (`.drive-status-badge`):** `padding: 4px 12px`, `border-radius: 20px`, `font-size: 11px`, `font-weight: 600`.
- **Filter Pills (`.filter-pill`):** `padding: 6px 14px`, `border-radius: 16px`, `font-size: 12px`, `border: 0.5px solid var(--border-strong)`, background `--surface-2`.
  - Active Filter Pill (`.filter-pill.active`): Background `--text-primary`, text `#FFFFFF`, border-color `--text-primary`.

### 5.3 Form Inputs & Fields (`.field`)
- **Field Group (`.field`):** `margin-bottom: 16px`.
- **Label:** `12px`, `font-weight: 500`, `--text-primary`, `margin-bottom: 6px`, `display: block`.
- **Input / Select / Textarea:** `width: 100%`, `padding: 10px 12px`, `border: 0.5px solid var(--border-strong)`, `border-radius: 8px`, `font-size: 13px`, background `--surface-2`, `--text-primary`.
- **Field Row (`.field-row`):** Grid 2-column layout (`grid-template-columns: 1fr 1fr; gap: 14px`).
- **Tag Input (`.tag-input`):** Flex wrap, `gap: 6px`, `padding: 8px`, `border: 0.5px solid var(--border-strong)`, `border-radius: 8px`.
  - Tag Chip (`.tag`): Background `--surface-1`, `padding: 3px 10px`, `border-radius: 8px`, `12px` font with remove handle `i`.

---

## 6. Motion, Animation & Interaction Specs

### 6.1 Easing Curves & Engine
All motion is driven by `motion.js` utilizing native Web Animations API (`Element.animate()`) with zero external dependencies.

| Engine Token | Bezier Definition | Applied Context |
|---|---|---|
| `EASE_ADMIN` | `cubic-bezier(0.22, 1, 0.36, 1)` | Admin & Super Admin: snappy ease-out, zero bounce |
| `EASE_STUDENT` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Student surfaces: slight spring overshoot for celebration |

### 6.2 Animation Primitives (`CampusMotion`)
1. **`fadeInUp(elements, options)`**
   - Keyframes: `opacity: 0, translateY(16px)` → `opacity: 1, translateY(0)`.
   - Duration: `450ms` default (stagger: `80–100ms`).
   - Use: Drive cards, metric tiles, activity feed items.
2. **`scaleIn(elements, options)`**
   - Keyframes: `opacity: 0, scale(0.85)` → `opacity: 1, scale(1)`.
   - Duration: `450ms` (stagger: `70ms`).
   - Use: Top-level summary KPI tiles.
3. **`riseIn(elements, axis, options)`**
   - Keyframes: Reads inline style → animates from `0%` to target `width` or `height`.
   - Duration: `700ms` (stagger: `40–70ms`).
   - Use: Horizontal progress bars (`axis: 'width'`), vertical trend bars (`axis: 'height'`).
4. **`countUp(element, targetValue, options)`**
   - Easing: Hand-rolled ease-out cubic over `700–900ms`.
   - Use: Animated numeric counters on page load.
5. **`pulse(element)`**
   - Keyframes: `scale(1)` → `scale(1.025)` → `scale(1)` over `400ms`.
   - Use: Programmatic feedback on live real-time data updates.

### 6.3 Accessibility & Reduced Motion
Every motion trigger verifies `window.matchMedia('(prefers-reduced-motion: reduce)').matches`. When enabled:
- Animations are skipped completely.
- Final states and numeric targets render instantaneously without layout shifting.

---

## 7. Interactive State Matrix (Hover, Focus, Active)

| Component | Default State | Hover State | Focus / Active State |
|---|---|---|---|
| **Primary Button** | Background `--accent`, text `#fff` | Background `--accent-dark` | Active press: opacity `0.95` |
| **Outline Button** | Transparent, border `--border-strong` | Background `--surface-1` | Border `--text-primary` |
| **Sidebar Link** | Transparent, text `--text-secondary` | Background `--surface-1` | `.active`: bg `--accent-light`, text `--accent-dark`, font `500` |
| **Navbar Link** | Text `--text-secondary` | Text `--text-primary` | Link underline or bold state |
| **Table Row** | Background `transparent` | Background `--surface-0` | Row select checkbox highlight |
| **Profile Tab** | Transparent, text `--text-secondary` | Background `--surface-1` | `.active`: bg `--accent-light`, text `--accent-dark`, font `500` |
| **Input Field** | Border `--border-strong`, bg `--surface-2` | Border `--border-strong` | Browser default outline ring |
| **Toggle Switch** | Background `--border-strong` | Cursor pointer | `.on`: background `--accent` |
| **Filter Pill** | Background `--surface-2`, border `--border-strong` | Background `--surface-1` | `.active`: bg `--text-primary`, text `#fff` |

---

## 8. Integration-Added React Components (FE-01 through FE-09)

> **Context:** These components were built during the 9-unit frontend integration (FE-01 through FE-09) to replace temp frontend components with real Next.js implementations. All follow the CSS class system defined in this document.

### 8.1 DatePicker (`components/ui/DatePicker.tsx`)
- **Purpose:** Date selection input for filters and forms (audit log date ranges, drive deadlines).
- **Props:**
  - `value: Date | null` — Currently selected date.
  - `onChange: (date: Date | null) => void` — Callback when date changes.
  - `placeholder?: string` — Optional placeholder text (default: "Select date").
  - `disabled?: boolean` — Disable interaction.
- **Style:**
  - Uses browser-native `<input type="date">` for accessibility.
  - Wrapped in `.field` CSS class for consistent form styling.
  - Border: `0.5px solid var(--border-strong)`, radius `8px`, padding `10px 12px`.
- **Integration:** Used in audit log filters, drive posting forms, and report date ranges.

### 8.2 UrlField (`components/ui/UrlField.tsx`)
- **Purpose:** URL input with validation and external link indicator.
- **Props:**
  - `value: string` — Current URL value.
  - `onChange: (value: string) => void` — Callback when URL changes.
  - `placeholder?: string` — Optional placeholder text.
  - `label?: string` — Optional field label.
  - `error?: string` — Validation error message to display.
- **Style:**
  - Input field follows `.field` styling with `type="url"`.
  - External link icon (Tabler Icons `IconExternalLink`, `14px`) appears when valid URL entered.
  - Error state: border color `--red`, error text `11px`, `--red`.
- **Integration:** Used in student profile forms (LinkedIn, portfolio URLs).

### 8.3 TagInput (`components/ui/TagInput.tsx`)
- **Purpose:** Multi-value input for skills, tags, and categorization.
- **Props:**
  - `value: string[]` — Array of current tags.
  - `onChange: (tags: string[]) => void` — Callback when tags change.
  - `placeholder?: string` — Placeholder text for empty state.
  - `label?: string` — Optional field label.
- **Style:**
  - Container (`.tag-input`): Flex wrap, `gap: 6px`, `padding: 8px`, border `0.5px solid var(--border-strong)`, radius `8px`.
  - Tag Chip (`.tag`): Background `--surface-1`, `padding: 3px 10px`, `border-radius: 8px`, `font-size: 12px`.
  - Remove Button: Tabler Icons `IconX` (`10px`), cursor pointer, color `--text-muted`, hover `--red`.
- **Integration:** Used in student profile (skills, certifications), drive posting (required skills).

### 8.4 ProgressBar (`components/ui/ProgressBar.tsx`)
- **Purpose:** Linear progress indicator for profile completion, readiness scores, and task tracking.
- **Props:**
  - `value: number` — Progress percentage (0–100).
  - `variant?: 'primary' | 'success' | 'warning' | 'danger'` — Color theme.
  - `showLabel?: boolean` — Display percentage text inside bar.
  - `height?: number` — Custom height in pixels (default: `6px`).
- **Style:**
  - Track (`.progress-track`): Background `--border`, height `6px`, `border-radius: 3px`, overflow hidden.
  - Fill (`.progress-fill`): Height `100%`, width `${value}%`, transition `width 0.3s ease`.
  - Variants:
    - `primary`: Background `--accent` (terracotta).
    - `success`: Background `--teal`.
    - `warning`: Background `--amber`.
    - `danger`: Background `--red`.
- **Motion:** Animated from `0%` to target width on mount using `CampusMotion.riseIn`.
- **Integration:** Used in student dashboard (profile completion), readiness dashboard (skill scores).

### 8.5 Pagination (`components/ui/Pagination.tsx`)
- **Purpose:** Table pagination controls with page size selector.
- **Props:**
  - `page: number` — Current page (1-indexed).
  - `pageSize: number` — Items per page.
  - `totalCount: number` — Total items across all pages.
  - `onPageChange: (page: number) => void` — Callback when page changes.
  - `onPageSizeChange?: (pageSize: number) => void` — Optional callback for page size change.
- **Style:**
  - Container: Flex layout, `justify-content: space-between`, `align-items: center`, `padding: 12px 16px`, border-top `0.5px solid var(--border)`.
  - Page Info: `12px`, `--text-secondary` (e.g., "Showing 1-10 of 42").
  - Page Buttons: `.btn.btn-sm.btn-outline` styling, disabled state with `opacity: 0.5`.
  - Page Size Select: `<select>` with `.field` styling, options: 10, 25, 50, 100.
- **Integration:** Used in all data tables (student roster, drive applications, audit log, notifications).

### 8.6 StatusBadge (`components/ui/StatusBadge.tsx`)
- **Purpose:** Semantic status pill with consistent color coding across the app.
- **Props:**
  - `variant: 'green' | 'amber' | 'red' | 'purple' | 'gray'` — Color theme.
  - `children: React.ReactNode` — Badge text/content.
  - `size?: 'sm' | 'md'` — Size variant (default: `md`).
- **Style:**
  - Base: `padding: 2px 9px` (sm), `4px 12px` (md), `border-radius: 8px` (sm) or `20px` (md), `font-size: 11px`, `font-weight: 500`.
  - Variants:
    - `green`: Background `--teal-light`, text `--teal` (Success, Active, Placed).
    - `amber`: Background `--amber-light`, text `--amber` (Pending, Review, In Progress).
    - `red`: Background `--red-light`, text `--red` (Rejected, Closed, Error).
    - `purple`: Background `--purple-light`, text `--purple` (Applied, Info, Processing).
    - `gray`: Background `--surface-1`, text `--text-secondary` (Inactive, Draft, Neutral).
- **Integration:** Replaces all custom badge implementations. Used for drive status, application status, user roles, audit log actions.

### 8.7 KpiCard (`components/admin/KpiCard.tsx`)
- **Purpose:** Top-of-dashboard metric summary tiles for admins.
- **Props:**
  - `title: string` — Metric label.
  - `value: number | string` — Primary metric value.
  - `icon: React.ReactNode` — Tabler Icons component (`16px`).
  - `trend?: { value: number; label: string }` — Optional trend indicator (e.g., "+12% vs last month").
  - `variant?: 'default' | 'success' | 'warning' | 'danger'` — Color accent for icon tile.
- **Style:**
  - Card: Background `--surface-2`, border `0.5px solid var(--border)`, radius `12px`, padding `14px 16px`.
  - Icon Tile: `28×28px`, `border-radius: 7px`, flex centered, background based on variant.
  - Metric Value: `20px`, `font-weight: 600`, `--text-primary`.
  - Label: `12px`, `--text-secondary`, `font-weight: 500`.
  - Trend Badge: `11px`, color `--teal` (positive) or `--red` (negative).
- **Motion:** `CampusMotion.scaleIn` entrance animation + `countUp` on numeric values.
- **Integration:** Used in admin dashboard home and super admin dashboard (total students, active drives, placement rate).

### 8.8 DepartmentScopeBanner (`components/admin/DepartmentScopeBanner.tsx`)
- **Purpose:** Role-scoped notification banner for department admins showing their assigned department.
- **Props:**
  - `departmentName: string` — Name of admin's assigned department.
  - `variant?: 'default' | 'compact'` — Display size (default shows full message, compact shows icon + name).
- **Style:**
  - Container: Background `--teal-light`, border `0.5px solid var(--teal)`, radius `8px`, padding `10px 12px`.
  - Icon: Tabler Icons `IconInfoCircle` (`16px`), color `--teal`.
  - Text: `12px`, `font-weight: 500`, `--teal`.
  - Message: "You are managing {departmentName} department. All views and actions are scoped to this department."
- **Integration:** Renders at top of all dept admin pages (dashboard home, student roster, drives). Integrated in FE-05/FE-06.

### 8.9 CSV Export Utility (`lib/utils/csv-export.ts`)
- **Purpose:** Client-side CSV generation and download for admin reports.
- **Functions:**
  - `exportToCsv<T>(data: T[], filename: string, columns: ColumnDef<T>[]): void`
    - Generates CSV from typed data array.
    - `columns` array defines headers and field extraction.
    - Creates blob, triggers browser download with `filename.csv`.
- **Integration:** Used in student roster export, drive applications export, global reports export (super admin).
- **Column Definition Example:**
  ```typescript
  const columns: ColumnDef<Student>[] = [
    { header: 'Roll No', accessor: (s) => s.rollNo },
    { header: 'Name', accessor: (s) => s.name },
    { header: 'Email', accessor: (s) => s.email },
    { header: 'CGPA', accessor: (s) => s.cgpa.toString() }
  ];
  ```

### 8.10 Component Usage Patterns

**Form Field Pattern:**
```tsx
<div className="field">
  <label>Field Label</label>
  <DatePicker value={startDate} onChange={setStartDate} />
</div>
```

**Filter Panel Pattern:**
```tsx
<div className="card">
  <div className="field-row">
    <div className="field">
      <label>Start Date</label>
      <DatePicker value={startDate} onChange={setStartDate} />
    </div>
    <div className="field">
      <label>End Date</label>
      <DatePicker value={endDate} onChange={setEndDate} />
    </div>
  </div>
  <div className="btn-row">
    <button className="btn btn-primary">Apply Filters</button>
    <button className="btn btn-outline">Clear</button>
  </div>
</div>
```

**Data Table with Pagination Pattern:**
```tsx
<div className="table-wrap">
  <table>
    <thead>
      <tr>
        <th>Column 1</th>
        <th>Column 2</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      {data.items.map(item => (
        <tr key={item.id}>
          <td>{item.name}</td>
          <td>{item.value}</td>
          <td><StatusBadge variant="green">Active</StatusBadge></td>
        </tr>
      ))}
    </tbody>
  </table>
  <Pagination
    page={page}
    pageSize={pageSize}
    totalCount={totalCount}
    onPageChange={setPage}
    onPageSizeChange={setPageSize}
  />
</div>
```

---

### 8.11 Drive Workflow Patterns

- **Step wizard.** A multi-step configuration is a row of `btn btn-sm` step buttons (`btn-primary` for the current step, `btn-outline` otherwise) with a ✓ on completed steps and `aria-current="step"` on the current one. Completion comes from the server's readiness result, not from client state, and the wizard opens at the first incomplete step. The create-drive dialog uses the same idea with `badge` chips (`badge-purple` current, `badge-teal` done, `badge-gray` upcoming).
- **Save draft / continue.** Every step ends with a `card` footer: an unsaved/saved status line, "Save draft" (`btn-outline`) and "Save & continue →" (`btn-primary`). Publishing is its own final step with a checklist (✅ done, ⚠️ with the issues listed, ⛔ blocking) and a disabled button until the server-computed readiness is clean and nothing is unsaved.
- **Locked vs editable.** A field the Super Admin locked shows its master value as plain text with a `badge-gray` "🔒 Set by the Super Admin"; an editable one shows the input with an Inherited / Overridden badge. In permission lists, `badge-teal` EDITABLE and `badge-gray` LOCKED beside a checkbox. A disabled input is guidance only — the server enforces the rule.
- **Lifecycle badges.** ASSIGNED/ARCHIVED `badge-gray`, CONFIGURED `badge-purple`, PUBLISHED `badge-green`, CLOSED and CANCELLED `badge-red`. Students see "Cancelled" (red `StatusBadge`) on a cancelled drive and in their applications, with the reason on the drive page.
- **Destructive confirmations.** Cancel and deadline extension expand an inline panel (reason `textarea`, at least 5 characters; a `datetime-local` input for the deadline) with a primary confirm button and a "Back" outline button. The reason is shown to affected people, so the placeholder says so.
- **Pipeline editing.** `PipelineEditor` is the one stage editor (Super Admin master stages, department proposals, drafts). A proposal always asks for a reason and shows any pending request as a ⏳ note; the current stages stay visible until it is approved.

### 8.12 Drive Workspace Patterns

- **URL tabs.** A workspace's tabs are links (`?tab=`), not client state, so each tab is shareable and only the open tab's data loads. Same look as 8.11's tab bar (accent underline on the current tab), with `role="tablist"` / `role="tab"`.
- **Filter bar.** Search input plus `select`s in one wrapping row, a "Clear filters" ghost button when any is active, the result count on the right and the export on the far right. Lists filter in the URL when the server pages them (applications, placements) and in memory when the whole set is loaded (students).
- **Bulk actions.** Selecting rows reveals a toolbar card (count, outcome, target stage, note, "Review…"). "Review" opens a dialog that shows what would move and what would not and why; the confirm button states the number that will actually move; the result lists every success and every failure. Only movable rows have a checkbox.
- **Placement confirmation.** A dialog that lists exactly what is recorded, the three consequences (permanent exclusion, history kept, audited), and a required acknowledgement checkbox before the primary button enables.
- **Read-only history.** Stage history opens inline under its row as an ordered list (from → to · outcome · when · who · pipeline version · note). Activity is a dot-list newest first, with an empty state.
- **Permission denied.** `PermissionDenied`: a centred card with a lock, one plain sentence and a way back. It never says whether the record exists.

### 8.13 Notification & Announcement Patterns

- **The centre lives under each role's dashboard** (`/student-dashboard/notifications`, `/admin-dashboard/notifications`, `/super-admin-dashboard/notifications`), so it carries that role's navigation; `/notifications` redirects. One component, three sets of copy.
- **Tabs are filters in the URL**: All, Unread, Drive, Application, Recruitment, Announcement, System, each with its unread count, as `filter-pill`s with `role="tablist"`.
- **Priority is a badge, not a colour guess**: URGENT `badge-red`, ACTION_REQUIRED `badge-accent`, WARNING `badge-amber`, INFO `badge-purple`, SUCCESS `badge-green`. An urgent or action-required row keeps a red left spine so it stays findable once it drops out of "Needs your attention".
- **Rows**: unread rows carry the accent background and a dot; the body opens the resource (the producer's own link for that role), with a separate "Mark read"/"Mark unread" ghost button on the right so reading and opening are different acts.
- **Preferences** sit at the foot of the centre (and on the student's settings page) as a list of checkboxes — only the events that role may mute, each with a plain sentence. The footnote states that CampusHire notifies in-app only and that urgent announcements always arrive.
- **Announcements** are cards (priority badge, scope and batch line, title, excerpt, author and time, attachment marker) linking to a full page that renders the text as text, never as markup.
- **Composing** is one card: title, body, then scope controls (department, audience, batches, priority) that only the Super Admin sees, publish/expiry times and an attachment. Two buttons: "Save draft" (outline) and "Publish now"/"Schedule" (primary). The managed list below shows status badges (`badge-gray` draft/archived, `badge-amber` scheduled, `badge-green` published) with Edit, Publish and Archive.
- **Deliveries** (Super Admin) is a `table-wrap` of fan-outs with status, how many were notified, attempts, the error and a "Re-send" button; the copy says plainly that re-sending skips anyone already notified.

### 8.14 Settings & Admin Account Patterns

- **Settings are sectioned, not scrolled.** A left column of `filter-pill` buttons (`aria-current`) switches one card at a time. Every role has its own page under its own dashboard.
- **Editable, read-only and role-restricted look different.** An editable setting is a `field` with an input; something another role owns is a label/value row with a line saying who sets it (a department admin sees the placement season, greyed, and knows why a drive date was refused); identity and password are a sentence plus a link to the sign-in provider, never a form.
- **Every setting says when it takes effect** — "prefilled into new drives", "applies to drives created from now on", "a drive you have already published is unchanged". A saved card shows when it was last changed and by whom.
- **Admin accounts is one table of people and invitations**: `badge-amber` invited, `badge-green` active, `badge-gray` disabled, with the history in its own column (invited when and by whom, resent count, accepted, disabled when, by whom and why).
- **Inviting says what it does**: "they get an email from the sign-in provider and choose their own password; CampusHire never creates or sends one", so nobody waits for a password to pass on.
- **Disabling is a dialog, not a confirm**: it lists what survives (account, drives published, applications moved, audit entries) and takes an optional reason that is shown to the admin.

### 8.15 Action-Required, Filter & Export Patterns

- **Action required** is the first card on each dashboard: a list of linked rows, each a priority badge (`badge-red` urgent with a red left spine, `badge-amber` soon, `badge-gray` to do), a bold title, a one-line reason and an arrow. Nothing waiting shows "✓" and a plain sentence, never a blank card.
- **Filters** live in one wrapping row above the list: search, then `select`s, then date inputs, with "Clear" only while any filter is active. Server-paged lists put filters in the URL so a filtered view is a link; the Super Admin's applications page uses a plain GET form for the same reason.
- **Export** is a `select` of dataset names and a "Download CSV" button. While the file is built the button says "Preparing…"; an empty dataset says so in a toast rather than downloading a header-only file; a refusal states why. The per-table export is labelled "Export this page" so nobody mistakes it for the whole dataset.
- **Reminder** is a ghost button that expands to an inline confirmation stating who it reaches and that it goes out once a day.

---

## 9. Screen Inventory Reference

| Module | Screens & File References |
|---|---|
| **Public** | `index.html` (Landing), `login.html`, `register.html`, `otp-verification.html`, `reset-password.html` |
| **Student** | `student-dashboard.html`, `student-profile.html`, `readiness-dashboard.html`, `notifications.html`, `settings.html` |
| **Admin** | `admin-home.html`, `admin-dashboard.html` (Student Directory), `add-student.html`, `excel-upload.html`, `post-drive.html`, `announcements.html`, `reports-analytics.html` |
| **Super Admin** | `super-admin-dashboard.html`, `department-management.html`, `admin-accounts.html`, `system-settings.html`, `global-reports.html`, `audit-log.html`; built since the prototype: Central Drives (create wizard, permissions, stages, assignment console, cancel / extend deadline) Pipeline Requests, Placements (global, read-only), Announcements and Notification Deliveries; Department Admin: Drive workspace (Overview, Eligibility, Eligible / Registered Students, Applications, Recruitment Pipeline, Placement, Activity); every role: its own Notifications centre and Announcements |
| **Shared Assets** | `styles.css` (Design tokens & layout rules), `motion.js` (Web Animations API engine), `drive-data.js` (Mock placement drive records) |
