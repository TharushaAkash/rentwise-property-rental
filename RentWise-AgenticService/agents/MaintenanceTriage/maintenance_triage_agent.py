import os
from pathlib import Path
from typing import Dict, Any, List
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langgraph.graph import StateGraph, START, END
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.tools import tool
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# We need the state definition, let's import it
from ..state import AgentWorkflowState

# 1. Define Tools

@tool
def classify_issue(description: str) -> str:
    """
    Classifies a maintenance issue description into a Category and Priority.
    Categories: Plumbing, Electrical, HVAC, General, etc.
    Priorities: High, Medium, Low.
    Returns a string containing the classification.
    """
    # For a real implementation, you might use a lightweight LLM call or regex here.
    # We will do a simple keyword-based approach for demonstration.
    desc_lower = description.lower()
    
    category = "General"
    priority = "Low"
    
    if any(word in desc_lower for word in ["pipe", "water", "leak", "plumbing", "flood"]):
        category = "Plumbing"
        priority = "High" if "flood" in desc_lower or "burst" in desc_lower else "Medium"
    elif any(word in desc_lower for word in ["power", "wire", "electrical", "spark", "shock"]):
        category = "Electrical"
        priority = "High" if "spark" in desc_lower or "shock" in desc_lower else "Medium"
    elif any(word in desc_lower for word in ["ac", "heater", "hvac", "air conditioning"]):
        category = "HVAC"
        priority = "Medium"
        
    return f"Category: {category}, Priority: {priority}"

import requests

@tool
def find_service_provider(category: str, property_id: str) -> str:
    """Finds a service provider for the given category and property, utilizing fallback logic if necessary."""
    if not property_id or property_id == "None":
        return "No property ID provided. Cannot assign a provider."
        
    backend_url = os.getenv("BACKEND_API_URL", "http://localhost:5002").rstrip('/')
    api_key = os.getenv("BACKEND_API_KEY", "")
    headers = {"X-Api-Key": api_key}
    
    try:
        # 1. Fetch property details to get OwnerId and Address
        prop_resp = requests.get(f"{backend_url}/api/Properties/{property_id}", headers=headers)
        prop_resp.raise_for_status()
        prop_data = prop_resp.json()
        
        owner_id = prop_data.get("ownerId")
        property_address = prop_data.get("address", "")
        
        if not owner_id:
            return "Property does not have an associated Owner ID."
            
        # 2. Fetch service providers for this owner
        providers_resp = requests.get(f"{backend_url}/api/service-providers?ownerId={owner_id}", headers=headers)
        providers_resp.raise_for_status()
        providers = providers_resp.json()
        
        if not providers:
            return f"No service providers found for this owner (OwnerId: {owner_id})."
            
        # 3. Find exact match: Category + Service Area matches Property Address
        exact_matches = [p for p in providers if p.get("category", "").lower() == category.lower() 
                         and p.get("serviceArea", "").lower() == property_address.lower()]
                         
        if exact_matches:
            match = exact_matches[0]
            return f"Exact match found for location {property_address}: {match['name']} ({match['contactNumber']})"
            
        # 4. Fallback: Any provider in the same category
        category_matches = [p for p in providers if p.get("category", "").lower() == category.lower()]
        
        if category_matches:
            fallback = category_matches[0]
            return f"No exact location match. Fallback provider assigned: {fallback['name']} ({fallback['contactNumber']}) - Services {fallback['serviceArea']}"
            
        return f"No provider found for Category: {category} under this owner."
        
    except requests.exceptions.RequestException as e:
        return f"Failed to fetch data from backend: {str(e)}"

# 2. Define the Agent Logic

# We define the LLM
llm = ChatGoogleGenerativeAI(model="gemini-3.5-flash-lite", temperature=0)
tools = [classify_issue, find_service_provider]
llm_with_tools = llm.bind_tools(tools)

SYSTEM_PROMPT = """You are the Maintenance Triage Agent. Your job is to process tenant-reported maintenance issues.
Your workflow:
1. First, use the `classify_issue` tool to determine the issue's category and priority based on the objective description.
2. If a Property ID is provided, use the `find_service_provider` tool, passing the Category and Property ID. This tool automatically handles checking location and applying fallback logic to find a suitable service provider from the owner's database.
3. Finally, draft a JSON maintenance ticket and return it exactly in this format inside a markdown code block:

```json
{
  "category": "",
  "priority": "",
  "assigned_provider": "",
  "description": ""
}
```
If you cannot find a suitable provider (e.g. tool returns "No provider found..."), set "assigned_provider" to "Unassigned".
"""

def triage_node(state: AgentWorkflowState):
    print("--- Maintenance Triage Agent ---")
    objective = state.get("objective", "No objective provided")
    property_id = state.get("property_id")
    
    # Add property ID to the human message if it exists
    content = f"Issue: {objective}"
    if property_id:
        content += f"\nProperty ID: {property_id}"
        
    messages = [SystemMessage(content=SYSTEM_PROMPT), HumanMessage(content=content)]
    
    # We run a simple loop to handle tool calls
    max_iterations = 5
    for _ in range(max_iterations):
        response = llm_with_tools.invoke(messages)
        messages.append(response)
        
        if not response.tool_calls:
            # Agent has finished and returned a text response
            break
            
        # Execute tools
        for tool_call in response.tool_calls:
            if tool_call["name"] == "classify_issue":
                tool_res = classify_issue.invoke(tool_call["args"])
            elif tool_call["name"] == "find_service_provider":
                tool_res = find_service_provider.invoke(tool_call["args"])
            else:
                tool_res = f"Unknown tool: {tool_call['name']}"
                
            messages.append(
                {"role": "tool", "name": tool_call["name"], "content": str(tool_res), "tool_call_id": tool_call["id"]}
            )
            
    final_output = messages[-1].content if hasattr(messages[-1], "content") else str(messages[-1])
    
    # Handle LangChain list output (multimodal blocks)
    if isinstance(final_output, list):
        text_blocks = [block.get("text", "") for block in final_output if isinstance(block, dict) and block.get("type") == "text"]
        final_output = "\n".join(text_blocks)
        
    print("\n--- Final Agent Output ---")
    print(final_output)
    print("--------------------------\n")
    
    # Extract the JSON ticket from the output
    ticket_json = None
    if "```json" in final_output:
        try:
            json_str = final_output.split("```json")[1].split("```")[0].strip()
            ticket_json = json.loads(json_str)
        except Exception as e:
            print(f"Error parsing JSON ticket: {e}")
            
    if not ticket_json:
        # Check if the output is just valid JSON
        try:
            ticket_json = json.loads(final_output)
        except:
            pass

    if not ticket_json:
        # Fallback if the agent didn't follow the JSON format strictly
        ticket_json = {
            "category": "Unknown",
            "priority": "Unknown",
            "assigned_provider": "Unknown",
            "description": objective
        }
    
    return {
        "current_agent": "MaintenanceTriage",
        "maintenance_ticket": ticket_json
    }

def run_maintenance_triage_agent(state: AgentWorkflowState):
    return triage_node(state)
