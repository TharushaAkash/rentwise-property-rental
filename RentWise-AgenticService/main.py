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

@app.post("/workflow/draft-agreement")
def run_draft_agreement_workflow(req: WorkflowRequest):
    if not req.objective or not req.property_id:
        return {"error": "objective and property_id are required"}
    
    from agents.orchestrator import build_matching_graph
    graph = build_matching_graph()
    
    initial_state = {
        "objective": req.objective,
        "property_id": req.property_id,
        "current_agent": "AgreementPricing"
    }
    
    result = graph.invoke(initial_state)
    
    return {
        "status": "completed", 
        "draft": result.get("agreement_draft", {})
    }

class NicVerificationRequest(BaseModel):
    nic_number: str
    image_url: str

@app.post("/workflow/verify-nic")
def verify_nic(req: NicVerificationRequest):
    import google.generativeai as genai
    import os
    import requests
    
    # Use google-genai direct call for simple OCR verification
    genai.configure(api_key=os.environ.get("GOOGLE_API_KEY", ""))
    
    try:
        # Download the image
        response = requests.get(req.image_url)
        if response.status_code != 200:
            return {"isVerified": False, "error": "Failed to download NIC image"}
            
        model = genai.GenerativeModel("gemini-1.5-flash")
        
        result = model.generate_content([
            f"Extract the NIC (National Identity Card) number from this image. Then compare it with this expected NIC: {req.nic_number}. Does it match? Just say 'MATCH' or 'MISMATCH' followed by the extracted number.",
            {"mime_type": "image/jpeg", "data": response.content}
        ])
        
        text = result.text.upper()
        is_verified = "MATCH" in text and "MISMATCH" not in text
        return {"isVerified": is_verified, "extractedNic": text}
    except Exception as e:
        return {"isVerified": False, "error": str(e)}
