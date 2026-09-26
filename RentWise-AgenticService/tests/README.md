# Property verification regression checks

Run from the repository root (PowerShell):

```powershell
Push-Location RentWise-AgenticService
.venv/Scripts/python.exe -m unittest discover -s tests -v
Pop-Location
node --test RentWise-Frontend/src/utils/addressVerification.test.js
dotnet run --project tests/ApiKeyMiddleware/ApiKeyMiddleware.Tests.csproj
dotnet build RentWise-Backend/RentWise.API.csproj --no-restore
npm --prefix RentWise-Frontend run build
```

The tests mock Gemini/backend calls and do not upload documents or change database records.

For live verification, configure:

- Backend `AgenticServiceUrl`: the Python service URL.
- Backend `AgenticServiceApiKey`: the shared service key.
- Python `BACKEND_API_URL`: the reachable .NET service URL (without `/api`).
- Python `BACKEND_API_KEY`: the same shared service key.
- Python `GOOGLE_API_KEY`: a valid Gemini key.
- Optional Python `PROPERTY_VERIFICATION_MODEL`: override the existing model default.

Uploading a file to `/documents` stores the file. Posting its URL to `/proof`
triggers verification. The latter response retains `success`, `message`, and
`document`, and also returns `report`, `status`, and `verificationCompleted`.
`success` means the proof was saved; consult `report.recommendation` for the
decision. `verificationCompleted` means a valid report was returned by the agent
service, including a possible `Needs Review` report.

`Approve-ready` keeps the existing automatic activation behavior. `Needs Review`
and `Reject-recommended` leave the listing pending administrator review (an
existing suspension stays suspended). A rejection recommendation does not make
the administrator's final rejection decision. AI reports are stored in the
existing `VerificationRecords.AgentReport` field; no migration is needed.

Existing properties without persisted verification evidence show pending status
instead of demo verification. Resubmit their proof or use the existing admin
approval action. Live Gemini, storage, and database integration still require
an end-to-end check with the deployed service configuration.
