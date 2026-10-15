# Main UI Layout & Dashboard Shell

Phase 4 replaces the Phase 3 placeholder dashboards with a reusable
sidebar/navbar shell and three real (but data-empty) role dashboards.
Nothing here talks to the database — see "Demo vs. real data" below.

## 1. Layout architecture

```
App.jsx
 └─ AuthProvider (Phase 3, untouched)
     └─ Routes
         ├─ /, /login, /register        (public — unchanged from Phase 3)
         └─ <ProtectedRoute>            (Phase 3, untouched)
             └─ <RoleRoute allow={[role]}>   (Phase 3, untouched)
                 └─ /{role}  → <DashboardLayout>   ← NEW, Phase 4
                     ├─ dashboard  → <AdminDashboard | TeacherDashboard | StudentDashboard>
                     └─ *          → <ComingSoon />   (every other sidebar link, for now)
```

`DashboardLayout` is mounted once per role subtree and renders every
nested page through `<Outlet/>`, so a future phase adding
`/admin/students` (Phase 5) only needs to add one `<Route>` line — it
automatically gets the sidebar, navbar, and page container for free.

## 2. Sidebar architecture

`components/layout/Sidebar.jsx` is the single source of the sidebar's
content (logo, nav sections, user summary, logout). It's rendered twice:
- directly, inside a `hidden lg:block` `<aside>` for desktop, and
- inside `components/layout/MobileSidebar.jsx`'s slide-in drawer for
  mobile (closes on backdrop click, Escape, or clicking a link).

There's exactly one sidebar implementation, not two — `MobileSidebar` is
a positioning/overlay wrapper around the same `<Sidebar/>`.

Navigation links come from `constants/navigation.js`
(`navigationByRole = { admin: [...], teacher: [...], student: [...] }`),
not hardcoded JSX — see section 4.

## 3. Navbar architecture

`components/layout/Navbar.jsx`:
- **Left:** a hamburger button (mobile only, `lg:hidden`) that opens
  `MobileSidebar`, plus `Breadcrumbs`.
- **Right:** a notification bell (demo indicator dot only — no data,
  see section 9), and a profile dropdown (avatar initial, name, role,
  chevron) with **Profile** and **Logout** actions. Logout calls the
  existing `useAuth().logout()` from Phase 3 — there is no second logout
  implementation anywhere.

The dropdown closes on outside click or Escape (`components/layout/Navbar.jsx`,
`useEffect` + a ref).

## 4. Role-based navigation

`constants/navigation.js` exports one object,
`navigationByRole[user.role]`, consumed by `Sidebar`. Each role's array
is a list of `{ section, items: [{ label, to, icon }] }` groups matching
the structure specified for Phase 4:

- **admin:** Dashboard · Academic Management (Students, Teachers,
  Subjects, Courses, Classrooms) · Timetable & Attendance · Analytics ·
  System
- **teacher:** Dashboard · Teaching · Attendance · Analytics · System
- **student:** Dashboard · Academics · Attendance · Analytics · System

Adding, renaming, or reordering a link is a one-line change here — no
JSX duplication across three sidebar variants.

## 5. Dashboard structure

Each dashboard (`pages/{admin,teacher,student}/*Dashboard.jsx`) follows
the same shape: `SectionHeader` → a demo-data notice → a `StatCard` grid
→ a couple of `card`-styled sections (timetable preview, quick actions,
recent activity / attendance history) built from `EmptyState`,
`StatusBadge`, and (student only) `CircularProgress`.

## 6. Responsive behavior

- **Desktop (≥1024px / `lg:`):** fixed 16rem sidebar on the left
  (`hidden lg:block`), content fills the rest via `flex`.
- **Tablet (768–1023px):** sidebar collapses to the mobile drawer
  behavior (same breakpoint as mobile — a college-project scope doesn't
  need a third, tablet-specific layout, and this keeps the component
  simpler and easier to explain in a viva).
- **Mobile (≤640px):** sidebar hidden by default; hamburger button in
  the navbar opens `MobileSidebar` as a slide-in drawer with a
  dark overlay (`bg-ink/40`) that closes it on click; body scroll is
  locked while open. Stat-card grids collapse from 4 → 2 → 1 columns
  (`sm:grid-cols-2 lg:grid-cols-4`); no component introduces horizontal
  scroll (`min-w-0` is set on the flex content column so long names/text
  don't force the page wider).

## 7. Reusable components

| Component | Purpose |
|---|---|
| `layout/DashboardLayout.jsx` | Sidebar + navbar + `<Outlet/>` shell |
| `layout/Sidebar.jsx` | Nav content (desktop + reused inside the drawer) |
| `layout/MobileSidebar.jsx` | Drawer/overlay wrapper around `Sidebar` |
| `layout/Navbar.jsx` | Top bar: menu button, breadcrumbs, bell, profile dropdown |
| `layout/Breadcrumbs.jsx` | "Dashboard" / "Dashboard / Attendance" from the URL |
| `layout/PageContainer.jsx` | Consistent max-width/padding for every page |
| `common/StatCard.jsx` | Title/value/icon/trend summary card |
| `common/EmptyState.jsx` | Icon/title/description/action "nothing here" block |
| `common/SectionHeader.jsx` | Title + subtitle + optional right-side action |
| `common/StatusBadge.jsx` | Present/Absent/Late/Active/Inactive/Pending pill |
| `common/CircularProgress.jsx` | SVG percentage ring (student attendance preview) |
| `pages/ComingSoon.jsx` | Placeholder for every nav link without a real page yet |
| `pages/NotFound.jsx` | 404, routes back to the user's dashboard or `/login` |

## 8. Authentication integration

Nothing about Phase 3 changed. `DashboardLayout`/`Sidebar`/`Navbar` all
read `user`/`logout` from the existing `useAuth()` — no hardcoded name,
email, or role anywhere, and no second auth/logout implementation.
`ProtectedRoute` and `RoleRoute` are used exactly as before, wrapping the
new `DashboardLayout` routes instead of the old placeholder components.
A brand-new `routes/DashboardRedirect.jsx` sends `/dashboard` to
`/{user.role}/dashboard` — small enough that it didn't belong in
`ProtectedRoute` itself.

## 9. Demo vs. real data (read this before wiring up an API)

Everything below is **hardcoded placeholder data**, clearly commented as
such at the top of each file, and must be replaced by a real API call in
the phase noted:

| Data | File | Real source (later phase) |
|---|---|---|
| Admin stat cards, timetable preview, activity feed | `pages/admin/AdminDashboard.jsx` | Phase 5 (CRUD) / Phase 9 (analytics) |
| Teacher stat cards, today's classes | `pages/teacher/TeacherDashboard.jsx` | Phase 6 |
| Student stat cards, attendance %, today's classes, recent attendance | `pages/student/StudentDashboard.jsx` | Phase 8/9 |
| Notification bell's unread dot | `components/layout/Navbar.jsx` | Phase 10 |

Every dashboard also shows a small on-screen notice ("Preview data — …")
so this isn't just a code comment — it's visible in the UI too.

## 10. Explicitly deferred to later phases

Not built in Phase 4 (by design, per the phase scope): admin/teacher/
student CRUD, timetable management, real attendance, face recognition,
camera access, attendance analytics APIs, notification backend, report
generation, PDF export, deployment. Sidebar links to all of these exist
and are clickable — they render `ComingSoon` until their phase arrives.
