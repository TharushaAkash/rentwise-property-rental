# Frontend responsive smoke check

Checks 12 initial page layouts at 320, 390, 768 and 1440 CSS pixels using headless Microsoft Edge on Windows. The latest local run passed all 48 combinations without document horizontal overflow.

Routes: home, login, register, find rentals, saved items, rental workflows, owner properties, owner profile, tenants, agreements, maintenance and administrator dashboard. Protected routes use fixture tokens; unexpected login redirects fail the check.

This is a layout check with empty fixture API responses, not a backend integration test. It does not prove that populated tables, every modal, all tabs, real phones or the hosted deployment are responsive. Check those manually with realistic data before release.

## Run from the repository root (PowerShell)

Requires Edge and Python with `requests` and `websockets` installed (available in the project's AgenticService virtual environment).

```powershell
Push-Location RentWise-Frontend
$previousApiUrl = $env:VITE_API_URL
try {
    $env:VITE_API_URL = '/api'
    npm run build
} finally {
    $env:VITE_API_URL = $previousApiUrl
    Pop-Location
}
RentWise-AgenticService/.venv/Scripts/python.exe tests/responsive/check.py
```

The fixture build must use `/api`; do not deploy this test build. Rebuild normally for deployment.

Results are saved to `evidence/responsive/results.json`, with viewport screenshots named `ROLE-ROUTE-WIDTH.png`. Only the 320 and 390 pixel screenshots are captured. The script fails for unexpected redirects, loading failures, render failures or document horizontal overflow. Navigation and table containers may intentionally scroll horizontally.

## Fixes from this review

- Owner/admin sidebar becomes a horizontal navigation area below the desktop breakpoint, leaving room for page content.
- Public header actions wrap on small screens.
- Properties and maintenance tabs, property summary and administrator filters wrap.
- Owner tenant tabs scroll within their own container.

Frontend production compilation passed. Lint completed without errors and reported existing warnings.
