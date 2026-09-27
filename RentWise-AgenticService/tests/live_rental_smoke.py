"""Optional real-provider smoke check using synthetic data only. No database writes.

Run explicitly from RentWise-AgenticService: .venv/Scripts/python.exe tests/live_rental_smoke.py
Requires configured model credentials and consumes model requests.
"""
import sys
from pathlib import Path
from uuid import uuid4
from datetime import date, timedelta

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from dotenv import load_dotenv
from agents.rental_workflow import StepRequest, ROLES, run_step

load_dotenv()
pid = str(uuid4())
property_data = {"id": pid, "title": "Synthetic Malabe home", "address": "Example Road, Malabe",
                 "monthlyRent": 50000, "status": "Active", "facilities": "Parking", "bedrooms": 2,
                 "bathrooms": 1, "propertyType": "House"}
data = {"workflowId": str(uuid4()), "objective": "A two bedroom home in Malabe with parking",
        "request": {"maxMonthlyRent": 60000, "startDate": str(date.today() + timedelta(days=10)),
                    "endDate": str(date.today() + timedelta(days=375))},
        "candidates": [property_data], "property": property_data, "outputs": {}}
for role in ROLES:
    try:
        result = run_step(StepRequest(role=role, input=data))
        data["outputs"][role] = result["output"]
        print(f"PASS: {role} real model tool + structured output", flush=True)
    except Exception as exc:
        # Do not print raw provider messages, credentials or full model output.
        print(f"FAIL: {role}: {type(exc).__name__}", flush=True)
        raise SystemExit(1)
print("Four live roles completed; no business records created.")
