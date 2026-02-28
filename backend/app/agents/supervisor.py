"""LangGraph Supervisor for orchestrating parallel code review agents."""

from typing import List, Optional

from langgraph.graph import END, START, StateGraph

from app.agents.critique import CritiqueAgent
from app.agents.formatter import CommentFormatter
from app.agents.logic_agent import LogicAgent
from app.agents.quality_agent import QualityAgent
from app.agents.schemas import AgentFinding, ReviewState
from app.agents.security_agent import SecurityAgent


def create_review_graph(
    logic_agent: Optional[LogicAgent],
    security_agent: Optional[SecurityAgent],
    quality_agent: Optional[QualityAgent],
    critique_agent: CritiqueAgent,
):
    """Create and compile the LangGraph review workflow.

    Creates a StateGraph that runs three specialized agents in parallel,
    then runs the critique agent to deduplicate and improve findings,
    and finally combines their findings into a formatted GitHub comment.

    Args:
        logic_agent: Agent for detecting logic errors
        security_agent: Agent for identifying security vulnerabilities
        quality_agent: Agent for reviewing code quality
        critique_agent: Agent for deduplication and confidence scoring

    Returns:
        Compiled LangGraph graph ready for invocation
    """

    def run_logic(state: ReviewState) -> dict:
        """Run the logic agent and return findings.

        Args:
            state: Current review state with pr_diff and pr_files

        Returns:
            Dictionary with logic_findings key
        """
        if logic_agent is None:
            return {"logic_findings": []}
        findings = logic_agent.analyze(
            state["pr_diff"], state["pr_files"], state.get("pr_file_contents")
        )
        return {"logic_findings": findings}

    def run_security(state: ReviewState) -> dict:
        """Run the security agent and return findings.

        Args:
            state: Current review state with pr_diff and pr_files

        Returns:
            Dictionary with security_findings key
        """
        if security_agent is None:
            return {"security_findings": []}
        findings = security_agent.analyze(
            state["pr_diff"], state["pr_files"], state.get("pr_file_contents")
        )
        return {"security_findings": findings}

    def run_quality(state: ReviewState) -> dict:
        """Run the quality agent and return findings.

        Args:
            state: Current review state with pr_diff and pr_files

        Returns:
            Dictionary with quality_findings key
        """
        if quality_agent is None:
            return {"quality_findings": []}
        findings = quality_agent.analyze(
            state["pr_diff"], state["pr_files"], state.get("pr_file_contents")
        )
        return {"quality_findings": findings}

    def run_critique(state: ReviewState) -> dict:
        """Run the critique agent to improve findings.

        Args:
            state: Current review state with findings from all agents

        Returns:
            Dictionary with updated findings after deduplication and scoring
        """
        result = critique_agent.critique(
            logic_findings=state["logic_findings"],
            security_findings=state["security_findings"],
            quality_findings=state["quality_findings"],
        )
        return {
            "logic_findings": result.logic_findings,
            "security_findings": result.security_findings,
            "quality_findings": result.quality_findings,
        }

    def combine_findings(state: ReviewState) -> dict:
        """Combine all findings and format the final comment.

        Args:
            state: Current review state with all agent findings

        Returns:
            Dictionary with final_comment key
        """
        comment = CommentFormatter.format(
            logic_findings=state["logic_findings"],
            security_findings=state["security_findings"],
            quality_findings=state["quality_findings"],
        )
        return {"final_comment": comment}

    # Create the state graph
    graph = StateGraph(ReviewState)

    # Add nodes for each agent and the combiner
    graph.add_node("logic", run_logic)
    graph.add_node("security", run_security)
    graph.add_node("quality", run_quality)
    graph.add_node("critique", run_critique)
    graph.add_node("combine", combine_findings)

    # Add edges: START -> all three agents (parallel)
    graph.add_edge(START, "logic")
    graph.add_edge(START, "security")
    graph.add_edge(START, "quality")

    # Add edges: all three agents -> critique
    graph.add_edge("logic", "critique")
    graph.add_edge("security", "critique")
    graph.add_edge("quality", "critique")

    # Add edge: critique -> combine -> END
    graph.add_edge("critique", "combine")
    graph.add_edge("combine", END)

    # Compile and return the graph
    return graph.compile()


class ReviewSupervisor:
    """Supervisor that orchestrates parallel execution of code review agents.

    This class creates and manages a LangGraph workflow that runs
    LogicAgent, SecurityAgent, and QualityAgent in parallel, then
    runs CritiqueAgent to deduplicate and improve findings, and finally
    combines their findings into a formatted GitHub comment.

    Attributes:
        logic_agent: Agent for detecting logic errors
        security_agent: Agent for identifying security vulnerabilities
        quality_agent: Agent for reviewing code quality
        critique_agent: Agent for deduplication and confidence scoring
        graph: Compiled LangGraph workflow
    """

    def __init__(
        self,
        logic_agent: Optional[LogicAgent] = None,
        security_agent: Optional[SecurityAgent] = None,
        quality_agent: Optional[QualityAgent] = None,
        critique_agent: Optional[CritiqueAgent] = None,
    ):
        """Initialize the ReviewSupervisor.

        Args:
            logic_agent: Optional LogicAgent. If not provided, creates a new instance.
            security_agent: Optional SecurityAgent. If not provided, creates a new instance.
            quality_agent: Optional QualityAgent. If not provided, creates a new instance.
            critique_agent: Optional CritiqueAgent. If not provided, creates a new instance.

        All default agents share a single LLMService instance for efficiency.
        """
        # Create a shared LLM service for all default agents
        from app.services.llm import LLMService
        shared_llm = LLMService()

        self.logic_agent = logic_agent if logic_agent is not None else LogicAgent(llm_service=shared_llm)
        self.security_agent = (
            security_agent if security_agent is not None else SecurityAgent(llm_service=shared_llm)
        )
        self.quality_agent = (
            quality_agent if quality_agent is not None else QualityAgent(llm_service=shared_llm)
        )
        self.critique_agent = (
            critique_agent if critique_agent is not None else CritiqueAgent(llm_service=shared_llm)
        )

        # Create the graph using the agents
        self.graph = create_review_graph(
            self.logic_agent,
            self.security_agent,
            self.quality_agent,
            self.critique_agent,
        )

    def run(
        self,
        pr_diff: str,
        pr_files: List[str],
        pr_file_contents: Optional[dict] = None,
    ) -> ReviewState:
        """Run the code review workflow.

        Executes all three agents in parallel, combines their findings,
        and returns the final state with all findings and formatted comment.

        Args:
            pr_diff: The code diff to analyze
            pr_files: List of file paths changed in the PR
            pr_file_contents: Optional mapping of file paths to full content

        Returns:
            ReviewState with all findings and the final formatted comment
        """
        # Create initial state
        initial_state: ReviewState = {
            "pr_diff": pr_diff,
            "pr_files": pr_files,
            "pr_file_contents": pr_file_contents,
            "logic_findings": [],
            "security_findings": [],
            "quality_findings": [],
            "final_comment": "",
        }

        # Invoke the graph and return the final state
        final_state = self.graph.invoke(initial_state)
        return final_state
