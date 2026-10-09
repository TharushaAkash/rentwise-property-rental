# Backend API and PostgreSQL assessment

Separate test project for API-01 to API-12 and DB-01 to DB-03. The agent has not run, built, restored or installed these tests. On 2026-10-07 the user supplied a passing xUnit run: 33 passed, 0 failed, 0 skipped, duration 2 minutes 17 seconds. The user also supplied passing Newman output: 3 requests, 4 assertions, 0 failures, duration 6.1 seconds. The test suite was committed and pushed on test/api-db-sadila (cee0a9b); this result documentation update is not yet committed.

## Tools and coverage

| ID | Test | Tool / file |
| --- | --- | --- |
| API-01 | Create property: 201, owner/rent persisted, PendingVerification status | xUnit + WebApplicationFactory + PostgreSQL; ApiIntegrationTests.cs |
| API-02 | Read selected property fields | xUnit + WebApplicationFactory; ApiIntegrationTests.cs |
| API-03 | Update property and verify changed title in fresh context | xUnit + WebApplicationFactory; ApiIntegrationTests.cs |
| API-04 | Delete property, verify missing row and 404 detail | xUnit + WebApplicationFactory; ApiIntegrationTests.cs |
| API-05 | Search/filter location, inclusive rent boundaries, bedrooms and type | xUnit + WebApplicationFactory + real PostgreSQL query; ApiIntegrationTests.cs |
| API-06 | Negative criteria, malformed cursor, page-size boundaries; early validation unit checks | xUnit; ApiIntegrationTests.cs and BusinessUnitTests.cs |
| API-07 | Create agreement, verify owner/tenant/property and default six-month end date | xUnit + WebApplicationFactory; ApiIntegrationTests.cs |
| API-08 | Foreign-owner/missing-property agreement blocked before creation service call | xUnit + Moq; BusinessUnitTests.cs |
| API-09 | Owner creates maintenance request; request and initial history log persisted | xUnit + WebApplicationFactory; ApiIntegrationTests.cs |
| API-10 | Maintenance service forwards status/save failures; controller accepts valid and rejects invalid status, records history | xUnit + Moq; BusinessUnitTests.cs |
| API-11 | Protected create without bearer authentication returns 401 | xUnit + real JwtBearer middleware; also Postman/Newman security collection |
| API-12 | Authenticated Tenant property creation returns 403 and writes no row | xUnit + real JwtBearer middleware; also Postman/Newman security collection |
| DB-01 | Property/agreement/maintenance/user relationships reload from real database | xUnit + EF Core + PostgreSQL; DatabaseTests.cs |
| DB-02 | Required NOT NULL, FK, restricted owner deletion and active-booking unique index | xUnit + EF Core + PostgreSQL; DatabaseTests.cs |
| DB-03 | Apply actual migrations on fresh DB, verify migration history/idempotence; rollback and commit across contexts | EF Core + PostgreSQL; DatabaseTests.cs |

Search logic currently lives in PropertiesController.Browse. IPropertySearchService has no implementation; the suite tests the existing business query instead of claiming a nonexistent search service was tested. Moq unit tests use EF InMemory only for small controller fixtures; PostgreSQL constraints and HTTP integration tests never use InMemory/SQLite.

The existing agreement controller normalizes absent/invalid end dates to six months. API-07 checks that actual rule; API-08 checks ownership/property-existence rules. This suite does not claim financial/date validation beyond those checks. Maintenance controller currently permits an owner to submit a request for their own property and assigns that actor to TenantId; API-09 follows the actual contract.

## Requirements

- .NET 8 SDK.
- Docker Desktop running with Linux containers (disposable postgres:16-alpine).
- Internet access for NuGet restore and the initial Docker image pull.
- Node/npm only for Newman, or Postman desktop to run the collection manually.

The PostgreSQL fixture starts a new disposable container/database and applies real migrations. It never takes a production connection string. Container teardown removes its test database. Unit-only execution does not need Docker.

## Commands (repository root)

Install packages yourself:

```powershell
dotnet restore tests/BackendAssessment/BackendAssessment.Tests.csproj
```

Unit tests only (no Docker):

```powershell
dotnet test tests/BackendAssessment/BackendAssessment.Tests.csproj --filter "Area=Unit" --logger "console;verbosity=normal"
```

API integration/security tests (Docker required):

```powershell
dotnet test tests/BackendAssessment/BackendAssessment.Tests.csproj --filter "Area=API|Area=Security" --logger "console;verbosity=normal"
```

PostgreSQL integrity/migration/transaction tests:

```powershell
dotnet test tests/BackendAssessment/BackendAssessment.Tests.csproj --filter "Area=Database" --logger "console;verbosity=normal"
```

All assessment tests, preserving initial evidence:

```powershell
New-Item -ItemType Directory -Force tests/BackendAssessment/evidence/initial-run
dotnet test tests/BackendAssessment/BackendAssessment.Tests.csproj --logger "trx;LogFileName=assessment.trx" --results-directory tests/BackendAssessment/evidence/initial-run --logger "console;verbosity=normal" 2>&1 | Tee-Object -FilePath tests/BackendAssessment/evidence/initial-run/output.txt
```

One API/DB ID:

```powershell
dotnet test tests/BackendAssessment/BackendAssessment.Tests.csproj --filter "FullyQualifiedName~API_08"
dotnet test tests/BackendAssessment/BackendAssessment.Tests.csproj --filter "FullyQualifiedName~DB_02"
```

These WebApplicationFactory tests run the backend in an in-process test host. You do not start the backend/frontend/Python service manually. Authentication uses locally signed test JWTs and the actual JwtBearer validation/authorization pipeline. Real login credentials and identity-provider integration are outside that host's coverage.

## Test-host changes to backend

Program.cs exposes public partial Program for WebApplicationFactory and skips startup schema seeding/Supabase initialization only when the host environment is Testing. The fixture explicitly migrates its disposable database. Production/Development retain their startup behavior. The factory replaces the EF connection and JWT options; business services/controllers remain real for HTTP tests. No emails, file uploads, agent workflows or Supabase requests are exercised.

## Postman / Newman (separate running test backend)

The collection intentionally covers security only. Import Newman/security.postman_collection.json and Newman/environment.example.json into Postman, or use Newman:

```powershell
Push-Location tests/BackendAssessment/Newman
npm install
Copy-Item environment.example.json environment.local.json
```

Edit environment.local.json with a dedicated test backend baseUrl ending in /api, a current Tenant access token (tenantToken), and a test owner GUID (ownerId). Do not use admin credentials/tokens for this wrong-role check. The local environment and generated evidence are ignored by Git. Keep credentials out of submission artifacts. Use a dedicated test backend/database: the restricted POST should be denied, but an authorization defect could permit creation.

Start your test backend separately. Then:

```powershell
New-Item -ItemType Directory -Force ../evidence
npm test
Pop-Location
```

Newman uses --bail: if fixture authentication/role validation fails, fix setup before interpreting the wrong-role result. Reports are at tests/BackendAssessment/evidence/newman-results.json; preserve the initial file before reruns. Postman/Newman is independent of the disposable WebApplicationFactory container; they do not share accounts or JWT signing keys.

No HTML Newman reporter is installed; the suite provides CLI/JSON and xUnit TRX output. Capture screenshots of actual runner results separately if your assignment requires screenshots.

## Defects, fixes and retesting

1. Record initial observed Pass/Fail/Blocked per ID with output/TRX/report paths.
2. Reproduce a failure using the ID filter. Distinguish application defects from compile/test mistakes and Docker/NuGet/fixture problems.
3. Populate DEFECTS.md with expected/actual behavior, impact, reproduction, root cause and evidence.
4. Fix important defects in application code and retain meaningful regression checks. Do not weaken assertions or mark skipped tests as passing.
5. Rerun the exact failing ID after the fix. Save output/TRX under evidence/retest-run (use a new results-directory and output path).
6. Run the full assessment suite again; record regressions separately. Repeat relevant Newman requests for a security fix.
7. Close only after observed passing retest. Keep initial evidence and describe remaining gaps honestly.

The user-supplied xUnit output confirms all 33 tests passed with no skipped tests. No application defect was reported in that run. The separate user-pasted Newman result confirms 3 requests and 4 assertions passed with 0 failures. Preserve console/TRX and Newman JSON evidence separately. Add more cases for discovered defects rather than treating every simulated failure as a defect.


