# Personnel attendance domain

Employee identity is separate from `auth.users` and `eco_user_profiles`. The migration
does not create accounts or require an application account for an employee punch.
All tenant/unit FKs reference canonical `eco_organizations` and `eco_operational_units`;
composite FKs prohibit cross-tenant employee, schedule or device references.

The legacy Horarios screen references generic `empleados`/`fichajes` tables without
this canonical tenant/device contract. The new adapter does not read, migrate or
write those legacy tables. No live schema/data assumption is made; any future
legacy adoption or identity mapping belongs to a separate Master-reviewed task.

## Canonical records

`personnel_employees` stores identity/contact, status and optimistic revision. Status
changes deactivate; there is no delete API. `personnel_employment_assignments` versions
position/start/contract/hours/optional hourly cost; old facts are closed, not erased.
Costs are masked without `sensitivedata.salaries.read` and preserved on unrelated edits.
`personnel_unit_assignments` is an effective-date relation supporting multiple units.
Removing an assignment closes it in the unit's local date, immediately denying punches.

`personnel_schedules` stores local intent AND resolved canonical UTC endpoints plus
the zone snapshot. The instants are not a redundant attendance projection: they disambiguate
historical intent if timezone data/configuration later changes. Schedule updates require
the current revision; old versions are preserved in private schedule history. A schedule
that has begun or has punches cannot be edited/cancelled through the command. Changes
to actual attendance are attributed append-only corrections with a required reason.

Overnight end times resolve on the following local date. Durations must be positive and
at most 16 hours (validated prototype rule). Per-employee row locking serializes overlap
checks across units. DST gaps are rejected; repeated autumn wall times are also rejected
until an explicit offset-selection UX is approved. No browser timezone determines dates.
The current Core unit schema has no timezone field: resolution inherits canonical
Organization.timezone. If Core later provides unit.timezone, the resolver uses it without
creating a Personnel unit master or changing Core. Timezone configuration is not hardcoded.

`personnel_attendance_punches` is immutable: one IN or OUT event per successful command,
server `now()` timestamp, local date and timezone, device, session and optional schedule.
An IN matches the nearest non-cancelled schedule in a four-hour early/late window. This
window is an explicit MVP matching policy, not a claim of inferred scheduled attendance.
A schedule already linked to an IN is not reused by a later session: additional
unscheduled sessions remain explicitly visible instead of silently undercounting hours.
OUT closes the existing employee session and retains its original schedule/session even
after midnight; a different-unit device cannot close that open session. A closed session
permits a subsequent IN. Unscheduled events remain facts and are listed separately.

Admin corrections do not mutate original events; their latest full IN/OUT projection
overrides the affected schedule. The punch command takes later corrections into account
when determining whether the previous session remains open. A monotonic correction sequence
orders superseding corrections; a corrected forgotten IN closes with a subsequent real OUT
without fabricating an original entry event. That later OUT completes the corrected interval.
One captured server instant determines both punch UTC time and local date. Break handling, split shifts,
recurring templates and employee self-service remain out of scope.

Observations are separate immutable rows: one per event, device-owned, within two minutes.
No punch event is rewritten to attach a note. Correction and observation triggers reject
UPDATE/DELETE, including privileged accidental changes.

## Derived projection

Expected minutes = expected end UTC − expected start UTC. Actual minutes and arrival/
departure variance are computed from the effective attendance projection; no stored
variance/status columns are maintained. Stored UTC schedule endpoints are preferred over
reinterpreting local clocks. The original synthetic projection tests remain intact.
The MVP presents one attendance interval per expected shift; advanced multiple-session
aggregation/break accounting is deferred. Original events remain available for review.

## Authorization boundary

Existing Core `personnel.employees.manage` is organization-scoped and requires an
organization-wide membership under the canonical evaluator; selecting a unit cannot
promote a limited membership. The MVP intentionally does not invent a unit-scoped HR
admin role. Applicable unit data is additionally checked by `core_can_read_unit`.
`personnel.fichajes.audit` gates corrections. `personnel.fichajes.write` does NOT issue
device authority and does NOT grant administration. A device credential is a separate,
revocable machine grant bound to one tenant/unit, not a Core user role.

No new Core capability is necessary, so no CCR or Core capability migration is authored.
Future unit-scoped HR administration requires a separate Core-owned decision.
