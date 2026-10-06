import json
import os
import unittest
from unittest.mock import patch
from langchain_core.messages import AIMessage
os.environ.setdefault("GOOGLE_API_KEY", "test-placeholder-not-a-real-key")
from agents.MatchingLocation import matching_location_agent as agent


class MatchingLocationTests(unittest.TestCase):
    def setUp(self):
        env = patch.dict(os.environ, {"AGENT_WORKFLOW_KEY": "test-internal-key"})
        env.start()
        self.addCleanup(env.stop)

    def test_python_workflow_rejects_direct_clients(self):
        from fastapi.testclient import TestClient
        from main import app
        response = TestClient(app).post("/workflow/match-location", json={"objective": "Near SLIIT"})
        self.assertEqual(response.status_code, 403)

    def test_provider_high_demand_has_actionable_error(self):
        error = agent.public_matching_error(RuntimeError("503 UNAVAILABLE: model experiencing high demand"))
        self.assertEqual(error.status, 503)
        self.assertEqual(error.code, "AI_MODEL_BUSY")
        self.assertIn("temporarily busy", str(error))

    def test_api_reports_busy_model_instead_of_generic_failure(self):
        from fastapi.testclient import TestClient
        from main import app
        with patch.object(type(agent.llm_with_tools), "invoke", side_effect=RuntimeError("503 UNAVAILABLE high demand")):
            response = TestClient(app).post("/workflow/match-location", json={"objective": "Near SLIIT"}, headers={"X-Workflow-Key": "test-internal-key"})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["code"], "AI_MODEL_BUSY")
        self.assertIn("temporarily busy", response.json()["message"])

    def test_commute_uses_model_values_without_routing_requests(self):
        answer = {"distance_km": 12.3, "travel_time_mins": 41, "commute_summary": "Approximate driving estimate"}
        with patch.object(type(agent.llm), "invoke", return_value=AIMessage(content=json.dumps(answer))) as model, patch.object(agent.requests, "get") as get, patch.object(agent.requests, "post") as post:
            result = json.loads(agent.get_distance.invoke({"origin": "Malabe", "destination": "Colombo Fort"}))
        model.assert_called_once()
        get.assert_not_called()
        post.assert_not_called()
        self.assertEqual(result["distance_km"], 12.3)
        self.assertEqual(result["travel_time_mins"], 41)
        self.assertEqual(result["estimate_source"], "ai_estimate")

    def test_missing_destination_has_no_fabricated_defaults(self):
        with patch.object(type(agent.llm), "invoke") as model:
            result = json.loads(agent.get_distance.invoke({"origin": "Malabe"}))
        model.assert_not_called()
        self.assertIsNone(result["distance_km"])
        self.assertIsNone(result["travel_time_mins"])

    def test_invalid_model_estimate_is_rejected(self):
        for answer in [{"distance_km": -1, "travel_time_mins": 5}, {"distance_km": 1, "travel_time_mins": None}]:
            with self.subTest(answer=answer), patch.object(type(agent.llm), "invoke", return_value=AIMessage(content=json.dumps(answer))):
                with self.assertRaises(agent.MatchingError):
                    agent.get_distance.invoke({"origin": "Malabe", "destination": "Fort"})

    def test_limit_is_not_converted_to_empty_success(self):
        with patch.object(type(agent.llm_with_tools), "invoke", side_effect=RuntimeError("429 RESOURCE_EXHAUSTED secret-provider-data")):
            with self.assertRaises(agent.MatchingError) as caught:
                agent.run_matching_location_agent({"objective": "Near SLIIT"})
        self.assertEqual(caught.exception.status, 429)
        self.assertNotIn("secret-provider-data", str(caught.exception))

    def test_empty_result_is_valid_but_malformed_result_fails(self):
        with patch.object(type(agent.llm_with_tools), "invoke", return_value=AIMessage(content='{"ranked_properties": []}')):
            self.assertEqual(agent.run_matching_location_agent({"objective": "A home"})["matching_results"], [])
        with patch.object(type(agent.llm_with_tools), "invoke", return_value=AIMessage(content='not JSON')):
            with self.assertRaises(agent.MatchingError):
                agent.run_matching_location_agent({"objective": "A home"})

    def test_ranked_commute_is_copied_from_ai_tool(self):
        search_call = AIMessage(content="", tool_calls=[{"name": "search_properties", "args": {}, "id": "search-1", "type": "tool_call"}])
        final = AIMessage(content=json.dumps({"destination_landmark": "Fort", "ranked_properties": [{"property_id": "p1", "distance_km": 999, "travel_time_mins": 999}]}))
        with patch.object(type(agent.llm_with_tools), "invoke", side_effect=[search_call, final]), \
             patch.object(type(agent.llm), "invoke", return_value=AIMessage(content='{"distance_km": 15, "travel_time_mins": 38, "commute_summary": "Approximate"}')), \
             patch.object(type(agent.search_properties), "invoke", autospec=True) as tool:
            # The tool wrapper is shared by both tools, so dispatch to the real distance function.
            tool.side_effect = lambda instance, args: json.dumps([{"id": "p1", "address": "Malabe"}]) if instance.name == "search_properties" else agent.get_distance.func(**args)
            result = agent.run_matching_location_agent({"objective": "Near Fort"})
        self.assertEqual(result["matching_results"][0]["distance_km"], 15)
        self.assertEqual(result["matching_results"][0]["travel_time_mins"], 38)
        self.assertEqual(result["destination_landmark"], "Fort")

    def test_api_preserves_safe_quota_error(self):
        from fastapi.testclient import TestClient
        from main import app
        with patch.object(type(agent.llm_with_tools), "invoke", side_effect=RuntimeError("quota exceeded")):
            response = TestClient(app).post("/workflow/match-location", json={"objective": "A home"}, headers={"X-Workflow-Key": "test-internal-key"})
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.json()["code"], "AI_LIMIT_REACHED")

if __name__ == "__main__":
    unittest.main()
