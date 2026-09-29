from fastapi import FastAPI
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment variables (e.g., GOOGLE_API_KEY)
load_dotenv()

app = FastAPI(title="RentWise Agentic Service")

# Separate, authenticated endpoint: existing single-agent routes remain compatible.
from agents.rental_workflow import StepRequest, run_step
from fastapi import Header, HTTPException
import secrets
import os

@app.middleware("http")
async def require_internal_caller(request, call_next):
    if request.url.path.startswith("/workflow/"):
        from fastapi.responses import JSONResponse
        expected = os.getenv("AGENT_WORKFLOW_KEY", "")
        supplied = request.headers.get("X-Workflow-Key", "")
        if not expected or not secrets.compare_digest(expected, supplied):
            return JSONResponse(status_code=403, content={"message": "Internal service access required"})
    return await call_next(request)


@app.post("/internal/rental-step")
def rental_step(req: StepRequest, x_workflow_key: str = Header(default="")):
    configured_key = os.getenv("AGENT_WORKFLOW_KEY", "")
    if not configured_key or not secrets.compare_digest(x_workflow_key, configured_key):
        raise HTTPException(status_code=403, detail="Internal workflow access required")
    try:
        return run_step(req)
    except Exception:
        # Provider payloads may contain private context. Only a safe error leaves this boundary.
        raise HTTPException(status_code=502, detail="Rental agent failed safely; no business action was executed")

class WorkflowRequest(BaseModel):
    objective: str = ""
    tenant_profile: dict = None
    property_id: str = None
    document_url: str = None
    # Add other parameters as needed based on the workflow type

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "RentWise Agentic Service"}

@app.post("/workflow/match-location")
def run_matching_workflow(req: WorkflowRequest):
    if not req.objective:
        return {"error": "objective is required"}
        
    from agents.MatchingLocation.matching_location_agent import public_matching_error
    from fastapi.responses import JSONResponse
    try:
        from agents.orchestrator import build_matching_graph
        result = build_matching_graph().invoke({
            "objective": req.objective, "tenant_profile": req.tenant_profile or {},
            "current_agent": "MatchingLocation", "matching_results": []
        })
        return {"status": "completed", "matching_results": result.get("matching_results", []),
                "destination_landmark": result.get("destination_landmark", ""),
                "summary_recommendation": result.get("summary_recommendation", ""),
                "extracted_filters": result.get("extracted_filters", {})}
    except Exception as exc:
        error = public_matching_error(exc)
        return JSONResponse(status_code=error.status, content={"status": "failed", "code": error.code, "message": str(error)})

@app.post("/workflow/verify-property")
def run_verification_workflow(req: WorkflowRequest):
    if not req.property_id:
        return {"error": "property_id is required"}
    
    from agents.orchestrator import build_verification_graph
    
    graph = build_verification_graph()
    
    initial_state = {
        "property_id": req.property_id,
        "verification_report": {},
        "document_url": req.document_url,
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
    import os
    import re
    from langchain_google_genai import ChatGoogleGenerativeAI
    from langchain_core.messages import HumanMessage
    
    try:
        vision_llm = ChatGoogleGenerativeAI(model="gemini-3.5-flash-lite")
        
        message = HumanMessage(
            content=[
                {
                    "type": "text",
                    "text": f"Does the NIC (National Identity Card) number in this image match '{req.nic_number}'? Check carefully. Reply ONLY with YES if it matches, or NO if it does not."
                },
                {
                    "type": "image_url",
                    "image_url": req.image_url
                }
            ]
        )
        
        response = vision_llm.invoke([message])
        
        # Handle case where response.content is a list of blocks
        content = response.content
        if isinstance(content, list):
            extracted_text = next((block["text"] for block in content if isinstance(block, dict) and "text" in block), str(content))
        else:
            extracted_text = str(content)
            
        extracted_text = extracted_text.upper().strip()
        
        # Check if the AI responded with YES
        is_verified = "YES" in extracted_text
        
        print(f"Gemini output for matching NIC {req.nic_number}: {extracted_text}")
        print(f"Verified: {is_verified}")
        return {"isVerified": is_verified, "extractedNic": extracted_text}
    except Exception as e:
        print(f"Exception: {e}")
        return {"isVerified": False, "error": str(e)}
