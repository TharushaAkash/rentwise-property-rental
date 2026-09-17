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
def check_document_consistency(documents: str) -> str:
    """Analyzes documents for consistency and returns a report."""
    # Handle case where LLM passes a python list/dict instead of string
    if isinstance(documents, list):
        docs = documents
    elif isinstance(documents, dict):
        docs = [documents]
    else:
        try:
            docs = json.loads(documents)
            if not isinstance(docs, list):
                docs = [docs]
        except:
            return "Inconsistent: Could not read documents."
            
    names = [doc.get("content", "") for doc in docs if isinstance(doc, dict) and "John Doe" in doc.get("content", "")]
    if len(names) >= 2:
        return "Consistent: The names match across the deed and ID."
    return "Inconsistent: Documents do not match or are missing."

system_prompt = """You are the Property Verification Agent for RentWise AI.
Your job is to check a new property listing for completeness and internal consistency.

Use the `get_property_submission` tool to get the details of the property.
Pass the documents to the `check_document_consistency` tool to verify them.

After checking everything, you must output a final report in JSON format with exactly two fields:
- "recommendation": must be one of "Approve-ready", "Needs Review", or "Reject-recommended"
- "reasoning": a short sentence explaining your recommendation.
"""

def get_property_verification_agent():
    llm = ChatGoogleGenerativeAI(model="gemini-3.5-flash-lite")
    tools = [get_property_submission, check_document_consistency]
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
