import os
import json
import math
import requests
from typing import Dict, Any, List, Optional
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.tools import tool
from dotenv import load_dotenv

load_dotenv()

from ..state import AgentWorkflowState

class MatchingError(Exception):
    def __init__(self, message, status=502, code="AI_UNAVAILABLE"):
        super().__init__(message)
        self.status, self.code = status, code


def public_matching_error(error):
    if isinstance(error, MatchingError):
        return error
    description = str(error).lower()
    if any(word in description for word in ("429", "quota", "resource_exhausted", "resourceexhausted", "rate limit")):
        return MatchingError("AI usage limit reached. Please try again later.", 429, "AI_LIMIT_REACHED")
    if isinstance(error, TimeoutError) or "timeout" in description or "timed out" in description:
        return MatchingError("AI search timed out. Please try again.", 504, "AI_TIMEOUT")
    if "503" in description or "high demand" in description or "overloaded" in description:
        return MatchingError("The AI model is temporarily busy due to high demand. Please try again shortly.", 503, "AI_MODEL_BUSY")
    if any(word in description for word in ("api_key_invalid", "api key not valid", "permission_denied", "unauthenticated")):
        return MatchingError("AI service authentication failed. Please contact support.", 503, "AI_CONFIGURATION_ERROR")
    if isinstance(error, ConnectionError) or type(error).__name__ in ("ConnectError", "ConnectionError"):
        return MatchingError("The AI provider could not be reached. Please try again shortly.", 503, "AI_CONNECTION_ERROR")
    return MatchingError("AI matching is unavailable. Please try again later.")


def _json_response(content):
    if isinstance(content, list):
        content = "\n".join(b.get("text", "") for b in content if isinstance(b, dict))
    text = str(content).strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    return json.loads(text)


@tool
def search_properties(filters: Optional[str] = "{}") -> str:
    """
    Searches active rental properties matching structured criteria.
    `filters` can be a JSON string or key:value format specifying:
    - min_price (number)
    - max_price (number)
    - location / city (string)
    - bedrooms (number)
    - property_type (string: 'Apartment' | 'House')
    - facilities (comma-separated string or list)
    Returns JSON list of candidate property records.
    """
    parsed_filters = {}
    try:
        if isinstance(filters, str) and (filters.strip().startswith('{') or filters.strip().startswith('[')):
            parsed_filters = json.loads(filters)
        elif isinstance(filters, dict):
            parsed_filters = filters
    except:
        parsed_filters = {}

    backend_url = os.getenv("BACKEND_API_URL", "http://localhost:5174").rstrip('/')
    api_key = os.getenv("BACKEND_API_KEY", "")
    headers = {"X-Api-Key": api_key}
    
    properties_pool = []

    # 1. Attempt fetching from Backend API
    try:
        resp = requests.get(f"{backend_url}/api/Properties", headers=headers, timeout=4)
        resp.raise_for_status()
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list) and len(data) > 0:
                for p in data:
                    raw_status = p.get("status", p.get("Status"))
                    if str(raw_status).lower() in ["active", "1"]:
                        photo = p.get("photoUrl") or p.get("PhotoUrl")
                        if not photo and p.get("photos"):
                            photo = p["photos"][0].get("photoUrl")
                        properties_pool.append({
                            "id": str(p.get("id") or p.get("Id")),
                            "title": p.get("title") or p.get("Title"),
                            "description": p.get("description") or p.get("Description") or "",
                            "address": p.get("address") or p.get("Address") or "",
                            "city": p.get("city") or p.get("City") or "",
                            "monthlyRent": float(p.get("monthlyRent") or p.get("MonthlyRent") or 0),
                            "bedrooms": int(p.get("bedrooms") or p.get("Bedrooms") or 1),
                            "bathrooms": int(p.get("bathrooms") or p.get("Bathrooms") or 1),
                            "sqft": int(p.get("sqft") or p.get("Sqft") or 0),
                            "propertyType": p.get("propertyType") or p.get("PropertyType") or "Apartment",
                            "facilities": p.get("facilities") or p.get("Facilities") or "",
                            "photoUrl": photo or "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80",
                            "status": "Active"
                        })
    except Exception as e:
        raise MatchingError("Property listings could not be loaded. Please try again.", 503, "LISTINGS_UNAVAILABLE") from e

    # 3. Apply Filter Criteria
    min_price = float(parsed_filters.get("min_price") or parsed_filters.get("minBudget") or 0)
    max_price = float(parsed_filters.get("max_price") or parsed_filters.get("maxBudget") or float('inf'))
    req_bedrooms = parsed_filters.get("bedrooms")
    target_loc = str(parsed_filters.get("location") or parsed_filters.get("city") or "").lower().strip()
    target_type = str(parsed_filters.get("property_type") or "").lower().strip()

    filtered = []
    for prop in properties_pool:
        rent = prop.get("monthlyRent", 0)
        
        # Budget check (allow up to 10% tolerance for close matches)
        if min_price > 0 and rent < (min_price * 0.9):
            continue
        if max_price < float('inf') and rent > (max_price * 1.15):
            continue
            
        # Bedroom check (if strictly provided)
        if req_bedrooms is not None and str(req_bedrooms).isdigit():
            beds = int(req_bedrooms)
            if beds > 0 and prop.get("bedrooms", 1) < beds:
                continue

        # Property type check (if specified)
        if target_type and target_type not in ["any", "all"]:
            p_type = str(prop.get("propertyType", "")).lower()
            if target_type not in p_type and p_type not in target_type:
                continue

        # Location check
        if target_loc and target_loc not in ["any", "all", "sri lanka", "colombo"]:
            p_addr = str(prop.get("address", "")).lower()
            p_city = str(prop.get("city", "")).lower()
            
            # Split target_loc to handle "battaramulla or pelawatte" cases
            loc_parts = [p.strip() for p in target_loc.replace(' or ', ',').replace(' and ', ',').split(',') if p.strip()]
            
            # A property matches if ANY of the location parts are in its address or city
            matched = False
            for loc_part in loc_parts:
                if loc_part in p_addr or loc_part in p_city:
                    matched = True
                    break
            
            if not matched:
                continue

        filtered.append(prop)

    print(f"[DEBUG] Parsed Filters: {parsed_filters}")
    print(f"[DEBUG] Target Loc: {target_loc}")
    print(f"[DEBUG] Returning {len(filtered)} properties.")
    
    final_candidates = filtered
    return json.dumps(final_candidates)

def _ors_coordinates(address, key):
    response = requests.get("https://api.openrouteservice.org/geocode/search", params={
        "api_key": key, "text": address, "boundary.country": "LKA", "size": 2,
    }, timeout=15)
    response.raise_for_status()
    features = response.json().get("features", [])
    if not features:
        raise ValueError("Location not found")
    first = features[0]
    confidence = first.get("properties", {}).get("confidence", 0)
    if not isinstance(confidence, (int, float)) or confidence < 0.8:
        raise ValueError("Location ambiguous")
    if len(features) > 1 and features[1].get("properties", {}).get("confidence", 0) >= confidence - 0.05:
        if features[1].get("geometry", {}).get("coordinates") != first.get("geometry", {}).get("coordinates"):
            raise ValueError("Location ambiguous")
    coords = first["geometry"]["coordinates"]
    if len(coords) != 2 or not all(isinstance(v, (int, float)) and math.isfinite(v) for v in coords):
        raise ValueError("Invalid coordinates")
    return coords


@tool
def get_distance(origin: str = "", destination: str = "") -> str:
    """Calculate driving distance and estimated duration with openrouteservice.
    Return unavailable for unresolved addresses or routing failures; never guess.
    """
    result = {"origin": origin, "destination": destination, "distance_km": None,
              "travel_time_mins": None, "estimate_source": "unavailable",
              "commute_summary": "Route unavailable. Provide a precise property address and destination."}
    key = os.getenv("ORS_API_KEY", "").strip()
    if not key or not origin.strip() or not destination.strip():
        return json.dumps(result)
    try:
        coordinates = [_ors_coordinates(origin, key), _ors_coordinates(destination, key)]
        response = requests.post("https://api.openrouteservice.org/v2/directions/driving-car/json",
                                 headers={"Authorization": key},
                                 json={"coordinates": coordinates, "instructions": False}, timeout=20)
        response.raise_for_status()
        summary = response.json()["routes"][0]["summary"]
        distance, duration = summary["distance"], summary["duration"]
        if not all(isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) and v >= 0 for v in (distance, duration)):
            raise ValueError("Invalid route")
        result.update(distance_km=round(distance / 1000, 2), travel_time_mins=math.ceil(duration / 60),
                      estimate_source="openrouteservice",
                      commute_summary="Driving route by openrouteservice / OpenStreetMap. Estimated duration excludes live traffic; locations resolved from address text.")
    except (requests.RequestException, ValueError, KeyError, IndexError, TypeError):
        # Never expose request URLs: geocoding URLs contain the API key.
        pass
    return json.dumps(result)

# ==============================================================================
# 3. AGENT SYSTEM PROMPT & ORCHESTRATION LOGIC
# ==============================================================================

SYSTEM_PROMPT = """You are the Matching & Location Intelligence Agent for RentWise AI (Student 2 Component).
Your responsibility is to:
1. Parse the tenant's free-text natural-language objective and tenant profile into structured search constraints:
   - Budget range (minimum and maximum LKR)
   - Preferred location / city
   - Stated point of interest or destination landmark (e.g. "SLIIT Malabe", "Orion City", "Colombo Fort", "University of Colombo")
   - Number of bedrooms
   - Required facilities (AC, Parking, Swimming Pool, Furnished, Hot Water, etc.)
2. Use the `search_properties` tool with structured filters (JSON string) to retrieve candidate listings.
3. For candidate properties, use the `get_distance` tool to estimate approximate driving distance and travel time from the property address to the tenant's destination landmark.
Never invent a destination if the tenant did not give one. Copy tool estimates exactly, including null values. Label successful commute results as openrouteservice driving routes with estimated duration, not live traffic. Never claim a distance or duration when the tool returns null.
4. Calculate a match score (0–100%) for each candidate based on:
   - Budget alignment (30% weight)
   - Commute proximity / travel time (30% weight)
   - Bedroom / capacity fit (20% weight)
   - Facilities & amenities match (20% weight)
5. Return your final ranked evaluation strictly as a valid JSON object in a markdown code block:

```json
{
  "extracted_filters": {
    "location": "...",
    "destination": "...",
    "budget_min": 0,
    "budget_max": 75000,
    "bedrooms": 2,
    "property_type": "Apartment",
    "facilities": ["Air Conditioning", "Parking Space"]
  },
  "destination_landmark": "...",
  "ranked_properties": [
    {
      "property_id": "...",
      "title": "...",
      "address": "...",
      "city": "...",
      "monthly_rent": 65000,
      "bedrooms": 2,
      "bathrooms": 2,
      "photo_url": "...",
      "match_score": 94,
      "distance_km": 1.8,
      "travel_time_mins": 6,
      "match_reasons": [
        "Monthly rent of LKR 65,000 matches your budget under 75,000",
        "Only 1.8 km (~6 mins commute) to your stated landmark",
        "Equipped with Air Conditioning and Parking Space"
      ],
      "trade_offs": []
    }
  ],
  "summary_recommendation": "A concise paragraph summarizing the top choice and why it best satisfies the tenant's criteria."
}
```
"""

# Gemini Model setup
gemini_model = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
llm = ChatGoogleGenerativeAI(model=gemini_model, temperature=0.1, max_retries=0, timeout=45)
tools = [search_properties, get_distance]
llm_with_tools = llm.bind_tools(tools)

def run_matching_location_agent(state: AgentWorkflowState) -> AgentWorkflowState:
    """Executes the Student 2 Matching & Location Intelligence Agent."""
    print("--- [Student 2] Matching & Location Intelligence Agent Running ---")
    objective = state.get("objective", "").strip() or "Find a quality rental property in Colombo or Malabe"
    tenant_profile = state.get("tenant_profile") or {}
    
    # Enrich prompt with tenant profile if available
    user_context = f"Tenant Objective: {objective}"
    if tenant_profile:
        user_context += f"\nTenant Profile: {json.dumps(tenant_profile)}"
        
    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=user_context)
    ]

    output_data = None
    candidates = {}
    commute_estimates = {}
    
    # 1. Execute LLM ReAct tool loop
    try:
        max_iterations = 6
        for _ in range(max_iterations):
            response = llm_with_tools.invoke(messages)
            messages.append(response)

            if not response.tool_calls:
                break

            for tool_call in response.tool_calls:
                t_name = tool_call["name"]
                t_args = tool_call["args"]

                if t_name == "search_properties":
                    t_res = search_properties.invoke(t_args)
                    candidates.update({str(p["id"]): p for p in json.loads(t_res)})
                elif t_name == "get_distance":
                    t_res = get_distance.invoke(t_args)
                    commute_estimates[(t_args.get("origin", ""), t_args.get("destination", ""))] = json.loads(t_res)
                else:
                    t_res = f"Tool {t_name} not recognized."

                messages.append({
                    "role": "tool",
                    "name": t_name,
                    "content": str(t_res),
                    "tool_call_id": tool_call["id"]
                })

        if not isinstance(messages[-1], AIMessage) or messages[-1].tool_calls:
            raise MatchingError("AI search could not finish in time. Please retry.", code="AI_INCOMPLETE")
        output_data = _json_response(messages[-1].content)
        if not isinstance(output_data.get("ranked_properties"), list):
            raise ValueError("Missing ranked properties")
        destination = output_data.get("destination_landmark") or ""
        for match in output_data["ranked_properties"]:
            prop = candidates.get(str(match.get("property_id")))
            if prop is None:
                raise ValueError("AI selected a property not returned by search")
            origin = prop.get("address", "")
            key = (origin, destination)
            if key not in commute_estimates:
                commute_estimates[key] = json.loads(get_distance.invoke({"origin": origin, "destination": destination}))
            estimate = commute_estimates[key]
            for field in ("distance_km", "travel_time_mins", "commute_summary", "estimate_source"):
                match[field] = estimate.get(field)
    except Exception as e:
        raise public_matching_error(e) from e

    # Store in LangGraph state
    state["current_agent"] = "MatchingLocation"
    state["candidate_properties"] = output_data.get("ranked_properties", [])
    state["matching_results"] = output_data.get("ranked_properties", [])
    state["destination_landmark"] = output_data.get("destination_landmark", "")
    state["summary_recommendation"] = output_data.get("summary_recommendation", "")
    state["extracted_filters"] = output_data.get("extracted_filters", {})
    if output_data.get("ranked_properties"):
        state["recommended_property"] = output_data["ranked_properties"][0]
        
    return state

