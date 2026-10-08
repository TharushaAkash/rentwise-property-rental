# Final frontend React assessment: WEB-01?WEB-18

No tests were executed while preparing this suite. Previous test code and existing reports were archived under `evidence/previous-suite-20261008-160753/`. Existing `evidence/previous-run/` and WEB-13 initial failure/fix evidence remain intact. Old IDs/results do not prove the final scenarios passed.

## 1. Start from the frontend directory

PowerShell:

```powershell
Set-Location "E:\Y3S1\Software Engineering Framworks\project-demo\RentWiseAI\RentWise-Frontend"
node --version
npm install
npx playwright install chromium
```

Use the Node version required by package.json (24.15 or later). `npm install` installs MSW and updates package-lock.json. RTL runs React components inside Vitest/jsdom. MSW intercepts HTTP in the specified component tests. Playwright opens Chromium. WEB-18 alone uses the actual API.

## 2. Run component/unit tests

```powershell
npm run test:web
```

Individual files:

```powershell
npm run test:web -- tests/web-assessment/unit/login.spec.jsx
npm run test:web -- tests/web-assessment/unit/property-form.spec.jsx
npm run test:web -- tests/web-assessment/unit/property-management.spec.jsx
npm run test:web -- tests/web-assessment/unit/listings.spec.jsx
npm run test:web -- tests/web-assessment/unit/search.spec.jsx
npm run test:web -- tests/web-assessment/unit/agreements.spec.jsx
npm run test:web -- tests/web-assessment/unit/maintenance.spec.jsx
```

## 3. Run mocked browser UI workflows

No backend or credentials required; test fixtures provide authentication/API responses.

```powershell
npm run test:web:e2e -- --headed
```

Individual browser tests:

```powershell
npm run test:web:e2e -- --headed --grep WEB-01
npm run test:web:e2e -- --headed --grep WEB-03
npm run test:web:e2e -- --headed --grep WEB-05
npm run test:web:e2e -- --headed --grep WEB-09
npm run test:web:e2e -- --headed --grep WEB-16
```

The config starts the frontend on port 4178 automatically. Close an old assessment frontend if it serves outdated code/config.

## 4. Run real API integration: WEB-18

Start the ASP.NET backend and its database, or use your deployed test API. For local API hosting, run this in a separate terminal from the repository root:

```powershell
dotnet run --project RentWise-Backend/RentWise.API.csproj
```

Use the API URL printed by the backend; replace the example port below. The URL must include `/api`. Allow the frontend origin `http://127.0.0.1:4179` in backend CORS. Ensure at least one verified Active, unbooked property exists. An empty database cannot prove returned-property rendering.

From RentWise-Frontend:

```powershell
$env:LIVE_API_URL = "http://localhost:YOUR_PORT/api"
npm run test:web:live -- --headed
```

For a deployed backend, set LIVE_API_URL to its actual HTTPS API base URL instead. WEB-18 has no mocked responses or fake authentication; it loads public property browse data and checks the actual response plus the matching title in the browser. The config starts a separate frontend on port 4179 with VITE_API_URL set to this URL.

## 5. Run all final assessment tests

After configuring LIVE_API_URL:

```powershell
npm run test:web
npm run test:web:e2e
npm run test:web:live
```

Or stop automatically on a failed stage:

```powershell
npm run test:web:all
if ($LASTEXITCODE -eq 0) { npm run test:web:live }
```

`test:web:all` includes component tests and mocked browser workflows. WEB-18 is a separate explicit live stage. `npm test` also includes the older src/test suite and is not the final assessment-only command.

## 6. Reports, defects and retesting

```powershell
npm run test:web:report
npx playwright show-report tests/web-assessment/evidence/live-playwright-report
```

Vitest output: `evidence/vitest-results.json`. Mocked browser screenshots/traces: `evidence/browser-results/`; report: `evidence/playwright-report/`. Live screenshots/traces: `evidence/live-browser-results/`; report: `evidence/live-playwright-report/`.

Each run overwrites current reports. Copy output/reports/screenshots to a dated initial-run folder before fixes or retests. Preserve both failing and passing evidence. Follow DEFECTS.md: record actual failure, reproduce, fix app code, rerun the failed ID, then run the complete regression suite. Never change assertions just to hide an application defect.

## Final coverage mapping

| ID | Active file | Tool / API |
|---|---|---|
| WEB-01 | e2e/workflows.spec.js | Playwright; mocked successful login |
| WEB-02 | unit/login.spec.jsx | Vitest + RTL; validation/rejected login |
| WEB-03 | e2e/workflows.spec.js | Playwright; unauthenticated route |
| WEB-04 | unit/listings.spec.jsx | Vitest + RTL; listing fields |
| WEB-05 | e2e/workflows.spec.js | Playwright; mocked creation |
| WEB-06 | unit/property-form.spec.jsx | Vitest + RTL; required/rent/image boundaries |
| WEB-07 | unit/property-form.spec.jsx, unit/property-management.spec.jsx | Vitest + RTL; edited values/request/success |
| WEB-08 | unit/property-management.spec.jsx | Vitest + RTL; confirmation/delete/refresh |
| WEB-09 | e2e/workflows.spec.js | Playwright; mocked search criteria/results |
| WEB-10 | unit/search.spec.jsx | Vitest + RTL + MSW; actual browse hook/filter request/results |
| WEB-11 | unit/search.spec.jsx | Vitest + RTL + MSW; empty/error/retry |
| WEB-12 | unit/agreements.spec.jsx | Vitest + RTL + MSW fixture; agreement details in list |
| WEB-13 | unit/agreements.spec.jsx | Vitest + RTL + MSW fixture; signature/request/status |
| WEB-14 | unit/agreements.spec.jsx | Vitest + RTL + MSW; failed load |
| WEB-15 | unit/maintenance.spec.jsx | Vitest + RTL + MSW fixture; request fields |
| WEB-16 | e2e/workflows.spec.js | Playwright; mocked maintenance creation |
| WEB-17 | unit/maintenance.spec.jsx | Vitest + RTL + MSW; description validation/failed submission |
| WEB-18 | live/real-api.spec.js | Playwright + real ASP.NET API |

Multiple automated checks can implement one assessment ID. Mocked browser tests demonstrate UI workflows, not real backend persistence. Current status of every final scenario is **not run** until you provide the new run output.
