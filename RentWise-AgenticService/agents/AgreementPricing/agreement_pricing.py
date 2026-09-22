import os
import requests
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from langchain.tools import tool
from ..state import AgentWorkflowState

@tool
def get_market_rent(location: str, property_type: str, bedrooms: int) -> dict:
    """
    Fetches the market average rent for similar properties in the given location.
    Use this to compare a proposed rent against the typical market range.
    """
    try:
        response = requests.get(
            f"http://localhost:5002/api/properties/market-rent",
            params={
                "location": location,
                "propertyType": property_type,
                "bedrooms": bedrooms
            }
        )
        if response.status_code == 200:
            return response.json()
        return {"error": f"Failed to fetch market rent: {response.status_code}"}
    except Exception as e:
        return {"error": str(e)}

@tool
def extract_agreement_terms(rent: float, start_date: str, end_date: str, property_details: str) -> str:
    """
    Extracts and summarizes the key terms of the rental agreement in plain language.
    Pass the raw details (rent, dates, property details) to generate a summary.
    """
    return (
        f"This is a rental agreement for {property_details}. "
        f"The agreed monthly rent is Rs. {rent:,.2f}. "
        f"The lease period starts on {start_date} and ends on {end_date}."
    )

def get_agreement_pricing_agent():
    llm = ChatGoogleGenerativeAI(model="gemini-3.5-flash-lite")
    tools = [get_market_rent, extract_agreement_terms]
    return llm.bind_tools(tools)

SYSTEM_PROMPT = """You are the Agreement & Pricing Agent for RentWise.
Your task is to:
1. Summarize the rental agreement's key terms in plain language using the `extract_agreement_terms` tool. If start/end dates are missing, invent a 1-year lease starting on the 1st of next month.
2. Compare the proposed rent against similar properties using the `get_market_rent` tool. (Use the property context provided).
3. Flag whether the proposed rent is above, below, or within the typical market range.
4. EXPLICITLY state that this market assessment is a "non-binding estimate".

You will receive the proposed agreement details (rent, dates, property location, type, bedrooms). 
If any details are "Unknown", invent reasonable placeholders to complete your task.
You must output a structured JSON response containing:
- "summary": The plain-language summary of terms.
- "market_assessment": Your assessment of the rent compared to the market.
- "proposed_rent": The rent figure being evaluated.

Return your final output inside a JSON block:
```json
{
  "summary": "...",
  "market_assessment": "...",
  "proposed_rent": 75000
}
```
"""

def run_agreement_pricing_agent(state: AgentWorkflowState):
    agent = get_agreement_pricing_agent()
    
    objective = state.get("objective", "")
    property_id = state.get("property_id", "")
    
    # Fetch property details to give context to the agent
    prop_details = "Unknown"
    rent = 0
    try:
        prop_response = requests.get(f"http://localhost:5002/api/properties/{property_id}")
        if prop_response.status_code == 200:
            prop_data = prop_response.json()
            rent = prop_data.get("monthlyRent", 0)
            prop_details = (
                f"Location: {prop_data.get('address')}, "
                f"Type: {prop_data.get('propertyType')}, "
                f"Bedrooms: {prop_data.get('bedrooms')}, "
                f"Proposed Rent: Rs. {rent}"
            )
    except Exception:
        pass
        
    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=f"Draft an agreement for Property ID {property_id}.\nProperty Context: {prop_details}\nTenant Objective: {objective}")
    ]
    
    # Run the agent with tool calling loop
    current_messages = messages.copy()
    while True:
        response = agent.invoke(current_messages)
        current_messages.append(response)
        
        if not response.tool_calls:
            break
            
        for tool_call in response.tool_calls:
            if tool_call["name"] == "get_market_rent":
                tool_msg = get_market_rent.invoke(tool_call)
            elif tool_call["name"] == "extract_agreement_terms":
                tool_msg = extract_agreement_terms.invoke(tool_call)
            else:
                tool_msg = {"error": f"Unknown tool: {tool_call['name']}"}
                
            current_messages.append({
                "role": "tool",
                "tool_call_id": tool_call["id"],
                "name": tool_call["name"],
                "content": str(tool_msg)
            })

    # Extract JSON from final response
    content = response.content
    if isinstance(content, list):
        content = " ".join([c.get("text", "") for c in content if "text" in c])
        
    try:
        import json
        if "```json" in content:
            json_str = content.split("```json")[1].split("```")[0].strip()
        else:
            json_str = content
        draft = json.loads(json_str)
    except Exception as e:
        draft = {"error": "Failed to parse agent output", "raw": content}

    return {
        "current_agent": "AgreementPricing",
        "agreement_draft": draft
    }
