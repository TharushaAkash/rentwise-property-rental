# Non-functional defects and retesting

Selected scope: NF-01 Performance, NF-02 Load, NF-03 Stress, NF-04 Security and NF-07 Compatibility. NF-05/NF-06 removed at user request. Security findings are pending.

Preserve dated initial-run reports before applying fixes. Distinguish environment failures (unreachable API, wrong URL, missing Docker/browser) from product defects. Check ZAP alerts manually before confirming a vulnerability; do not assume every warning is exploitable. Record the URL, browser, dataset, load profile, hardware/network, timestamp and build commit.

| Defect ID | NF case | Expected / actual | Severity | Initial evidence | Fix file / commit | Focused retest evidence | Regression | Status |
|---|---|---|---|---|---|---|---|---|
| Pending actual execution | | | | | | | | Not run |

Workflow: execute -> preserve report -> reproduce -> confirm defect -> prioritize important defects -> correct application/configuration -> rerun same scenario with comparable conditions -> archive separate retest reports -> broader regression -> close only with observed passing evidence. Do not relax thresholds merely to make failures disappear.

NF-03 stress evaluation must include observed saturation point, failures, server CPU/memory and recovery after load drops. Add a subsequent normal-profile run. A k6 exit code alone is not a stress/recovery conclusion.

## SETUP-001: ZAP launcher native stderr handling (2026-10-08)

User-run baseline command stopped on Docker image-pull progress: "Unable to find image ... locally". Windows PowerShell converted native stderr into a terminating error under ErrorActionPreference Stop. This is a launcher defect, not a discovered security vulnerability. security/scan.ps1 now permits native stderr while capturing console output and preserving the actual Docker/ZAP exit code; restores PowerShell preferences afterward. Status: fixed, user retest pending. No scan executed by the agent.

## User-executed results (2026-10-08)

| Case | Supplied result | Status |
|---|---|---|
| NF-01 | 1 VU; 41 requests; 82/82 checks; p95 581.68 ms; 0 failed requests | Passed configured thresholds |
| NF-02 | Up to 10 VUs; 462 requests; 924/924 checks; p95 541.96 ms; 0 failed requests | Passed configured thresholds |
| NF-03 | Up to 50 VUs; 2611 requests; p95 532.97 ms; no failures; subsequent normal run 42 requests, p95 533.89 ms, no failures | Stress and subsequent normal-load thresholds passed; capacity limit not established |
| NF-04 | User reported ZAP image download still in progress; no final scan results supplied | Pending |
| NF-07 | Chromium/Firefox/WebKit; 15/15 executions passed in 1 minute | Passed mocked browser compatibility workflows |

These results come from user-pasted output; the agent did not run tests. No new confirmed application defect was reported by these passing runs.

## NF-04 user-executed ZAP baseline: 2026-10-08

Target https://rentwiselk.pages.dev/; 8 URLs; 57 rules PASS, 10 WARN-NEW categories, 0 FAIL-NEW; exit code 2. Scan completed with warnings, not a clean security pass. Initial console/report copies preserved under evidence/zap-initial-20261008/. SETUP-001 launcher fix retest succeeded in completing the baseline scan. No agent scan execution.

Warnings: Cache-control directives, missing anti-clickjacking header, suspicious JavaScript comments, missing HSTS, missing CSP, storable/non-cacheable content, missing Permissions-Policy, cross-domain misconfiguration, Modern Web Application, missing/invalid COEP. These are scanner findings awaiting manual assessment; not all are confirmed exploitable vulnerabilities. Review evidence/URLs/risk/confidence before recording individual defects or selecting fixes. No fixes/deployment or security retests performed for these warnings. Public passive baseline does not establish authenticated-page/API security coverage.
