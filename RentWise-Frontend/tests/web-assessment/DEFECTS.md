# Defect register

| Defect ID | WEB ID | Summary | Severity / reason | Status | Initial evidence | Fix / files | Retest result / evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DEF-001 | WEB-13 | Unsupported file forwarded by property photo upload handler | Medium: invalid attachments can enter the create/upload workflow | Fix implemented; awaiting retest | User-provided Vitest output: 20 passed, 1 failed | Runtime image MIME validation in src/features/properties/PropertyForm.jsx | Pending user execution |

## DEF-001 detail

- Environment / commit: User's local Windows frontend; commit not recorded.
- Initial run: 2026-10-07, 11:32:07 (time shown in user-provided output).
- Preconditions: Render the property form with valid required details.
- Steps: Supply a text/plain document.txt directly to the property photo input handler; submit.
- Expected: Unsupported attachment is rejected and not forwarded to the create action.
- Actual before fix: The submit action received the unsupported File. Assertion failed: expected [ File{} ] to not include File{}.
- Initial results: 20 passed, 1 failed; 3 test files passed, 1 failed.
- Evidence: User-provided Vitest output. Preserve your initial-run JSON/output separately before retesting; screenshots are not inferred from console output.
- Root cause: The handler appended every supplied file without validation. The accept=image/* attribute only filters normal chooser selection.
- Severity / priority: Medium; invalid attachments can enter the property creation/upload workflow. This does not establish a backend security vulnerability.
- Fix: Validate image MIME types before adding files to state. Discard unsupported files, display an alert, preserve existing valid attachments, and allow valid images from a mixed selection. Reset the file input so selecting the same file again triggers change.
- Application file changed: src/features/properties/PropertyForm.jsx.
- Regression test changed: tests/web-assessment/unit/property-form.spec.jsx. The existing WEB-13 test remains a normal test and now also checks the error alert and absence of an invalid preview.
- Scope: Property photo file selection. Utility-bill size/type validation and photo URL validation are separate concerns and are not fixed by this change. MIME metadata validation alone does not validate actual file content; backend validation remains necessary.
- Focused retest command: npm run test:web -- tests/web-assessment/unit/property-form.spec.jsx -t 'WEB-13'
- Retest actual result / evidence: Pending. Tests were not run by the agent after this fix, as requested.
- Full regression commands: npm run test:web; npm run test:web:e2e; npm test (run separately).
- Full regression result / evidence: Pending.
- Final status: Fix implemented; awaiting retest. Close only after an observed passing retest.

Testing-only branch note: The PropertyForm.jsx fix remains an uncommitted working-tree change and is excluded from the test-suite commit. A clean checkout of this commit still exposes DEF-001 until the application fix is committed separately.
