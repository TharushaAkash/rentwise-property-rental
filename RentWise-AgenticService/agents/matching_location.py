from langchain_google_genai import ChatGoogleGenerativeAI
from .state import AgentWorkflowState

def get_matching_location_agent():
    llm = ChatGoogleGenerativeAI(model="gemini-3.5-flash-lite")
    # Tools: search_properties(filters), get_distance(origin, destination)
    return llm

def run_matching_location_agent(state: AgentWorkflowState):
    agent = get_matching_location_agent()
    # Execute agent logic here
    return state
