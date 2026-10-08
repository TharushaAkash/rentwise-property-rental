# Final frontend assessment defects and retesting

Final scope WEB-01?WEB-18. Prepared tests have not been executed by the agent. Previous passing reports belong to the old mapping and are archived, not reused as final passing evidence.

## Preserved legacy defect

LEGACY-WEB-13 / DEF-001: unsupported files could bypass the image chooser and enter the property photo array. Fixed in `src/features/properties/PropertyForm.jsx` (commit 178e509). Initial failure, fix patch and retest evidence remain under evidence/previous-run/ and the previous-suite archive. The user supplied a focused two-check passing retest and later a nine-check property-form passing output for the old suite. Its final regression mapping is **WEB-06**, not the new Agreement WEB-13. Final suite retest remains pending.

## Code-review candidates: execution required

| Candidate | Final case | Observed implementation | Expected behaviour | Status |
|---|---|---|---|---|
| CAND-01 | WEB-14 | AgreementsDashboard fetchAgreements catch only logs failure and can render normal empty-list UI | Show safe error state instead of implying no agreements | Suspected; run test before recording confirmed defect |
| CAND-02 | WEB-17 | MaintenanceDashboard handleCreate catches POST failure, stores locally and shows created successfully | Show failure or clearly identified unsynced local state; permit retry | Suspected; run test before recording confirmed defect |

These tests deliberately assert the requested error handling. Do not skip them or mark them passed before execution. Application code was not changed for these candidates.

## Steps when a test fails

1. Save terminal output, JSON/HTML report and screenshots into a dated evidence/initial-run folder before rerunning.
2. Reproduce the failing ID individually using the README command and `--testNamePattern WEB-14` or `--testNamePattern WEB-17` for Vitest.
3. Check fixtures/selectors/config/network first. Distinguish test defect, environment failure and application defect.
4. Record defect ID, scenario ID, severity, steps, expected/actual results, evidence location and affected source file.
5. Correct important confirmed application defects in application source; preserve the original failure evidence.
6. Rerun the failed ID and save separate evidence/retest output.
7. Run all component tests, mocked browser workflows and WEB-18 real API regression. Record remaining failures honestly.
8. Close only after passing retest evidence; record user-executed date/output and fix commit.

Template:

| Field | Value |
|---|---|
| Defect ID / scenario | |
| Severity / priority | |
| Reproduction steps | |
| Expected behaviour | |
| Actual behaviour | |
| Initial evidence | |
| Application/test/environment classification | |
| Fix file / commit | |
| Focused retest command and result | |
| Regression result and evidence | |
| Status | Open / Fixed-awaiting-retest / Closed |


## Initial final-suite run: 2026-10-08 16:12:40 (user executed)

25 checks: 21 passed, 4 failed; 5 files passed, 2 failed. Preserved JSON, submitted output excerpt, original affected source and original agreement tests in `evidence/initial-run-20261008-161240/`.

| ID | Cases | Classification / cause | Correction | Status |
|---|---|---|---|---|
| TEST-001 | WEB-12, WEB-13 | Test defect: middle-dot labels were written as question marks during source generation | Match both meaningful status phrases with regex, preserving status assertions and request verification | Closed; user confirmed retest/regression passed on 2026-10-08 |
| DEF-002 (CAND-01 confirmed) | WEB-14 | Application defect: failed agreement loading rendered normal empty state | AgreementsDashboard.jsx adds explicit error state and retry button; suppresses empty state on failure | Closed; user confirmed retest/regression passed on 2026-10-08 |
| DEF-003 (CAND-02 confirmed) | WEB-17 | Application defect: rejected maintenance POST still cached the request and displayed success | MaintenanceDashboard.jsx propagates POST rejection to error handler, preserving entered form and preventing local success/cache | Closed; user confirmed retest/regression passed on 2026-10-08 |

No tests were executed by the agent. These fixes are not marked passed or closed.

Focused retest from RentWise-Frontend:

```powershell
npm run test:web -- tests/web-assessment/unit/agreements.spec.jsx tests/web-assessment/unit/maintenance.spec.jsx
```

Then full component regression and mocked browser creation regression:

```powershell
npm run test:web
npm run test:web:e2e -- --headed
```

Save retest results separately before overwriting reports. WEB-18 still requires the configured real API regression command in README.md.


## User-confirmed final retest: 2026-10-08

The user confirmed "hari okkoma pass" after the component, mocked browser and real API run instructions, including resolution of the missing LIVE_API_URL configuration. Record the final suite as **passed according to the user**, with TEST-001, DEF-002 and DEF-003 closed on that basis. The legacy image-validation regression is included under final WEB-06.

The agent did not execute tests or independently inspect the final passing reports in this update. Exact final counts and report contents are not asserted. Preserve the actual passing JSON/HTML reports, screenshots and terminal output as assignment retest/regression evidence, alongside the archived initial failure.
