# Mobile assessment tests: MOB-01 to MOB-15

This separate folder tests the real RentWise Flutter screens, AuthNotifier, property service and logout storage behavior. Existing tests in the parent test folder are preserved. No application code or dependencies were changed for this suite.

Tests have NOT been executed by the agent. On 2026-10-07 the user reported the corrected assessment tests all passed. Saved retest output has not been independently inspected. The user also confirmed the full existing-suite regression passed on 2026-10-07; saved regression output has not been independently inspected. See DEFECTS.md for the compilation correction and retest status.

## Run commands

From the repository root:

```powershell
cd RentWise-Mobile
```

If dependencies are not installed:

```powershell
flutter pub get
```

Run only this assessment suite:

```powershell
flutter test test/mobile_assessment --reporter expanded
```

Run individual groups:

```powershell
flutter test test/mobile_assessment/auth_widgets_test.dart
flutter test test/mobile_assessment/browse_widgets_test.dart
flutter test test/mobile_assessment/details_session_test.dart
```

Run one MOB ID (IDs can appear in more than one test):

```powershell
flutter test test/mobile_assessment --plain-name MOB-13 --reporter expanded
flutter test test/mobile_assessment --plain-name MOB-15 --reporter expanded
```

These are widget/service tests. They do not launch an emulator or a visible application window. A backend, Python agent or real login account is not required.

## Coverage

| ID | Check | File |
| --- | --- | --- |
| MOB-01 | Login screen heading, required inputs and sign-in button render | auth_widgets_test.dart |
| MOB-02 | Empty email/password show validation and do not invoke login | auth_widgets_test.dart |
| MOB-03 | Valid login form invokes expected action with trimmed email and original password | auth_widgets_test.dart |
| MOB-04 | Forgot password navigation; listing tap opens selected details | auth_widgets_test.dart; browse_widgets_test.dart |
| MOB-05 | Mocked successful browse API returns listing title/rent to real UI; authenticated request checked | browse_widgets_test.dart |
| MOB-06 | HTTP 503 shows friendly error and Retry; corrected response recovers | browse_widgets_test.dart |
| MOB-07 | Malformed/overlong email blocked; actual minimum sign-in password of one character accepted | auth_widgets_test.dart |
| MOB-08 | Pending login and pending property request display loading; login button disabled | auth_widgets_test.dart; browse_widgets_test.dart |
| MOB-09 | Empty browse response displays correct empty state without exceptions | browse_widgets_test.dart |
| MOB-10 | ClientException and injected TimeoutException show retry and recover | browse_widgets_test.dart |
| MOB-11 | Mock rejected credentials show error; no HomeScreen/session | auth_widgets_test.dart |
| MOB-12 | Mock valid login navigates to HomeScreen and sets real auth-provider state | auth_widgets_test.dart |
| MOB-13 | Selected property title, address, rent and description display | details_session_test.dart |
| MOB-14 | Long title/description at 320px width; scroll sections and check rendering exceptions | details_session_test.dart |
| MOB-15 | Sign out invokes logout, clears provider state and blocks home; real AuthService.logout clears mocked secure/legacy storage | details_session_test.dart |

## Mocking and scope

`support/fixtures.dart` supplies sample data, a handwritten FakeAuthService, Riverpod overrides and `package:http/testing.dart` MockClient. This provides mock/fake boundaries without adding Mocktail or Mockito. If the marking rubric explicitly requires one of those named libraries rather than an equivalent mock API, record that requirement before changing dependencies.

Login tests exercise the actual LoginScreen and AuthNotifier against a fake service. They do not exercise AuthService's real HTTP login parsing or real credentials. Property browse tests exercise the actual HTTP PropertyService, controller and HomeScreen using MockClient. Details use fixture provider responses. Logout includes a separate real AuthService.logout check with mocked platform storage; no physical device biometric behavior is tested.

Timeout is simulated by throwing TimeoutException immediately. This verifies error handling and recovery, not the actual 90-second service timeout duration. Map lookup uses a cached empty result to avoid external geocoder/tile traffic; map accuracy is outside scope. No live API persistence or device integration is claimed.

The login screen uses the real validators: email at most 200 characters, valid format, nonempty password for sign-in. Registration has separate password rules. Tests do not invent stricter sign-in validation.

## Evidence and assignment workflow

1. Capture your initial output from the mobile directory:

```powershell
New-Item -ItemType Directory -Force test/mobile_assessment/evidence/initial-run
flutter test test/mobile_assessment --reporter expanded 2>&1 | Tee-Object -FilePath test/mobile_assessment/evidence/initial-run/output.txt
```

Optional machine-readable output (runs tests again):

```powershell
flutter test test/mobile_assessment --machine > test/mobile_assessment/evidence/initial-run/results.jsonl
```

The machine output is newline-delimited JSON events, not one JSON document. If screenshots are required, record emulator/device UI evidence separately and label it as manual evidence; this suite does not automatically capture screenshots.

2. Record observed Pass/Fail/Blocked per MOB ID. Mocked error scenarios that display the expected error are successful negative tests, not defects.
3. Reproduce each failure with `--plain-name MOB-XX`. Determine whether the failure is an application defect, test mistake or environment/setup problem.
4. Fill `DEFECTS.md` with reproduction steps, expected/actual behavior, severity rationale and initial evidence paths.
5. Fix important application defects in the real lib files. Keep the regression assertions; do not skip/weaken tests to make them green. Record the changed files and root cause. Record test corrections separately.
6. Run the exact failing test after the fix. Save its output under evidence/retest-run and record the actual result. If it still fails, reopen and repeat.
7. Run this suite and the existing mobile tests for regression:

```powershell
flutter test test/mobile_assessment --reporter expanded
flutter test --reporter expanded
```

8. Close a defect only after a passing focused retest. Record the full regression outcome independently. Keep initial and retest evidence separate. Include open issues, fixes, code references and observed results in your assignment report.

The initial auth-test compilation error was corrected; the user subsequently reported all assessment tests passed. This was a test-code correction, not an application defect. The user also confirmed full existing-suite regression passed. Preserve initial, retest and regression output as evidence.



## Real backend integration (separate suite)

A device/emulator test now exists at integration_test/mobile_assessment/live_backend_test.dart. It uses real backend login, catalogue and property-details requests, then checks logout and protected-home behavior. No mocks are used. See integration_test/mobile_assessment/README.md for account/property prerequisites and run commands. Status: user confirmed the live integration test passed on 2026-10-07 after correcting API_BASE_URL. The agent did not run it or independently inspect passing output; preserve the user-run evidence.
