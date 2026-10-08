# RentWise non-functional assessment (NF-01, NF-02, NF-03, NF-04, NF-07)

Prepared only: no installations, tests, scans or audits executed by the agent. All results pending user execution. Commands below use PowerShell. Run security scans against your own authorized deployment; run stress and active API scans against a disposable staging environment, because active API scans may create/update/delete data. No credentials are required by the supplied public-endpoint performance tests.

## Scope and why each additional type is relevant

| ID | Type / tool | Selected scope | Justification / evaluation |
|---|---|---|---|
| NF-01 | Performance / k6 | Real public property browse; optional real detail ID; 1 VU for 1 minute | Required: rental searches need responsive API data |
| NF-02 | Load / k6 | Ramp 5 then 10 concurrent VUs, then ramp down | Additional: multiple tenants browse simultaneously; evaluates expected concurrent demand |
| NF-03 | Stress / k6 | Ramp 10, 25, 50 VUs then down; repeat normal test afterwards | Additional: reveals capacity limits, failures and recovery during traffic spikes |
| NF-04 | Security / OWASP ZAP | Deployed React passive baseline; staging API OpenAPI active scan | Required: account/property/lease data need protection; scanner findings need manual validation |
| NF-07 | Compatibility / Playwright | Existing login, protected route, property creation, search, maintenance browser workflows across Chromium/Firefox/WebKit | Additional: tenants/owners use different browser engines; identical UI behaviours should work across all |

NF-07 reuses the final frontend assessment workflows with mocked responses; it verifies browser UI compatibility, not actual backend persistence. WebKit approximates Safari's engine; this is desktop testing, not native Safari/iOS device certification.

## 1. Install tools yourself

Install k6 using the official Windows installation instructions and verify `k6 version`. Install/start Docker Desktop for the ZAP commands. Existing frontend Node requirements apply.

From repository root:

```powershell
Set-Location "E:\Y3S1\Software Engineering Framworks\project-demo\RentWiseAI"
k6 version
docker version
New-Item -ItemType Directory -Force tests/NonFunctionalAssessment/evidence/initial-run | Out-Null
```

Frontend setup:

```powershell
Set-Location RentWise-Frontend
npm install
npx playwright install chromium firefox webkit
Set-Location ..
```

Record the actual tool versions in your report. Pin the ZAP image version for repeatable retesting.

## 2. API URL and dataset

Start backend/database or use an authorized deployed API. Use a nonempty dataset and stable build. Set the real base URL INCLUDING /api; the command below uses your Newman-configured API:

```powershell
$env:API_BASE_URL = "https://rentwise-api-v2-athfc8b8g7c2ahfc.eastasia-01.azurewebsites.net/api"
# Optional: an existing active property ID, not the literal example below.
$env:PROPERTY_ID = "EXISTING_PROPERTY_ID"
```

Leave PROPERTY_ID unset for browse-only testing:

```powershell
Remove-Item Env:PROPERTY_ID -ErrorAction SilentlyContinue
```

The script performs real GETs. It checks 200 and response structure, not empty-vs-populated data. Run once to warm the API, then measure; clearly identify cold-start vs warm-run evidence. Do not combine them silently.

## 3. NF-01 normal performance

```powershell
$env:PROFILE = "normal"
k6 run --summary-export tests/NonFunctionalAssessment/evidence/initial-run/NF-01.json tests/NonFunctionalAssessment/performance/api.js
```

Proposed assessment targets (not established product SLAs): p95 < 1500 ms, request failure rate < 1%, checks > 99%. Review and agree these targets before running. Report p50/p90/p95/max, error rate, throughput and data/environment. Set P95_MS only when defining the agreed target before measurement.

## 4. NF-02 concurrent load

```powershell
$env:PROFILE = "load"
k6 run --summary-export tests/NonFunctionalAssessment/evidence/initial-run/NF-02.json tests/NonFunctionalAssessment/performance/api.js
```

Maximum 10 concurrent VUs. Each iteration sleeps one second; VUs are concurrent sessions, not fixed requests-per-second. Record CPU/memory/database behaviour separately from server monitoring.

## 5. NF-03 stress and recovery

Use a disposable staging backend with sufficient monitoring and agreed test window. The default is a bounded exploratory 50-VU test; it may not exceed your system capacity. If saturation is not reached, report "no saturation observed up to 50 VUs" instead of claiming a proven breaking point.

```powershell
$env:PROFILE = "stress"
k6 run --out json=tests/NonFunctionalAssessment/evidence/initial-run/NF-03-timeseries.json --summary-export tests/NonFunctionalAssessment/evidence/initial-run/NF-03.json tests/NonFunctionalAssessment/performance/api.js
$env:PROFILE = "normal"
k6 run --summary-export tests/NonFunctionalAssessment/evidence/initial-run/NF-03-recovery.json tests/NonFunctionalAssessment/performance/api.js
```

Stress exploratory limits: p95 < 3000 ms, failed requests < 5%; failure-rate threshold stops sustained overload after at least 30 seconds. Preserve stopped runs too. checks >99% remains a stricter response-integrity indicator. Observe server health, saturation, recovery and any data integrity issue. Stop manually with Ctrl+C if server health deteriorates. Threshold breaches are evidence for investigation, not automatically application defects.

## 6. NF-04 ZAP security

Run from repository root. Replace with deployed web URL (not the API URL):

```powershell
./tests/NonFunctionalAssessment/security/scan.ps1 -TargetUrl "https://YOUR_WEB_HOST" -Mode Baseline
```

Baseline crawls and passively reports reachable issues; it does not cover every SPA screen, authenticated feature, authorization rule or vulnerability. For authenticated React pages, use ZAP desktop browser/manual exploration with a test account, then export alerts and document actual scope. Keep auth tokens and raw sensitive responses out of Git.

For an active scan of the staging ASP.NET API, supply its actual accessible OpenAPI JSON URL (commonly /swagger/v1/swagger.json; confirm it is enabled on that test deployment):

```powershell
./tests/NonFunctionalAssessment/security/scan.ps1 -TargetUrl "https://YOUR_STAGING_API_HOST/swagger/v1/swagger.json" -Mode Api
```

Do not pass /api as if it were an OpenAPI document. If deployed Swagger is unavailable, enable it in staging or use ZAP desktop to inspect API traffic and record the reduced scan scope. The active API scan may exercise write endpoints; use disposable data. The public unauthenticated scan does not prove role-based access controls; retain the separate existing API-11/API-12 Newman checks.

Reports: evidence/initial-run/zap/Baseline.html,json and Api.html,json, plus console output. ZAP exit 0 clean, 1 FAIL, 2 WARN, 3 execution error; review each alert's URL, risk, confidence and actual applicability. Track confirmed issues in DEFECTS.md; retain dismissed alerts with reasons. No scan proves the absence of vulnerabilities.

## 7. NF-07 three browser engines

```powershell
Set-Location RentWise-Frontend
npm run test:nf:compatibility -- --headed
```

One browser at a time if diagnosing:

```powershell
npm run test:nf:compatibility -- --project=chromium --headed
npm run test:nf:compatibility -- --project=firefox --headed
npm run test:nf:compatibility -- --project=webkit --headed
```

The config starts frontend port 4180. It reuses five final UI workflows per engine (15 planned executions), with screenshots and failure traces. No backend is needed for these mocked workflows. Report actual counts only after execution.

```powershell
npx playwright show-report ../tests/NonFunctionalAssessment/evidence/compatibility/report
```

## 8. Evidence, fixes and retesting

Before any rerun copy evidence/initial-run and evidence/compatibility into dated archive folders. Keep tool versions, console output, reports, build commit and configuration without secrets. Use -RunLabel retest-YYYYMMDD for ZAP and separate --summary-export filenames for k6. Preserve compatibility report/results before repeating because they are overwritten.

Follow DEFECTS.md: record actual failing result -> reproduce -> confirm cause -> correct important defects -> focused retest -> regression under comparable environment/load -> close only with passing evidence. For security record risk/confidence, fix explanation, retest and remaining scope limitations. User supplied passing performance, load, stress/recovery and compatibility results. Security remains pending.

## Official references

- k6 installation: https://grafana.com/docs/k6/latest/set-up/install-k6/
- k6 thresholds: https://grafana.com/docs/k6/latest/using-k6/thresholds/
- k6 exports/options: https://grafana.com/docs/k6/latest/using-k6/k6-options/reference/
- ZAP baseline: https://www.zaproxy.org/docs/docker/baseline-scan/
- ZAP API scan: https://www.zaproxy.org/docs/docker/api-scan/
- Playwright browsers: https://playwright.dev/docs/browsers
