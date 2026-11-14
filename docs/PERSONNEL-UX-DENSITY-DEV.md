# Personnel UX density and exact navigation — DEV only

Date: 2026-11-15 (Europe/Madrid).

Branch: `feature/personnel-ux-density-nav-persistence`.
Fetched DEV base: `58eb3fec94c43cec5c0fe15fd6ad69ba9e6c2cb6`.
Approved Personnel baseline: `6e56f5e8fee99801dca205a87964382283e21917`.
Clean implementation start: `f9e9c91b13f1b945a2054559e66c6a75198c32db`.
That preparation merge incorporated DEV ancestry without source changes. Pending
edits in the original Personnel checkout were not copied into this worktree.

## Package boundary

Only Personnel presentation/interactions, user-scoped UI preferences, and the
shared header's one-line module layout change. The platform-catalog mount effect
that overwrote a restored Personnel location is removed. Normal authorization
still validates the restored organization, unit, module and section. A saved
Personnel route is not restored when its entitlement is absent.

Filters, page sizes/pages, employee detail selection and calendar week/view use
the existing user context preference store, additionally scoped by organization,
unit and Personnel view. No credential, PIN or activation URL is persisted by
these preferences. Existing logout/expired-session cleanup removes them.

Shared pagination uses 10/25/50/All and resets the page when filters change.
Attendance totals use the full filtered result, not only the visible page.
Manual calendar clone/edit/cancel use the existing schedule editor/commands;
recurring-date cancellation uses the existing date-exception command. No
scheduling, clocking, PIN, activation lifetime/binding, tenant, RLS or API
implementation is changed by this package.

## Verification

- Lint, typecheck and build pass; six existing unrelated lint warnings remain.
- Focused unit/integration run: 7 files, 64 tests passed, including the unchanged
  ephemeral PostgreSQL attendance/recurrence/security regression suite.
- Isolated browser fixtures cover platform-admin exact Personnel section restore,
  focus/visibility/background return after five simulated minutes, refresh,
  selected week, revoked unit/module, pagination/filter state and logout/expiry.
- Calendar icons execute existing command paths. The compact activation modal
  copies the exact URL through an accessible icon without regenerating a token.
- Responsive checks cover widths 360, 390, 768, 1024 and 1440. Identical-fixture
  visual comparison measures attendance rows 102→65 px, calendar cards 239→102 px
  and desktop employee cards 259→88 px, retaining the existing visual identity.

Browser screenshots and machine-readable evidence are in the ignored local
`.local-data/density-evidence/` directory. Browser fixtures never write DEV or
production business data.

## Existing DEV limitation — explicitly accepted by the Product Owner

Use DEV/UAT Supabase `vmxjqwlfwnphorthhcwu`. Read-only inspection found the
Personnel admin command installed but no `personnel_schedule_rules` or
`personnel_schedule_exceptions` tables. There is no alternate DEV target.
Recurring-rule/date-exception UI interactions are therefore validated with
isolated fixtures/ephemeral tests; their live DEV persistence cannot be accepted
in this UX package. The Product Owner explicitly directed continuation without
creating or applying a migration. Existing approved recurrence source remains
untouched. The inherited prior migration is not modified or executed here.

No database migration or model change is introduced by this package. No database
write, production deployment or production environment change is authorized or
performed. The separate Platform invitation/Edge Function issue is out of scope.

Deployment uses the Preview environment and existing `dev` environment branch,
with this feature branch's clean committed source. The DEV review origin is
`https://horecamodular-git-dev-vegen-s-projects.vercel.app`.
