from fastapi import FastAPI
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment variables (e.g., GOOGLE_API_KEY)
load_dotenv()

app = FastAPI(title="RentWise Agentic Service")

class WorkflowRequest(BaseModel):
    objective: str = ""
    tenant_profile: dict = None
    property_id: str = None
    # Add other parameters as needed based on the workflow type

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "RentWise Agentic Service"}

@app.post("/workflow/match-location")
def run_matching_workflow(req: WorkflowRequest):
    if not req.objective:
        return {"error": "objective is required"}
        
    from agents.orchestrator import build_matching_graph
    graph = build_matching_graph()
    
    initial_state = {
        "objective": req.objective,
        "tenant_profile": req.tenant_profile or {},
        "current_agent": "MatchingLocation",
        "matching_results": []
    }
    
    result = graph.invoke(initial_state)
    
    return {
        "status": "completed",
        "matching_results": result.get("matching_results", [])
    }

@app.post("/workflow/verify-property")
def run_verification_workflow(req: WorkflowRequest):
    if not req.property_id:
        return {"error": "property_id is required"}
    
    from agents.orchestrator import build_verification_graph
    
    graph = build_verification_graph()
    
    initial_state = {
        "property_id": req.property_id,
        "verification_report": {},
        "current_agent": "PropertyVerification"
    }
    
    # In a real setup, you would run this asynchronously or as a background task
    # For testing, we can run it synchronously
    result = graph.invoke(initial_state)
    
    return {
        "status": "completed", 
        "property_id": req.property_id,
        "report": result.get("verification_report", {})
    }

@app.post("/workflow/maintenance-triage")
def run_maintenance_workflow(req: WorkflowRequest):
    if not req.objective:
        return {"error": "objective (description of the issue) is required"}
    
    from agents.orchestrator import build_maintenance_graph
    graph = build_maintenance_graph()
    
    initial_state = {
        "objective": req.objective,
        "property_id": req.property_id,
        "current_agent": "MaintenanceTriage"
    }
    
    result = graph.invoke(initial_state)
    
    return {
        "status": "completed", 
        "ticket": result.get("maintenance_ticket", {})
    }
