# INT-03 cross-platform integration

Run web INT-03 first, then tests/IntegrationAssessment/prepare-mobile.ps1. From RentWise-Mobile:

```powershell
flutter pub get
flutter devices
flutter test integration_test/cross_platform/property_sync_test.dart -d YOUR_DEVICE_ID --dart-define-from-file=../tests/IntegrationAssessment/mobile.local.json --reporter expanded
```

This launches the real property-detail screen with real providers and the same owner test account/backend/record ID from web. It does not mock API responses or approve/publish the pending property. Owner access avoids requiring a real listing payment/admin approval for this read verification. Follow the full root IntegrationAssessment README for setup and evidence. No tests executed by the agent.
