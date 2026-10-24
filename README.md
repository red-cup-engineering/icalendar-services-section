# @red-cup-engineering/icalendar-services-section

<!-- 561-group-standards:badges:start -->
[![Red Cup Engineering](https://img.shields.io/badge/561%20Group-Red%20Cup%20Engineering-c0392b)](https://github.com/red-cup-engineering)
[![License: MIT](https://img.shields.io/badge/license-MIT-c0392b)](LICENSE)
[![Indigenous data: CARE](https://img.shields.io/badge/Indigenous%20data-CARE-4b6f44)](https://github.com/red-cup-engineering/.github/blob/main/GOVERNANCE.md)
[![Tips welcome](https://img.shields.io/badge/tips-welcome-d4a017)](https://github.com/561-group/.github/blob/main/TIPS.md)
<!-- 561-group-standards:badges:end -->

Owns iCalendar (RFC 5545) scheduling data -- VEVENT recurrence rules, DTSTART/EXDATE/RDATE, and due-event derivation -- shared across the tree's separately implemented schedulers.


## Source-qualified Work is a VTODO, not a booked VEVENT

The original \`./render-source-work-todos\` export now provides one **read-only
RFC 5545 VTODO** calendar view for independently source-selected, outstanding
Work. It **reuses** the current \`render-source-observed-calendar\` codec's
RFC TEXT escaping, UTF-8 75-octet folding, ISO UTC/DATE validation and
safe HTTPS source-URL admission; neither the recurrence engine nor an
independent Work registry is copied.

Input is a bounded, explicitly selected \`{ at, work }\` projection:

- \`at\` — actual publication instant \`YYYY-MM-DDTHH:mm:ss.sssZ\`, **not**
  the time of approval or acceptance.
- Each Work row supplies the **original** globally unique SHA-256 NI
  \`id\`, \`summary\`, \`description\`, attributable \`sourceUrl\` (HTTPS),
  and \`observedAt\` before publication. Same-title Work keeps separate
  \`UID\` values and a stable ordered source-ID readout.
- Optional \`start: {kind:"date",value:"YYYY-MM-DD"}\` or
  \`{kind:"utc",value:"YYYY-MM-DDTHH:mm:ss.sssZ"}\`.
- Optional \`due: {kind:"date-exclusive",value:"YYYY-MM-DD"}\` or
  \`{kind:"utc",value:"YYYY-MM-DDTHH:mm:ss.sssZ"}\`. The date form is
  **the exclusive RFC DUE boundary**, not a last inclusive work day. If a
  source says "finish by the end of November 4, locally", the competent
  upstream source must independently qualify the intended jurisdiction and
  next-day cutoff *before* producing a DATE-exclusive value. It must not
  convert that phrase into a made-up midnight UTC instant. If no qualified
  due boundary exists, **omit DUE**.
- If \`DTSTART\` and \`DUE\` are both present they must be the **same RFC
  VALUE type**, with DUE strictly later. No local/floating time or TZID
  is currently claimed. A planning horizon (\`soon\`, \`later\`) is not
  a temporal cutoff.
- Exact outer record fields are admitted: unknown Work labels, authority,
  assayer or completion statements cannot silently become standardized
  fields. All emitted tasks have \`STATUS:NEEDS-ACTION\` and
  \`CLASS:PRIVATE\`; **CLASS is a presentation hint, NOT an access
  control**, and this encoder is never an authorization to export private
  source. It does not emit COMPLETED/ATTENDEE/VALARM, recurrences, or
  contracts without independently qualified originals.

Example using the existing source-selected Work subject; caller must first
qualify its source, audience and office permissions:

\`\`\`js
import { renderSourceWorkTodos } from
  "@red-cup-engineering/icalendar-services-section/render-source-work-todos";
const projection = renderSourceWorkTodos({
  at: "2026-10-24T17:00:00.000Z",
  work: [{
    id: "ni:///sha-256;" + "A".repeat(43),
    summary: "Receive original customer Work",
    description: "Advisory, not an independently accepted deliverable",
    observedAt: "2026-10-24T16:00:00.000Z",
    sourceUrl: "https://github.com/red-cup-engineering/agent-organization-engine/issues/53",
    due: { kind: "date-exclusive", value: "2026-10-26" },
  }],
});
\`\`\`

This is a calendar/task **export**, not two-way synchronization, a
subscription, customer approval, legally established deadline, or money.
Source authority, dependency DAGs, Actor capacity, claims/disagreement,
assayer ACK and economic settlement are deliberately **not** encoded as
VTODO status; \`lostSemantics\`, \`withoutDueCount\` and the original IDs
remain machine-readable. Real source selection, host packaging, importing
consumer compatibility and independent receiving are still owed. Compare
actual jobs with [RFC 5545 VTODO §3.6.2 and DUE §3.8.2.3]
(https://www.rfc-editor.org/rfc/rfc5545.html), and note Asana's documented
one-way all-day **VEVENT** sync is not the same capability as portable
VTODO. A calendar imported into an external app is not proof the external
app faithfully preserves our Work IDs, dates or rights.

### Professional due-source receiving

The existing \`./derive-set-of-due-events\` composed reader now distinguishes
**no recorded completion** from an explicitly **invalid or future** completion
record. Previously an invalid \`lastDone\` string could compare to
\`Invalid Date\` as false and silently hide an overdue event. It now refuses
malformed/invalid ISO completion instants, future-dated completions,
duplicate original source IDs and malformed \`now\`/receipt maps. Qualified
time-zone offset instants remain supported and compared as instants; only
**own** \`lastDone\` members are honored, not prototype-inherited keys.
The original return interface and recurrence Work identities are unchanged.

Run \`npm test\`, using the original package's Node 22 execution, and inspect
the source-qualified CI receipt. These source tests qualify only pure
recurrence and calendar projections, not live calendar or paid-Work delivery.
