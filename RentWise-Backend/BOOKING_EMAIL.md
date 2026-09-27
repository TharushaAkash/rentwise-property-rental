# Booking and payment confirmation email

Booking checkout uses `POST /api/agreements/{id}/pay`; the tenant portal uses `POST /api/agreements/{id}/payments`. Both routes email the registered tenant after saving a successful payment and activating the lease. Unsuccessful payment records do not send confirmation. The portal can supply `paymentMethod` and receives `confirmationEmailSent` in its payment response; these two fields are response/request metadata, not database columns.

The email includes the property and address, owner name, booking reference, lease dates/status, monthly rent, security deposit, amount paid, payment reference, date (UTC), method and status. Both HTML and plain-text versions are included. No card details are emailed.

Use the same `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, `SMTP_USERNAME` and `SMTP_PASSWORD` settings documented in [PASSWORD_RESET.md](PASSWORD_RESET.md). No additional package or database migration is required. Deploy the updated backend and configure SMTP on Azure for the mobile app to use it.

The existing payment endpoint records payment success directly; this feature does not add payment-gateway verification. Local/offline frontend-only payments do not trigger email.

Email delivery is attempted after saving the payment, with an eight-second timeout. The response includes `confirmationEmailSent` (SMTP acceptance, not guaranteed inbox delivery). SMTP failures are logged without undoing payment or returning a payment failure. There is no automatic email retry; do not submit another payment just to retry email.

Run `dotnet run --project tests/BookingEmail/BookingEmail.Tests.csproj` from the repository root for isolated checks using SQLite and a fake sender. These checks do not send real emails.
