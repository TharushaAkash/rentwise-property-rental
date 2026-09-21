import json
import os
import requests
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.prebuilt import create_react_agent
from .state import AgentWorkflowState

@tool
def get_property_submission(property_id: str) -> str:
    """Fetches a property submission including address, photos, and documents from the backend API."""
    backend_url = os.getenv("BACKEND_API_URL", "http://localhost:5002").rstrip('/')
    api_key = os.getenv("BACKEND_API_KEY", "")
    headers = {"X-Api-Key": api_key}
    
    try:
        # Fetch property details
        prop_resp = requests.get(f"{backend_url}/api/Properties/{property_id}", headers=headers)
        if prop_resp.status_code == 404:
            return json.dumps({"error": f"Property with ID {property_id} not found."})
        prop_resp.raise_for_status()
        property_data = prop_resp.json()
        
        # Fetch documents
        docs_resp = requests.get(f"{backend_url}/api/properties/{property_id}/documents", headers=headers)
        docs_resp.raise_for_status()
        documents_data = docs_resp.json()
        
        # Fetch photos
        photos_resp = requests.get(f"{backend_url}/api/properties/{property_id}/photos", headers=headers)
        photos_resp.raise_for_status()
        photos_data = photos_resp.json()
        
        # Combine data
        combined_data = {
            "property": property_data,
            "documents": documents_data,
            "photos": photos_data
        }
        return json.dumps(combined_data)
        
    except requests.exceptions.RequestException as e:
        return json.dumps({"error": f"Failed to fetch property details: {str(e)}"})

@tool
def check_document_consistency(property_address: str, document_url: str) -> str:
    """Analyzes a document image for consistency with the property address using OCR."""
    if not document_url:
        return "Inconsistent: No document URL provided."
        
    try:
        # Use a vision-capable model
        vision_llm = ChatGoogleGenerativeAI(model="gemini-3.5-flash-lite")
        
        # Prepare multimodal message
        message = HumanMessage(
            content=[
                {
                    "type": "text",
                    "text": f"Extract the address from this document. Does it match or closely resemble the following property address: '{property_address}'? Respond with 'Consistent: <reason>' or 'Inconsistent: <reason>'."
                },
                {
                    "type": "image_url",
                    "image_url": document_url
                }
            ]
        )
        
        response = vision_llm.invoke([message])
        return response.content
    except Exception as e:
        return f"Error analyzing document: {str(e)}"

@tool
def check_duplicate_property(address: str) -> str:
    """Checks if a property with the given address already exists in the system."""
    backend_url = os.getenv("BACKEND_API_URL", "http://localhost:5002").rstrip('/')
    api_key = os.getenv("BACKEND_API_KEY", "")
    headers = {"X-Api-Key": api_key}
    
    try:
        resp = requests.get(f"{backend_url}/api/Properties/check-duplicate", params={"address": address}, headers=headers)
        resp.raise_for_status()
        data = resp.json()
        if data.get("exists"):
            return f"Duplicate found: Property ID {data.get('propertyId')} with status {data.get('status')} already has this address."
        return "No duplicate property found. Address is unique."
    except Exception as e:
        return f"Error checking duplicate property: {str(e)}"

system_prompt = """You are the Property Verification Agent for RentWise AI.
Your job is to check a new property listing for completeness and internal consistency.

Steps:
1. Use the `get_property_submission` tool to get the details of the property, including its address and document URLs.
2. If there is a document URL (like an electricity bill), pass the property address and the document URL to the `check_document_consistency` tool to verify the address via OCR.
3. Use the `check_duplicate_property` tool with the property address to ensure no duplicates exist.

After checking everything, you must output a final report in JSON format with exactly two fields:
- "recommendation": must be one of "Approve-ready", "Needs Review", or "Reject-recommended"
- "reasoning": a short sentence explaining your recommendation based on the document consistency and duplicate checks.
"""

def get_property_verification_agent():
    llm = ChatGoogleGenerativeAI(model="gemini-3.5-flash-lite")
    tools = [get_property_submission, check_document_consistency, check_duplicate_property]
    agent = create_react_agent(llm, tools, prompt=system_prompt)
    return agent

def run_property_verification_agent(state: AgentWorkflowState):
    agent = get_property_verification_agent()
    
    property_id = state.get("property_id", "unknown_id")
    inputs = {"messages": [HumanMessage(content=f"Verify property ID: {property_id}")]}
    
    # Run the agent
    result = agent.invoke(inputs)
    final_message = result["messages"][-1].content
    
    # Extract string if content is a list of blocks
    if isinstance(final_message, list):
        text_content = next((block["text"] for block in final_message if isinstance(block, dict) and "text" in block), str(final_message))
    else:
        text_content = str(final_message)
        
    # Try to parse the JSON output if possible
    try:
        # Sometimes models wrap json in markdown block
        cleaned = text_content.replace("```json", "").replace("```", "").strip()
        report = json.loads(cleaned)
    except:
        report = {"recommendation": "Needs Review", "reasoning": text_content}
        
    state["verification_report"] = report
    return state
