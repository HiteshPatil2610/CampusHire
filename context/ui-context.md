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
1. **Authenticated App Shell (Admin, Student, Super Admin)**
   - **Structure:** 2-column layout (`grid-template-columns: 220px 1fr; min-height: 100vh; background: var(--surface-0)`).
   - **Sidebar:** Fixed `220px` width, `--surface-2` (white) background, `0.5px solid var(--border)` right border, `padding: 20px 14px`. Bottom navigation (Settings, Logout) pinned via `margin-top: auto`.
   - **Topbar:** Sticky top header, `--surface-2` background, `0.5px solid var(--border)` bottom border, `padding: 14px 28px`, right-aligned action icons & profile avatar.
   - **Content Canvas:** Main scrollable workspace, `padding: 28px 32px`.

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

### 4.3 Public Landing Feature Cards (`.icon-tile`)
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

## 8. Screen Inventory Reference

| Module | Screens & File References |
|---|---|
| **Public** | `index.html` (Landing), `login.html`, `register.html`, `otp-verification.html`, `reset-password.html` |
| **Student** | `student-dashboard.html`, `student-profile.html`, `readiness-dashboard.html`, `notifications.html`, `settings.html` |
| **Admin** | `admin-home.html`, `admin-dashboard.html` (Student Directory), `add-student.html`, `excel-upload.html`, `post-drive.html`, `announcements.html`, `reports-analytics.html` |
| **Super Admin** | `super-admin-dashboard.html`, `department-management.html`, `admin-accounts.html`, `system-settings.html`, `global-reports.html`, `audit-log.html` |
| **Shared Assets** | `styles.css` (Design tokens & layout rules), `motion.js` (Web Animations API engine), `drive-data.js` (Mock placement drive records) |
