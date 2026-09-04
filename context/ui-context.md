# UI Context

## Theme

Light only. Warm, paper-like neutral background (not stark white) with a terracotta accent for primary actions, and a semantic teal/amber/red status system for badges and progress. Layout is sidebar-driven for all three role dashboards (student, department admin, super admin), with a public marketing shell (navbar + footer) for the landing/auth pages. This is the exact palette carried over from the approved clickable prototype — do not deviate from it.

## Colors

| Role                  | CSS Variable       | Value     |
| ---------------------- | ------------------- | --------- |
| Page background        | `--surface-0`       | `#FAF9F5` |
| Sunken surface          | `--surface-1`       | `#F1EFE7` |
| Card / raised surface   | `--surface-2`       | `#FFFFFF` |
| Primary text            | `--text-primary`    | `#1C1C1A` |
| Secondary text          | `--text-secondary`  | `#6B6A63` |
| Muted text              | `--text-muted`      | `#9B9A92` |
| Border                  | `--border`          | `#E6E4DA` |
| Border (strong)         | `--border-strong`   | `#D2D0C4` |
| Primary accent          | `--accent`          | `#D85A30` |
| Accent (hover/dark)     | `--accent-dark`     | `#712B13` |
| Accent (light bg)       | `--accent-light`    | `#FAECE7` |
| Success / teal          | `--teal`            | `#0F6E56` |
| Success (light bg)      | `--teal-light`      | `#E1F5EE` |
| Warning / amber         | `--amber`           | `#854F0B` |
| Warning (light bg)      | `--amber-light`     | `#FAEEDA` |
| Info / purple           | `--purple`          | `#534AB7` |
| Info (light bg)         | `--purple-light`    | `#EEEDFE` |
| Error / red             | `--red`             | `#A32D2D` |
| Error (light bg)        | `--red-light`       | `#FCEBEB` |

All components use these tokens — no hardcoded hex values. Status badges (readiness scores, valid/invalid rows, drive status) map to teal (good), amber (attention/pending), or red (bad/error) — never a raw color.

## Typography

| Role     | Font                                   | Variable      |
| -------- | --------------------------------------- | ------------- |
| UI text  | Inter (400/500/600 weights)             | `--font-sans` |
| Base size | 14px body, 12–13px for form/table text, 19–20px for page/section headings | — |

## Border Radius

| Context                          | Value   |
| --------------------------------- | ------- |
| Inputs, buttons, badges, sidebar links | `8px` (`--radius`) |
| Cards, panels, modals, dropzones  | `12px`  |
| Avatars                           | `50%` (circular) |

## Component Library

shadcn/ui on top of Tailwind CSS. Components live in `components/ui/`. Use the shadcn CLI to add new components rather than writing them from scratch. Map shadcn's default theme variables to the CampusHire tokens above (e.g. shadcn `--primary` → `--accent`) in `globals.css` / `tailwind.config` so every generated component inherits the theme automatically.

## Layout Patterns

- **App shell (student / dept admin / super admin)**: fixed 220px left sidebar + fluid content area. Sidebar has nav links grouped with a "bottom" section for Settings/Log out. Topbar above content holds notifications bell and the user avatar.
- **Public pages (landing, login, register)**: top navbar (brand left, nav links center, primary CTA right) + full-width content sections, no sidebar.
- **Forms**: `field` and `field-row` (2-column grid) pattern — label above input, 12px hint text below when needed. Multi-entry sections (projects, experience, certifications) use a repeatable `entry-card` with a remove icon and an "add another" link below.
- **Tabs**: used on the student profile page — vertical sticky tab list (190px) beside the active section content, not horizontal tabs.
- **Tables**: used for student rosters, drive lists, department lists, and audit logs — left-aligned headers, row actions (View/Edit) right-aligned as text links, status shown via colored badges.
- **Dropzones**: dashed border, centered icon + label, used for Excel upload and JD PDF upload.
- **Cards**: white surface, thin border, 12px radius, used for metrics, content grouping, and list containers.
- **Modals**: not used in the current design — confirmations currently rely on inline actions; introduce a shadcn `Dialog` only if a flow genuinely requires interrupting the user.

## Icons

Tabler Icons (`ti ti-*` icon font in the prototype; use `@tabler/icons-react` in the built app for proper tree-shaking). Stroke-based icons only, sized ~16px inline in sidebar/nav items, ~18–20px for standalone action icons.
