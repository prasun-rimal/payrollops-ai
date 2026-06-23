from typing import TypedDict

from langgraph.graph import END, START, StateGraph
from sqlalchemy.orm import Session

from app.schemas import ExceptionAnalysis
from app.services.ai import ExceptionAnalyzer
from app.services.retrieval import retrieve_policy


class ExceptionWorkflowState(TypedDict, total=False):
    finding: dict
    policy_context: str
    analysis: ExceptionAnalysis


def build_exception_workflow(db: Session):
    analyzer = ExceptionAnalyzer()

    def retrieve(state: ExceptionWorkflowState) -> ExceptionWorkflowState:
        finding = state["finding"]
        policies = retrieve_policy(
            db,
            f"{finding['title']} {finding['explanation']}",
            finding["country"],
        )
        context = "\n".join(
            f"{policy.document_name} - {policy.section}: {policy.content}"
            for policy in policies
        )
        return {"policy_context": context}

    def classify(state: ExceptionWorkflowState) -> ExceptionWorkflowState:
        return {"analysis": analyzer.analyze(state["finding"], state["policy_context"])}

    graph = StateGraph(ExceptionWorkflowState)
    graph.add_node("retrieve_policy", retrieve)
    graph.add_node("classify_exception", classify)
    graph.add_edge(START, "retrieve_policy")
    graph.add_edge("retrieve_policy", "classify_exception")
    graph.add_edge("classify_exception", END)
    return graph.compile()

