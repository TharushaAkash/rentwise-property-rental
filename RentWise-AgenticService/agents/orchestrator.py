from langgraph.graph import StateGraph, START, END
from .state import AgentWorkflowState

# Placeholder functions for the agent nodes
def property_verification_node(state: AgentWorkflowState):
    print("Running Property Verification Agent...")
    return {"current_agent": "PropertyVerification"}

def matching_location_node(state: AgentWorkflowState):
    print("Running Matching & Location Agent...")
    return {"current_agent": "MatchingLocation"}

def agreement_pricing_node(state: AgentWorkflowState):
    print("Running Agreement & Pricing Agent...")
    return {"current_agent": "AgreementPricing"}

from .MaintenanceTriage.maintenance_triage_agent import run_maintenance_triage_agent as maintenance_triage_node

def build_workflow_graph():
    graph = StateGraph(AgentWorkflowState)
    
    # Add nodes for each agent
    graph.add_node("property_verification", property_verification_node)
    graph.add_node("matching_location", matching_location_node)
    graph.add_node("agreement_pricing", agreement_pricing_node)
    graph.add_node("maintenance_triage", maintenance_triage_node)
    
    # Define the edges (for the minimum acceptance workflow)
    # matching -> agreement
    graph.add_edge(START, "matching_location")
    graph.add_edge("matching_location", "agreement_pricing")
    graph.add_edge("agreement_pricing", END)
    
    return graph.compile()

def build_verification_graph():
    graph = StateGraph(AgentWorkflowState)
    
    from .PropertyVerification.property_verification import run_property_verification_agent
    
    # Add nodes
    graph.add_node("property_verification", run_property_verification_agent)
    
    # Edges
    graph.add_edge(START, "property_verification")
    graph.add_edge("property_verification", END)
    
    return graph.compile()

def build_maintenance_graph():
    graph = StateGraph(AgentWorkflowState)
    from .MaintenanceTriage.maintenance_triage_agent import run_maintenance_triage_agent
    graph.add_node("maintenance_triage", run_maintenance_triage_agent)
    graph.add_edge(START, "maintenance_triage")
    graph.add_edge("maintenance_triage", END)
    return graph.compile()
