# Frontend WEB assessment tests (WEB-01–WEB-18)

This suite is separate from `src/test`. It imports the real frontend components and uses its own Vitest and Playwright configurations. Existing tests and application code are unchanged.

Run from `RentWise-Frontend`:

```powershell
npm run test:web
npm run test:web:e2e
npm run test:web:all
npm run test:web:report
```

Dependencies already exist in package.json. On a fresh checkout, install dependencies with `npm ci`. If Chromium is missing, run `npx playwright install chromium` before browser tests.

## Coverage and evidence

| ID | Check | Test file |
| --- | --- | --- |
| WEB-01 | Valid login request, session login action and dashboard navigation | `unit/login.spec.jsx`; browser success screenshot in WEB-17 |
| WEB-02 | Empty login fields display errors without API request | `unit/login.spec.jsx`; browser validation screenshot |
| WEB-03 | Invalid credentials display backend message; form remains usable | `unit/login.spec.jsx`; browser error screenshot |
| WEB-04 | Direct unauthenticated protected route redirects to login | `e2e/workflows.spec.js` |
| WEB-05 | Sample listing title, image, rent, area and selection action render | `unit/listings.spec.jsx` |
| WEB-06 | Empty listing state and reset action | `unit/listings.spec.jsx` |
| WEB-07 | Failed AI search request displays message and retry action | `unit/listings.spec.jsx` |
| WEB-08 | Actual login boundary: one-character password accepted; blank email rejected | `unit/login.spec.jsx` |
| WEB-09 | Tenant login ? browse ? Details ? public listing ? save, verify storage | `e2e/workflows.spec.js` |
| WEB-10 | Valid property form action; dashboard create payload and success state | `unit/property-form.spec.jsx`, `unit/property-management.spec.jsx`; browser form screenshot |
| WEB-11 | Empty required property fields block submission | `unit/property-form.spec.jsx`; browser screenshot |
| WEB-12 | Negative, zero and non-numeric rent rejected; minimum rent 1 accepted | `unit/property-form.spec.jsx`; browser negative-rent screenshot |
| WEB-13 | Image chooser accept filter, supported image preview, submitted file; known handler validation gap | `unit/property-form.spec.jsx`; browser upload screenshot |
| WEB-14 | Existing property prefills, changed fields submitted via PUT, success state | `unit/property-form.spec.jsx`, `unit/property-management.spec.jsx`; browser screenshot |
| WEB-15 | Confirmation before DELETE, correct endpoint and list refresh | `unit/property-management.spec.jsx`; browser confirmation/success screenshots |
| WEB-16 | Guest management access redirects; tenant UI excludes owner actions | `e2e/workflows.spec.js` |
| WEB-17 | Owner login ? Add Property ? valid submit ? POST verified ? new row/success | `e2e/workflows.spec.js` |
| WEB-18 | Load and create failures show safe messages; failed form available for retry | `unit/property-management.spec.jsx`; browser screenshot |

Vitest writes `evidence/vitest-results.json`. Playwright writes `evidence/playwright-report/index.html` and `evidence/browser-results/` with screenshots. Named screenshots use their WEB IDs; every browser test also captures an automatic final screenshot. Failed browser tests retain traces. Generated evidence is ignored by Git; copy it into the submission separately when required.

## Test boundaries and actual rules

API calls are mocked with Vitest spies/hook fixtures and Playwright network interception. These tests exercise real UI behavior but do not prove backend persistence, real credentials, authorization at the API layer, or live service integration. WEB-16 verifies the actual route behavior: `/properties` gives tenants their tenant portal rather than an access-denied page.

Property validation requires title at least 3 characters, description at least 10, address at least 5, and finite rent at least 1. There is no implemented upper rent limit. Login requires a valid email and a nonempty password; its schema does not enforce the registration password length.

WEB-13 contains a normal regression test requiring unsupported files to be rejected by the property photo handler. DEF-001 was reproduced in the user's initial run. Runtime image MIME validation and an error alert have now been implemented in PropertyForm.jsx. Retesting is pending user execution; see DEFECTS.md. Utility-bill validation is outside this fix.

WEB-07 covers the AI search failure UI. Normal browse currently does not render `browse.error`, so this suite does not claim that normal search has a correct API failure state. WEB-18 independently tests the property dashboard load/create failure UI.


## Assignment workflow: defects, fixes and retesting

All artifacts from the earlier agent test runs have been removed. Only test source/configuration and documentation remain. No tests were run during this cleanup. Generate your own evidence using the following steps.

### 1. Prepare

Open a terminal in `RentWise-Frontend`. Install dependencies only if needed:

```powershell
npm ci
npx playwright install chromium
```

Record your commit/version, Node version, browser and OS in the report. Tests mock API responses, so no backend or real login account is needed.

### 2. Execute the initial suite

```powershell
npm run test:web
npm run test:web:e2e
npm run test:web:report
```

Run the two suites separately: an initial Vitest failure must not prevent you collecting Playwright results. For each WEB ID, record actual Pass/Fail/Blocked and link its test source and applicable evidence. A simulated API error with a correctly displayed UI is a passing negative test, not a defect.

Before rerunning, copy the complete generated `tests/web-assessment/evidence` folder to your own submission folder named `initial-run`. Subsequent runs overwrite evidence. Keep the JSON output, HTML report with its companion files, screenshots and failure traces together. Record the command, date and output summary; do not infer results from old runs.

### 3. Record defects found

Use `DEFECTS.md` in this folder as the defect register. Add one entry per reproducible application defect with:

- Defect ID and related WEB ID.
- Summary, affected file/page, environment/version and reproduction steps.
- Expected result, actual result, screenshot/output path and severity with reason.
- Root cause, proposed/applied fix, changed files and status.
- Retest command, actual result, evidence path and regression result.

Separate application defects from incorrect test assertions, missing browser installations and environment failures. Fixing a test assertion is a test correction; it is not an application defect fix.

### 4. Reproduce and prioritize

Run the failing test alone to confirm the same behavior:

```powershell
npm run test:web -- tests/web-assessment/unit/property-form.spec.jsx -t 'WEB-13 handler'
npm run test:web:e2e -- --grep 'WEB-09'
```

For WEB-13, the initial run showed a directly supplied text file forwarded to the create action. The handler fix has since been implemented; retest it now. The normal regression assertion should fail until the handler rejects that file. Do not turn the test into `it.fails`, skip it, or weaken the assertion to make the report green.

Prioritize reproducible defects affecting access control, data integrity, core user workflows or validation. Record the reason for your priority. The missing upload handler validation is a candidate important defect; establish its severity from actual impact rather than calling it critical automatically.

### 5. Correct important defects

For upload validation, update the real photo/utility-bill handlers in `src/features/properties/PropertyForm.jsx`:

1. Establish supported file types from the actual upload contract; the utility-bill UI advertises PNG/JPG/JPEG/WEBP and a 10MB limit.
2. Validate files before adding them to state or reading/previewing them. `accept` alone does not enforce runtime validation.
3. Show a clear error for rejected inputs, preserve previously valid attachments, and prevent invalid files being passed to the create action.
4. Enforce the advertised utility-bill size limit. Define whether 10MB is decimal or binary and keep UI/test expectations consistent.
5. Add meaningful regression tests for invalid types, valid images, exact allowed size and one byte above the limit for the relevant upload control. Validate file content server-side as well if backend upload security is in scope; a frontend MIME check alone does not prove file safety.

Another code-review candidate is normal browse failure handling: `FindRentals.jsx` currently does not render `browse.error`. To claim it as a tested defect, first add a failing RTL test that supplies a browse error, expects a friendly error and retry control, and verifies retry invokes `browse.refresh`. Then implement that error/retry UI and retest. WEB-07 currently covers AI-search failures only.

Keep fixes focused. Record the actual diff and root cause. DEF-001 property photo MIME validation is implemented; utility-bill validation and browse error handling remain suggestions. Do not claim pending retests have passed.

### 6. Retest the fixed defects

Run the exact regression test against the corrected application:

```powershell
npm run test:web -- tests/web-assessment/unit/property-form.spec.jsx -t 'WEB-13'
```

Use the relevant file/WEB ID for each additional fix. If the result is still Fail, reopen the defect, adjust the fix and repeat. Close a defect only after recording an actual passing retest and evidence. An unexecuted test is Pending, not Pass.

### 7. Perform regression testing

After focused retests pass:

```powershell
npm run test:web
npm run test:web:e2e
npm test
```

The final command runs the existing frontend suite too. Check that the fix did not break login, create/edit/delete, uploads, tenant restrictions or the smoke workflow. Copy the final complete evidence folder to `retest-run` in your submission folder. Never overwrite `initial-run`.

### 8. Write the assignment findings

Include the WEB coverage/results table, initial failure evidence, defect register, important fixes with code references/diffs, focused retest results and final regression summary. State any open defects or untested limitations. Report only your observed results. Example structure:

`DEF-001 / WEB-13: initial Fail -> handler validation change -> focused retest [actual result] -> regression [actual result].`

These are workflow instructions, not a claim that the defects have been fixed or that retesting has passed.
