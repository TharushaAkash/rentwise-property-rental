# Mobile defect register

Assessment: MOB-01 to MOB-15. The agent has not run this suite. User reported the corrected mobile assessment tests all passed on 2026-10-07. Application defects have not been reported. See the test correction record below; attach saved retest output as submission evidence.

| Defect ID | MOB ID | Summary | Severity and reason | Status | Initial evidence | Fix / changed files | Retest result / evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |

## Entry template (copy for each reproduced application defect)

- Defect ID: MOB-DEF-001
- Related test ID: MOB-XX
- Summary:
- Environment: OS, Flutter/Dart versions, device/test viewport, branch and commit.
- Preconditions:
- Reproduction steps:
- Expected behavior:
- Actual behavior:
- Initial result and evidence path:
- Severity / priority with impact rationale:
- Root cause:
- Fix description:
- Application files changed:
- Regression test added/updated:
- Focused retest command: flutter test test/mobile_assessment --plain-name MOB-XX --reporter expanded
- Retest date, actual result and evidence:
- Full regression command: flutter test --reporter expanded
- Regression actual result and evidence:
- Final status: Open / fix implemented awaiting retest / reopened / closed after passing retest.

Keep environment failures and incorrect test expectations in a separate test/setup corrections section. A simulated failed API response that displays the expected error is a passing negative test, not a defect. Do not assign a severity or claim a fix without observed evidence.

## Test/setup corrections

Record test or environment corrections here separately, with cause, changed files and rerun results.

### MOB-TEST-001: Auth test compilation correction

- Classification: Test code error, not an application defect.
- Initial evidence: User-provided output from 2026-10-07 13:10; evidence/initial-run/output.txt.
- Initial outcome: 11 tests passed; auth_widgets_test.dart failed to load, so its tests were blocked and did not execute.
- Cause: The MOB-11 assertion used hasError without the required Riverpod API in scope.
- Correction: Import flutter_riverpod and explicitly assert isA<AsyncError<UserModel?>>() for the rejected login state.
- Changed file: test/mobile_assessment/auth_widgets_test.dart.
- Application files changed: None.
- Focused rerun: flutter test test/mobile_assessment/auth_widgets_test.dart --reporter expanded
- Full rerun: flutter test test/mobile_assessment --reporter expanded
- Retest status: Passed according to user confirmation on 2026-10-07; agent did not run tests or independently inspect retest output. Auth retest and subsequent all-passed result reported by user.
- Correction status: Resolved based on user-reported passing retest.
- Retest evidence path: Awaiting saved user output; no artifact path verified.
- Existing-suite regression (flutter test --reporter expanded): Passed according to user confirmation on 2026-10-07. Agent did not execute tests or inspect saved regression output; attach user-run output as evidence.
- Preserve initial-run evidence; save rerun output under evidence/retest-run.



## Live backend integration status

- Test: MOB-LIVE-01, integration_test/mobile_assessment/live_backend_test.dart.
- Coverage: Real login, authenticated browse/details, UI navigation, logout and protected-home blocking.
- Status: Passed according to user confirmation on 2026-10-07 after correcting API_BASE_URL. Agent did not execute the test or inspect saved passing output.
- Setup: See integration_test/mobile_assessment/README.md.
- Evidence: Save initial and retest output separately under integration_test/mobile_assessment/evidence/.

### MOB-SETUP-002: Live backend URL configuration

- Classification: Test configuration issue; not an application defect.
- Initial result: MOB-LIVE-01 failed at line 36 URL validation before login/API requests started.
- Correction: User corrected API_BASE_URL in the ignored local live-config.json.
- Retest: User reported All tests passed on 2026-10-07.
- Status: Resolved based on user confirmation.
- Evidence: Preserve initial failure and passing rerun output separately; passing artifact path not independently verified.
