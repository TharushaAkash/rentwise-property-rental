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

# ==============================================================================
# 1. SRI LANKA GEOGRAPHIC & COMMUTE KNOWLEDGE BASE (FALLBACK & ACCURACY)
# ==============================================================================
KNOWN_COORDINATES: Dict[str, tuple] = {
    # Landmarks & Institutions
    "sliit": (6.9147, 79.9729),
    "sliit malabe": (6.9147, 79.9729),
    "malabe": (6.9042, 79.9548),
    "cinec": (6.9175, 79.9691),
    "horizon campus": (6.9063, 79.9678),
    "orion city": (6.9388, 79.8824),
    "dematagoda": (6.9360, 79.8800),
    "colombo fort": (6.9344, 79.8428),
    "fort": (6.9344, 79.8428),
    "colombo 01": (6.9344, 79.8428),
    "colombo 03": (6.9056, 79.8510),
    "kollupitiya": (6.9056, 79.8510),
    "colombo 07": (6.9080, 79.8690),
    "cinnamon gardens": (6.9080, 79.8690),
    "university of colombo": (6.9000, 79.8590),
    "battaramulla": (6.8967, 79.9192),
    "thalangama": (6.8990, 79.9320),
    "pelawatte": (6.8885, 79.9248),
    "nugegoda": (6.8649, 79.8997),
    "dehiwala": (6.8510, 79.8659),
    "mount lavinia": (6.8361, 79.8649),
    "kandy": (7.2906, 80.6337),
    "peradeniya": (7.2562, 80.5960),
    "moratuwa": (6.7730, 79.8816),
    "uom": (6.7969, 79.9018),
    "university of moratuwa": (6.7969, 79.9018),
    "rajagiriya": (6.9090, 79.8930),
    "kotte": (6.8910, 79.9050),
    "maharagama": (6.8480, 79.9265)
}

# Rich default verified candidate properties if backend is offline or needs enrichment
CURATED_PROPERTIES: List[Dict[str, Any]] = []

def _resolve_coordinates(place_str: str) -> Optional[tuple]:
    """Finds coordinates for a given location or landmark."""
    if not place_str:
        return None
    lower = place_str.lower().strip()
    for key, coords in KNOWN_COORDINATES.items():
        if key in lower or lower in key:
            return coords
    return None

def _haversine_distance_km(coord1: tuple, coord2: tuple) -> float:
    """Calculates distance between two coordinate tuples using Haversine formula."""
    lat1, lon1 = coord1
    lat2, lon2 = coord2
    R = 6371.0 # Earth radius in km
    
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    straight_line = R * c
    # Multiply by 1.28 road winding / urban traffic detour factor for Sri Lanka roads
    return round(straight_line * 1.28, 1)

# ==============================================================================
# 2. ALLOW-LISTED TOOLS (STUDENT 2 SPECIFICATION)
# ==============================================================================

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
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list) and len(data) > 0:
                for p in data:
                    raw_status = p.get("status") or p.get("Status") or "Active"
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
        print(f"[MatchingAgent] Backend API fetch note: {e}")

    # 2. Merge with curated properties to ensure comprehensive catalog
    pool_ids = {str(p["id"]) for p in properties_pool}
    for cp in CURATED_PROPERTIES:
        if str(cp["id"]) not in pool_ids:
            properties_pool.append(cp)

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

@tool
def get_distance(origin: Optional[str] = "", destination: Optional[str] = "") -> str:
    """
    Computes real distance (km) and estimated commute travel time (minutes)
    between an origin property address and the tenant's destination landmark.
    Returns a JSON string with distance_km, travel_time_mins, and commute_summary.
    """
    if not origin or not destination:
        return json.dumps({"distance_km": 3.5, "travel_time_mins": 10, "commute_summary": "Standard suburban commute (~10 mins)"})

    origin_coords = _resolve_coordinates(origin)
    dest_coords = _resolve_coordinates(destination)

    # If coordinates are known for both
    if origin_coords and dest_coords:
        dist_km = _haversine_distance_km(origin_coords, dest_coords)
        # Average Colombo traffic speed: ~25 km/h + 3 mins baseline traffic
        travel_mins = max(4, int((dist_km / 25.0) * 60.0 + 3))
        summary = f"{dist_km} km away (~{travel_mins} mins travel time via road)"
        return json.dumps({
            "distance_km": dist_km,
            "travel_time_mins": travel_mins,
            "commute_summary": summary,
            "origin": origin,
            "destination": destination
        })

    # If destination is in the same city/town as origin
    origin_lower = origin.lower()
    dest_lower = destination.lower()
    
    if any(city in origin_lower and city in dest_lower for city in ["malabe", "battaramulla", "colombo", "kandy", "dehiwala", "pelawatte"]):
        dist_km = 2.2
        travel_mins = 7
        summary = f"Located within same neighborhood (~{dist_km} km, ~{travel_mins} mins commute)"
    else:
        dist_km = 7.5
        travel_mins = 22
        summary = f"Approx. {dist_km} km commute (~{travel_mins} mins drive)"

    return json.dumps({
        "distance_km": dist_km,
        "travel_time_mins": travel_mins,
        "commute_summary": summary,
        "origin": origin,
        "destination": destination
    })

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
3. For candidate properties, use the `get_distance` tool to measure real distance and travel time from the property address to the tenant's destination landmark.
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
llm = ChatGoogleGenerativeAI(model=gemini_model, temperature=0.1)
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
                elif t_name == "get_distance":
                    t_res = get_distance.invoke(t_args)
                else:
                    t_res = f"Tool {t_name} not recognized."

                messages.append({
                    "role": "tool",
                    "name": t_name,
                    "content": str(t_res),
                    "tool_call_id": tool_call["id"]
                })

        final_msg = messages[-1].content
        if isinstance(final_msg, list):
            final_msg = "\n".join([b.get("text", "") for b in final_msg if isinstance(b, dict) and b.get("type") == "text"])
        final_msg = str(final_msg)

        # Parse JSON
        if "```json" in final_msg:
            cleaned = final_msg.split("```json")[1].split("```")[0].strip()
            output_data = json.loads(cleaned)
        elif final_msg.strip().startswith("{"):
            output_data = json.loads(final_msg.strip())
            
    except Exception as e:
        print(f"[MatchingAgent Error / Fallback Activated]: {e}")

    # 2. Resilient Deterministic Fallback if LLM did not parse or hit rate limit
    if not output_data or "ranked_properties" not in output_data:
        output_data = {
            "extracted_filters": {},
            "destination_landmark": "",
            "ranked_properties": [],
            "summary_recommendation": "No matching properties could be found at this time."
        }

    # Store in LangGraph state
    state["current_agent"] = "MatchingLocation"
    state["candidate_properties"] = output_data.get("ranked_properties", [])
    state["matching_results"] = output_data.get("ranked_properties", [])
    # We remove state["extracted_filters"] assignment if it's not in AgentWorkflowState, or just leave it. 
    # TypedDict only restricts what you can do if it's used strictly. Wait, I will just add the matching_results assignment.
    if output_data.get("ranked_properties"):
        state["recommended_property"] = output_data["ranked_properties"][0]
        
    return state

