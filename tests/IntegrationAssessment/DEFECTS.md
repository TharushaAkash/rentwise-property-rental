# Integration workflow defects

INT-01/INT-02/INT-03 prepared; not executed. Do not reuse functional/mocked test passes as evidence for these real workflows.

| Defect ID | Case | Steps | Expected / actual | Severity | Initial evidence | Fix | Retest | Status |
|---|---|---|---|---|---|---|---|---|
| Pending actual execution | | | | | | | | Not run |

Preserve initial output before a rerun. Identify configuration/account/fixture problems separately from application defects. Confirm failures, correct important defects, rerun the failed workflow, then run regression. Preserve IDs for created records and remove assessment fixtures after evidence capture. Never fabricate passing results or replace actual API failures with mocks.

## INT-SETUP-001 (2026-10-08): Newman test script scope

User run: owner login HTTP 400; script SyntaxError "Identifier data has already been declared"; 0 assertions executed. Script lexical declarations conflicted with sandbox context. Collection scripts now use an isolated function scope and guard response status before parsing dependent values. Initial collection and raw report preserved under evidence/INT-01-initial-failure-20261008 (report may contain credentials; redact before sharing). Status: fixed, retest pending. HTTP 400 independently reported Email/Password validation fields; correct the Newman environment fixture before retesting. Agent did not run Newman.
