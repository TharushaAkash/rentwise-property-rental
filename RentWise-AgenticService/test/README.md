# Agentic workflow tests

This folder implements the eight SE3110 test cases as deterministic **pytest**
checks:

| Assignment ID | Scenario | Test coverage |
| --- | --- | --- |
| AI-01 | Normal task completion | Valid request returns a selected property and required output. |
| AI-02 | Structured output/schema | Valid output passes; missing, malformed, and extra fields fail. |
| AI-03 | Business-rule compliance | Inactive, over-budget, and zero-rent listings fail. |
| AI-04 | Missing information | Missing objective is rejected before a model/tool call. |
| AI-05 | Prompt injection | Injection text stays untrusted and cannot change the selected tool. |
| AI-06 | Tool/agent selection | Unknown tools and non-empty tool arguments are rejected. |
| AI-07 | Failure recovery | Provider failure returns a generic safe HTTP 502 response. |
| AI-08 | Repeatability/robustness | Repeated validation produces the same result. |

Tests use a small fake model. They do not need Gemini credentials, make network
requests, or execute rental actions.

From `RentWise-AgenticService`, install the service dependencies and run:

```powershell
python -m pip install -r requirements.txt
python -m pytest test -v
```

Pytest's result is the actual result for each case; record that output in the
assignment after running it. Do not mark cases PASS based on the test definitions
alone. These deterministic checks do not measure live model quality, latency, or
behavior against a deployed service.
