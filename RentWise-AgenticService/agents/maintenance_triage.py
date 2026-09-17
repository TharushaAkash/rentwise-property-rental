from langchain_google_genai import ChatGoogleGenerativeAI
from .state import AgentWorkflowState

def get_maintenance_triage_agent():
    llm = ChatGoogleGenerativeAI(model="gemini-3.5-flash-lite")
    # Tools: classify_issue(description), find_service_provider(category, area)
    return llm

def run_maintenance_triage_agent(state: AgentWorkflowState):
    agent = get_maintenance_triage_agent()
    # Execute agent logic here
    return state
