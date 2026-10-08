# Real integration workflows: INT-01, INT-02, INT-03

Separate from functional mocks and non-functional scans. Prepared only; no tests, account logins or backend writes executed by the agent. User runs commands. Tests perform real writes: use dedicated test accounts/data in a shared test backend, retain IDs, and clean up assessment records after preserving evidence. Never use someone else's property/account.

## Setup from beginning

1. Ensure backend/database reachable, test accounts verified and the backend accepts frontend origin `http://127.0.0.1:4181` via CORS.
2. INT-01/03 need an Owner/PropertyOwner account. INT-02 needs a Tenant account and a dedicated Active, listing-fee-paid, unbooked property matching the search city and present in the returned browse page.
3. Both web and mobile must use exactly the same backend. The current example points to the API used by your earlier Newman/performance tests.
4. From repository root:

```powershell
Set-Location "E:\Y3S1\Software Engineering Framworks\project-demo\RentWiseAI"
Copy-Item tests/IntegrationAssessment/config.example.json tests/IntegrationAssessment/config.local.json
Copy-Item tests/IntegrationAssessment/Newman/environment.example.json tests/IntegrationAssessment/Newman/environment.local.json
New-Item -ItemType Directory -Force tests/IntegrationAssessment/evidence | Out-Null
```

Edit config.local.json: ownerEmail, ownerPassword, tenantEmail, tenantPassword, rentalPropertyId, searchLocation. Keep apiBaseUrl ending in /api. Edit Newman environment.local.json ownerEmail/ownerPassword and same baseUrl. These local files are ignored; never commit credentials or tokens.

Frontend prerequisites:

```powershell
Set-Location RentWise-Frontend
npm install
npx playwright install chromium
Set-Location ..
```

## INT-01 API create -> retrieve saved property (Postman/Newman)

```powershell
Set-Location tests/IntegrationAssessment/Newman
npm install
npm test
Set-Location ../../..
```

The collection logs in as owner, creates a uniquely named property with actual owner ID, retrieves the same returned ID using owner auth and verifies saved title/description/address/rent/bedroom/bathroom values. It expects POST 201 and GET 200. A new pending property can be read by its owner without publication. The JSON report can contain login request/response credentials; keep raw evidence local and redact before sharing.

Postman alternative: import property.postman_collection.json and environment.example.json, populate test credentials, run the collection and export redacted results. Do not treat a single manual response as collection assertions passing.

## INT-02 complete real browser rental workflow

```powershell
Set-Location RentWise-Frontend
npm run test:integration:workflows -- --headed --grep INT-02
```

Flow: real tenant login -> enter city search -> returned matching test property -> view details -> submit actual booking request -> check server response ID and success UI -> GET applications and verify the same saved booking. No route mocks or fake JWTs. This tests the implemented rental application action, not a completed lease/payment lifecycle.

The test property must be available; after success a booking can make it unavailable. Before rerunning, cancel/remove the previous assessment booking through the implemented management workflow or reset staging fixtures. Keep the booking ID from the report attachment. If not found on first browse page, choose a more specific city/dataset rather than weakening assertions.

## INT-03 web creation -> same record in Flutter

Run web producer first:

```powershell
npm run test:integration:workflows -- --headed --grep INT-03
Set-Location ..
./tests/IntegrationAssessment/prepare-mobile.ps1
```

Web uses real owner login and actual Add Property form, verifies POST 201, reads the saved record, then exports `evidence/INT-03-created-property.json` containing the property ID and expected data without credentials. prepare-mobile.ps1 combines that artifact with the ignored owner config into ignored `mobile.local.json`. It verifies API URLs match. Run preparation only after the web stage succeeds so you do not verify an older artifact.

Run mobile consumer second:

```powershell
Set-Location RentWise-Mobile
flutter pub get
flutter devices
flutter test integration_test/cross_platform/property_sync_test.dart -d YOUR_DEVICE_ID --dart-define-from-file=../tests/IntegrationAssessment/mobile.local.json --reporter expanded
Set-Location ..
```

Replace YOUR_DEVICE_ID with flutter devices output, e.g. emulator-5554. The Flutter SDK integration_test dependency is declared; flutter pub get updates pubspec.lock. The test logs in through real mobile auth/provider, fetches the identical ID, checks title/address/rent, opens the actual PropertyDetailScreen and verifies real provider-loaded data and visible title/address. No API overrides/mocks. This is owner-view cross-platform consistency because new properties are PendingVerification; it does not imply public tenant listing visibility. Record the emulator screen manually as supplementary screenshot evidence; terminal assertions remain primary automated evidence.

## All workflow commands

From repository root:

```powershell
Set-Location tests/IntegrationAssessment/Newman
npm test
Set-Location ../../../RentWise-Frontend
npm run test:integration:workflows -- --headed
Set-Location ..
./tests/IntegrationAssessment/prepare-mobile.ps1
Set-Location RentWise-Mobile
flutter test integration_test/cross_platform/property_sync_test.dart -d YOUR_DEVICE_ID --dart-define-from-file=../tests/IntegrationAssessment/mobile.local.json --reporter expanded
```

Run sequentially and stop/fix failures before dependent stages. INT-03 is complete only when BOTH the web producer and mobile consumer pass against the same exported ID; a web-only pass is not a cross-platform pass.

## Evidence and retesting

Browser HTML report/screenshots: tests/IntegrationAssessment/evidence/playwright-report and browser-results. From RentWise-Frontend:

```powershell
npx playwright show-report ../tests/IntegrationAssessment/evidence/playwright-report
```

INT-01 Newman JSON: evidence/INT-01-newman.json. Save Flutter expanded output separately. Archive all initial reports and the exported same-record artifact to a dated folder before a rerun; current outputs can be overwritten. Browser traces disabled because traces may include passwords. Review reports/screenshots for personal data before submission.

Follow DEFECTS.md: actual failure -> preserve evidence -> distinguish setup vs application defect -> fix important confirmed defects -> focused retest -> workflow regression -> record pass/remaining limits. No passing results currently asserted. ZAP scanning remains an independent activity and is not replaced by these integration workflows.
