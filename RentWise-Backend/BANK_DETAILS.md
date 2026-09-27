# Owner bank transfer instructions

Owners save their bank name, branch, account holder and account number under **My Profile → Bank transfer details**. The fields are stored on their user record by migration `AddOwnerBankDetails`. No default or example bank account is inserted.

After deploying/restarting the backend with its normal migration process, save the owner's details, then open an existing tenant agreement's payment dialog and choose **Bank Transfer**. Instructions are loaded from that agreement's owner. **Refresh details** reloads subsequent owner changes. Account numbers remain strings so leading zeroes are preserved.

- `GET/PUT /api/bank-details/mine`: authenticated property owners manage only their own details.
- `GET /api/bank-details/agreements/{id}`: only that agreement's tenant or owner can read its transfer instructions.
- Bank fields are excluded from generic user serialization, including user objects nested in property/agreement responses.
- Missing details, failed loads and unsaved local agreement placeholders disable bank transfer confirmation. Card selection is unaffected.

This change supplies the recipient instructions; it does not integrate a bank or verify that funds arrived. Existing payment-recording behaviour is unchanged.

Verification: `dotnet run --project tests/RentalWorkflows` includes persistence, authorization, missing-details, leading-zero, owner-update and serialization checks. The headless fixture browser check is `RentWise-AgenticService/.venv/Scripts/python.exe tests/RentalWorkflows/ui_smoke.py` after building the frontend; it requires Windows Edge and the Python service environment's requests/websockets packages.
