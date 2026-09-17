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

@app.post("/workflow/search-and-recommend")
def run_search_workflow(req: WorkflowRequest):
    # TODO: Initialize state and invoke the orchestrator (LangGraph)
    return {"status": "running", "objective": req.objective}

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

# Other endpoints for specific agents can be added here
