# Document correction messages

Admins open **Admin Dashboard → Properties → Inspect → Document messages to owner**,
choose a document (or a general request), and send a note using **Request new document**.
The note is private to administrators and the property's owner.

Owners open **My Properties → Document messages → Upload replacement**. The
replacement file is uploaded using the existing storage endpoint and submitted
through the existing proof verification workflow. The original file remains
available. The message becomes **Replacement submitted**, and the listing stays
pending until an administrator reviews it. Administrators can use **Refresh replies**
to open the replacement file and then use the existing approval/rejection actions.

Messages are in-app; this feature does not send email or SMS. The owner inbox
refreshes every 30 seconds while visible, on window focus, and on manual refresh.

Deployment requires the `AddDocumentReviewRequests` database migration. The backend's
existing startup migration runner applies it; check deployment logs to confirm it
succeeded before using this feature. No deployed database was changed during development.

Run the integration regression checks from the repository root:

```powershell
dotnet run --project tests/DocumentReviews/DocumentReviews.Tests.csproj --configuration Release
```

The tests use a temporary in-memory SQLite database, real controller methods and
owner/admin identities. They cover private inbox access, note validation, duplicate
requests, ownership checks, replacement linkage, preserving old documents, and
resubmission when the AI service is unavailable. No live messages are sent.
