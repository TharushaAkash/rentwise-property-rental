# Assignment architecture review

Scope: static review of React, Flutter, ASP.NET, Python, persistence and CI against Assignment 1 Sections 2, 5, 8, 9, 10 and 13. This is not certification of every rubric item or deployed environment.

## Corrected

- Flutter matching calls only the ASP.NET `/api/agentic/workflow/match-location` proxy. Removed direct Render and local Python fallback URLs.
- Flutter agreement analysis calls the ASP.NET proxy with the user's bearer token. Removed `AGENTIC_BASE_URL`.
- Python `/workflow/*` endpoints reject missing/wrong server credentials. `/internal/rental-step` retains its own key check. Health remains public.
- ASP.NET attaches the server key for proxy, NIC and property-verification calls. The generic proxy now allows only search, draft analysis, maintenance triage and health; verification must go through the existing business endpoints. Draft/maintenance proxy calls require login. Landing-page search stays public.
- Flutter CI now runs the mobile tests, and workflow CI includes internal-boundary/error tests.
- Existing React AI calls and both clients' durable rental workflow use ASP.NET routes.

## High-priority fixes completed

- Bookings now persist in PostgreSQL through `PropertyApplications`, with GUID foreign keys to users/properties. Server identity, listing price and lease end date override client-supplied metadata. Only the tenant, property owner and admins can read applicable records; only owner/admin can review. A filtered unique index prevents duplicate pending/accepted reservations, and conditional updates prevent conflicting reviews.
- The original integer-key `Applications` model does not reference the current GUID property/user IDs, so the additive `PersistPropertyBookings` migration creates a separate table without altering that legacy table. Old process-memory bookings cannot be recovered by a schema migration; submit them again. New bookings survive process/DbContext restarts.
- Web booking create/review no longer reports success when the API fails. The owner booking list uses API records rather than browser-only records. Older agreement/payment cache behavior remains the Medium item below.
- JWT storage uses `flutter_secure_storage`; all persisted-token readers share `TokenStore`. Legacy SharedPreferences tokens migrate only after successful secure writes. Migration/login/logout are serialized; logout clears secure and legacy stores. Android backup is disabled and Apple Keychain entitlements configured.
- The mobile live catalogue no longer merges sample properties. Loading errors remain errors and empty catalogues stay empty.
- Mobile matching no longer generates local scores, fake listings or fixed distances when AI fails. It displays API failures, preserves unknown commute values, and labels model distances as estimates.

Verification: 41 Flutter tests passed and the Android debug APK built successfully. Web production build passed. 16 SQLite booking checks and 17 PostgreSQL checks passed, including actual migrations and concurrent competing requests on a fresh isolated database. Secure storage tests cover migration, failures, replacement and logout; catalogue/matching tests cover empty results and visible failures. Device Keychain/Keystore behavior still requires a real-device check; Apple builds cannot be verified from Windows.

## Deployment required

Configure the same nonempty `AGENT_WORKFLOW_KEY` on Python and ASP.NET (ASP.NET also accepts `AgentWorkflowKey`). Keep `AgenticServiceUrl` on the backend only. Deploy Python and backend updates together, then rebuild mobile. Apply the `PersistPropertyBookings` EF migration (the backend startup also runs pending migrations). Older mobile APKs containing direct calls must be replaced. Never expose the key in client configuration. Publicly hosted Python is now application-authenticated; private networking is an additional deployment option.

## Remaining findings before evaluation (outside the requested High-only scope)

| Priority | Evidence | Gap / next work |
| --- | --- | --- |
| Medium | `RentWise-Mobile/lib/features/rentals/services/rental_service.dart`, React agreements/tenant portal | Legacy local agreement/payment caches and local pricing fallbacks need a separate authoritative-data audit. Do not equate client-only records with PostgreSQL state. |
| Evidence | Section 10, `RentWise-Backend/RENTAL_WORKFLOWS.md` | The shared workflow exists, but complete the live mobile-to-web and web-to-mobile approval demo with the same identities/database. Unit tests are not deployed end-to-end evidence. |
| Evidence | Repository file inventory | No ADR, performance-test artifact, consolidated assessment report or individual AI logs identified in this repository scan. They may exist outside this workspace; verify and supply actual evidence. |
| CI | `.github/workflows/ci-mobile.yml` | Analyze/format steps remain nonblocking. Make them blocking after existing lint/format cleanup. |

The durable rental workflow's PostgreSQL state and approval-gated draft creation should be demonstrated separately from older booking/local-cache flows. Architecture diagrams must describe current implementation and disclose the remaining limitations above.
