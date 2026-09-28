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
