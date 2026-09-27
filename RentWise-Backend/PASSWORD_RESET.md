# Password reset email setup

Set the following in the backend `.env` (never commit real credentials), environment, or equivalent `Smtp` configuration section:

```dotenv
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_FROM=no-reply@example.com
SMTP_USERNAME=your-smtp-username
SMTP_PASSWORD=your-smtp-password
```

Use an SMTP provider with STARTTLS on port 587 and an authorized sender address. For Gmail use an app password, not the account password. Restart the backend after configuring it.

The login page links to `/forgot-password`. Registered, active accounts receive a six-digit code. Codes expire after 60 seconds; resending replaces all previous reset credentials. Five incorrect guesses exhaust a code. Successful verification exchanges the code for a single-use, ten-minute reset token kept only in frontend memory. Password confirmation is validated by both the UI and API. Unknown emails receive the same generic response without sending mail.

Reset state is held in a bounded, in-process cache. API restarts invalidate pending codes; this implementation supports a single API instance. Before deploying multiple instances, replace the store with shared storage and atomic operations. IP limits use the connection IP; configure trusted proxy forwarding when deploying behind a reverse proxy.

Email delivery requires working SMTP credentials. No emails are sent during automated tests.
