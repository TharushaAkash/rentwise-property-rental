# Mobile property features

The mobile property screens follow the frontend's `PropertiesDashboard`, `PropertyForm`, `PropertyDetails`, `PropertyInspectModal`, and `BookingModal`. Only mobile files are changed.

## Entry points

- Owner / PropertyOwner: **Properties** opens their portfolio; **Tenants** opens inquiries and bookings.
- Admin / Administrator / SystemAdmin: **Properties** lists all properties and exposes approval, suspension, and pending-status controls.
- Tenant: **Discover** opens property details; **Bookings** shows their submitted requests.

## Included

- Portfolio counts, active/inactive filters, title/address search, refresh, add, inspect, edit, and confirmed deletion.
- Validated title, description, address, type, rent, bedrooms, bathrooms, area, amenities, suggested/custom tags, and administrator status fields.
- Multiple photo uploads, URL photos, sample photos, previews, removal of pending attachments, existing-photo display, utility/ownership files and URLs, and sample utility documents.
- Real multipart uploads. URL photos are downloaded and uploaded because the backend does not support creating photos from a JSON URL payload.
- Photo thumbnails, full-screen swipe/zoom gallery, previous/next controls, description expansion, specifications, listing dates, tags, facilities, map, owner call/email, saved favorites per account, and copy-to-share.
- Listing inspection, ownership documents, verification history, listing-fee submission, and role-specific admin actions.
- Tenant booking duration presets/custom months, move-in date, calculated end date, message, rent/deposit summary, availability checks, and real API submission.
- Owner booking filters, request details, confirm/decline with confirmation, and explicit demo-booking creation.
- Loading, empty, error, retry, and duplicate-submit protection. Partial upload retries retain the created listing and completed upload count.

## Existing service boundaries

- `POST /properties/{id}/proof` invokes the agentic verification workflow. Mobile displays returned listing state; it does not assume an attached document is verified.
- `/listing-fee` records fee metadata. It does not process a card payment, so mobile requests a payment method/reference rather than card credentials.
- `/property-applications` uses an in-memory backend collection. Requests can be lost after a backend restart. Availability is rechecked before submission, but atomic prevention of simultaneous bookings requires backend support.
- Confirming an application changes its status to `Accepted`. The frontend additionally creates a browser-local draft agreement. That browser storage is not shared with mobile, and the existing confirm endpoint does not create a persisted lease or send one to the tenant. Mobile reports the actual booking status without claiming a lease was sent.
- Existing profile, maintenance, and rentals implementations are outside the property feature work. A subsequent analyzer cleanup fixes rental string interpolation and theme references, and removes unused maintenance/matching code; it does not implement the rental demo's payment or lease workflow.

## Verification

Run `flutter test test/property_test.dart` and `flutter analyze lib/features/properties lib/features/home/models test/property_test.dart`.

Tests cover API serialization/error propagation, multipart upload fields/MIME type, property normalization, month-end lease calculations, role-specific detail controls at 375px width, and required-field validation after scrolling. Native file picking, external phone/email apps, and live authenticated server workflows still need testing on a device with the relevant accounts. No test writes to the deployed backend.

## Android startup: missing `libflutter.so`

An APK that lacks Flutter's native engine will close before the Dart app starts. The affected debug APK was inspected and had plugin libraries but no `libflutter.so`. Rebuilding with Flutter for the connected ARM64 device restored `lib/arm64-v8a/libflutter.so` in the APK:

```powershell
# Run from RentWise-Mobile for an ARM64 Android phone.
flutter build apk --debug --target-platform android-arm64
adb install -r build/app/outputs/flutter-apk/app-debug.apk
```

For normal development, use `flutter run -d <device-id>` so Flutter selects the device architecture. The APK above targets ARM64; do not use it for a different architecture. The Android build settings did not need changing for this repair.
