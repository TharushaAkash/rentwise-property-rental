from langchain_google_genai import ChatGoogleGenerativeAI
from .state import AgentWorkflowState

def get_agreement_pricing_agent():
    llm = ChatGoogleGenerativeAI(model="gemini-3.5-flash-lite")
    # Tools: get_market_rent(location, type, bedrooms), extract_agreement_terms(document)
    return llm

def run_agreement_pricing_agent(state: AgentWorkflowState):
    agent = get_agreement_pricing_agent()
    # Execute agent logic here
    return state
