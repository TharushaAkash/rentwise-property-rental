# RentWise mobile

Flutter client with muted green actions, warm neutral surfaces, shared form styles and labelled navigation.

## Run

```powershell
cd RentWise-Mobile
flutter pub get
flutter run
```

The default API is the hosted ASP.NET backend in `lib/shared/utils/api_constants.dart`. Deploy the workflow endpoints, database migrations and Python service configuration there first.

For an Android emulator using the local backend:

```powershell
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:5174/api
```

For a physical phone, replace `10.0.2.2` with the computer's LAN address. The backend must listen on that interface and be reachable by the phone. Use HTTPS for deployed builds. See [backend setup](../RentWise-Backend/RENTAL_WORKFLOWS.md). Never put database credentials or internal service keys in Flutter.

## Rental requests

- Tenant: open **Requests > Find a home**, describe preferences, then enter a budget and lease dates. Preparation runs automatically while the request is open. Completed steps are saved on the server; reopen a Ready request to continue.
- Review the proposed home, agreement and move-in plan in separate tabs. Refresh after connection errors; retry failed preparation when the server's attempt limit permits it.
- Owner/admin: open **Requests**, choose a proposal, review the agreement and confirm approval. Changes and declines require a note. Approval saves a draft, not an active tenancy.
- Tenant: update preferences after a changes request, or delete using the confirmed trash action. Existing agreements are retained. Deletion is disabled during active preparation.

Web and mobile share authenticated `/api/rental-workflows` endpoints and PostgreSQL state. Open proposals refresh every eight seconds while preparing or awaiting approval; pull to refresh is available. Workflow state is not duplicated in mobile storage.

## Cross-client check

1. Point web and mobile at the same backend/database, with an approved Active property that fits the dates and budget.
2. Submit a tenant request on mobile and wait for owner review.
3. Sign in on web as that property's owner or an administrator and approve it.
4. Refresh the mobile request: expect **Draft approved** and the saved agreement link.
5. Repeat in the opposite direction, creating on web and reviewing on mobile. Also check a requested revision and tenant deletion.

## Verification

```powershell
flutter analyze
flutter test
flutter build apk --debug
```

Workflow tests use mocked HTTP responses for authenticated routes, automatic preparation, review versions/confirmation, deletion, form validation and narrow-screen layouts. They do not prove deployed backend connectivity; perform the cross-client check with your running services.


## AI service boundary

All mobile AI HTTP calls use `API_BASE_URL` (ASP.NET Core), including property matching and agreement analysis.
`AGENTIC_BASE_URL` is no longer used. Clients never receive the Python URL or internal key.
ASP.NET forwards `X-Workflow-Key` to Python using the shared `AGENT_WORKFLOW_KEY` configuration.
See [architecture review](../ARCHITECTURE_REVIEW.md) for remaining assignment gaps.


## High-priority integration fixes

Tokens now use platform secure storage. Existing SharedPreferences tokens are migrated on first access and the plaintext copy is removed only after a successful secure write. Logout clears both stores. Rebuild the app to install the native plugin; hot reload is insufficient. Verify login, app restart and logout on a real device. Android backup is disabled; Apple targets include Keychain entitlements and require a signed native build.

The live property catalogue contains API records only. AI failures are shown instead of client-generated rankings or commute values. Unknown commute estimates remain unavailable.

Booking requests now use the persisted ASP.NET `PropertyApplications` table. Deploy the backend migration before testing cross-device bookings. Existing memory-only bookings must be resubmitted; they are not migrated from browser caches.


## Web feature alignment (September 2026)

- Explore uses `/properties/browse` with 12-item cursor pages and server-side normal search. AI search still loads its independent candidate catalogue on demand.
- Rental payments use `/agreements/{id}/payments` for monthly rent and `/agreements/{id}/pay` for the initial lease payment. Receipts retain the server ID and payment purpose; the overview separates rent and deposits. The month selector currently supports the current calendar month because the API has no separate billing-period field.
- Bank transfer details come from the agreement owner's account. Owners can update their account from Profile > Bank details. Transfers cannot be submitted when the account is unconfigured.
- Property image links use `photoUrls`; file uploads still use the upload endpoint.
- Owners can inspect verification and submit a listing-fee reference from Verification & listing fee. This uses the existing fee-recording endpoint, not a new payment gateway. Admins can approve after proof and fee checks, and delete unaccepted agreement requests from Bookings.

Deploy the backend browse endpoint and `AddPaymentPurpose` migration before using these screens. Run `flutter test`, `flutter analyze`, and a device smoke test for bank details, both payment types, photo-link persistence, pagination, and admin deletion. Mocked tests and a successful APK build do not verify hosted payments or device navigation.
