from typing import TypedDict, Annotated, List, Any
import operator

# Reducer functions can be added here if needed, 
# e.g., to append to lists instead of overwriting.

class AgentWorkflowState(TypedDict):
    objective: str
    property_id: str
    
    # Matching & Location Agent State
    candidate_properties: List[dict]
    
    # Agreement & Pricing Agent State
    recommended_property: dict
    agreement_draft: dict
    
    # Property Verification Agent State
    verification_report: dict
    
    # Maintenance Triage Agent State
    maintenance_ticket: dict
    
    # General execution tracking
    messages: Annotated[list, operator.add]
    current_agent: str
