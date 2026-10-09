# Real backend mobile integration test

MOB-LIVE-01 runs the real app on a device/emulator with real AuthService, HTTP PropertyService, Riverpod providers and secure token storage. No MockClient, fake authentication, fixture API responses or provider overrides are used.

Workflow: welcome -> real tenant login -> live property catalogue -> selected property details -> compare API data with UI -> real logout -> protected home shows login.

The test is read-only with respect to property data: it does not create, book, edit or delete listings. It logs out/clears the test device's app session at setup and teardown. It does not prove property creation persistence or backend token revocation after logout.

## Prepare (run these commands yourself)

From RentWise-Mobile:

```powershell
flutter pub get
flutter devices
Copy-Item integration_test/mobile_assessment/live-config.example.json integration_test/mobile_assessment/live-config.json
```

Edit live-config.json:

- API_BASE_URL: explicit reachable backend base URL ending in /api, without trailing slash.
- E2E_EMAIL and E2E_PASSWORD: a dedicated existing Tenant test account, using password login.
- E2E_PROPERTY_ID: an existing active, unbooked listing present on the first default browse page (12 items). Its title must be unique within that page so tapping the card is unambiguous.

The config file is ignored by Git. Do not commit credentials. Dart defines are compiled into the test build, so use test credentials and do not distribute that build.

Prefer a reachable HTTPS test backend. For a backend on your PC, Android Emulator uses 10.0.2.2 instead of localhost; a physical device uses your PC's reachable LAN address. Local HTTP may require Android cleartext-network configuration. The backend must already be running for a local URL. The Python agent is not required for login/browse/details.

## Run

Replace DEVICE_ID with the ID from flutter devices:

```powershell
flutter test integration_test/mobile_assessment/live_backend_test.dart -d DEVICE_ID --dart-define-from-file=integration_test/mobile_assessment/live-config.json --reporter expanded
```

The app opens on the selected device/emulator. This is different from the headless widget suite under test/mobile_assessment. Use an Android/iOS device or emulator with working secure-storage plugins; this test is not set up as a Chrome web test.

Capture initial evidence:

```powershell
New-Item -ItemType Directory -Force integration_test/mobile_assessment/evidence/initial-run
flutter test integration_test/mobile_assessment/live_backend_test.dart -d DEVICE_ID --dart-define-from-file=integration_test/mobile_assessment/live-config.json --reporter expanded 2>&1 | Tee-Object -FilePath integration_test/mobile_assessment/evidence/initial-run/output.txt
```

Capture emulator/device screenshots or screen recording separately if required by your assignment. This file does not automatically generate screenshots. Redact credentials/tokens from any shared evidence.

## Failure, fix and retest

If login fails, check the account/role and backend connectivity. If the listing precondition fails, choose a visible unbooked listing from the first browse page. Record these as setup issues unless a reproducible application defect is established.

For an application defect, record expected/actual behavior, reproduction steps, evidence, root cause and priority in ../../test/mobile_assessment/DEFECTS.md. Preserve initial-run output, fix the relevant lib/backend code, then rerun the same command and save output in a separate retest-run folder. Record only observed results.

After a passing integration retest, run widget/unit regression separately:

```powershell
flutter test test/mobile_assessment --reporter expanded
flutter test --reporter expanded
```

## Status

User confirmed MOB-LIVE-01 passed on 2026-10-07 after correcting API_BASE_URL. The agent did not execute the test or inspect saved passing output. Preserve the initial configuration failure and passing retest output as evidence. This result covers the login/browse/details/logout workflow described above, not property creation persistence.
