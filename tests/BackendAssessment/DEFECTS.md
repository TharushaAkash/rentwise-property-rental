# Backend defect register

API-01 to API-12 and DB-01 to DB-03. Suite not run by the agent. User supplied a passing xUnit run on 2026-10-07: 33 passed, 0 failed, 0 skipped, duration 2 minutes 17 seconds (.NET 8; VSTest 17.11.1). User supplied passing Newman output: 3 requests, 4 assertions, 0 failures, duration 6.1 seconds.

| Defect ID | Test ID | Summary | Severity / impact | Status | Initial evidence | Fix / files | Retest / evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |

## Reproduced application defect template

- Defect ID: BACK-DEF-001
- Test ID:
- Environment / branch / commit / .NET / PostgreSQL version:
- Preconditions:
- Reproduction steps / failing request:
- Expected behavior:
- Actual behavior:
- Initial evidence (output/TRX/Newman path):
- Severity and priority rationale:
- Root cause:
- Fix and application files changed:
- Regression test added/updated:
- Focused retest command:
- Observed retest result / date / evidence:
- Full regression result / evidence:
- Final status: Open / fix implemented awaiting retest / reopened / closed after passing retest.

## Test / setup corrections

Record compilation mistakes, Docker startup failures, missing packages and invalid Newman tokens here instead of calling them application defects. Do not fabricate results. A 401/403/constraint error expected by the test is a passing negative case.

## Verified user-run results

- Source: User-pasted VSTest output on 2026-10-07.
- Suite: BackendAssessment.Tests.dll (net8.0).
- Outcome: Passed; 33 passed, 0 failed, 0 skipped, total 33.
- Duration: 2 minutes 17 seconds.
- Coverage: xUnit unit, API/authentication/authorization and PostgreSQL integrity/migration/transaction assessment tests.
- Application defects reported by this run: None.
- Retesting after fixes: Not applicable to this run; no failed cases or applied defect fixes reported.
- Evidence file path: Not supplied; preserve the full output/TRX for submission.
- Newman collection: Separately confirmed from user-pasted output: 3 requests and 4 assertions passed, 0 failures, duration 6.1 seconds.


## Newman security results — 2026-10-07

- Source: User-pasted Newman output; agent did not run Newman.
- Iterations: 1; requests: 3; test scripts: 3; assertions: 4; failures: 0.
- Duration: 6.1 seconds.
- API-11: Unauthenticated GET /api/agreements returned 401; assertion passed.
- Fixture: GET /api/auth/profile returned 200 and Tenant role; both assertions passed.
- API-12: Tenant POST /api/properties returned 403; assertion passed.
- Report location configured by command: tests/BackendAssessment/evidence/newman-results.json (contents not independently inspected).
- Node DEP0176 message: Deprecation warning; no test failure reported.
- Application defects observed in this run: None.

