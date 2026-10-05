import json
import os
import unittest
from unittest.mock import patch, Mock
from langchain_core.messages import AIMessage
os.environ.setdefault("GOOGLE_API_KEY", "test-placeholder-not-a-real-key")
from agents.MatchingLocation import matching_location_agent as agent


class MatchingLocationTests(unittest.TestCase):
    def setUp(self):
        env = patch.dict(os.environ, {"AGENT_WORKFLOW_KEY": "test-internal-key", "ORS_API_KEY": "mock-ors-key"})
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

    def test_commute_uses_routing_distance_and_duration(self):
        route = Mock()
        route.json.return_value = {"routes": [{"summary": {"distance": 12300, "duration": 2401}}]}
        with patch.object(agent, "_ors_coordinates", side_effect=[[79.9, 6.9], [79.8, 6.8]]), patch.object(agent.requests, "post", return_value=route) as post, patch.object(type(agent.llm), "invoke") as model:
            result = json.loads(agent.get_distance.invoke({"origin": "Malabe", "destination": "Colombo Fort"}))
        model.assert_not_called()
        self.assertEqual(result["distance_km"], 12.3)
        self.assertEqual(result["travel_time_mins"], 41)
        self.assertEqual(result["estimate_source"], "openrouteservice")
        self.assertEqual(post.call_args.kwargs["json"]["coordinates"], [[79.9, 6.9], [79.8, 6.8]])
        self.assertEqual(post.call_args.kwargs["headers"]["Authorization"], "mock-ors-key")

    def test_geocoding_is_restricted_to_sri_lanka(self):
        response = Mock()
        response.json.return_value = {"features": [{"properties": {"confidence": 0.95}, "geometry": {"coordinates": [80.3, 7.2]}}]}
        with patch.object(agent.requests, "get", return_value=response) as get:
            self.assertEqual(agent._ors_coordinates("Kegalle town", "mock-ors-key"), [80.3, 7.2])
        self.assertEqual(get.call_args.kwargs["params"]["boundary.country"], "LKA")

    def test_ambiguous_geocoding_does_not_route(self):
        response = Mock()
        response.json.return_value = {"features": [{"properties": {"confidence": 0.9}, "geometry": {"coordinates": coords}} for coords in [[80.3, 7.2], [80.4, 7.3]]]}
        with patch.object(agent.requests, "get", return_value=response), patch.object(agent.requests, "post") as post:
            result = json.loads(agent.get_distance.invoke({"origin": "Main Road", "destination": "Fort"}))
        post.assert_not_called()
        self.assertIsNone(result["distance_km"])

    def test_missing_key_does_not_call_routing(self):
        with patch.dict(os.environ, {"ORS_API_KEY": ""}), patch.object(agent.requests, "get") as get:
            result = json.loads(agent.get_distance.invoke({"origin": "Malabe", "destination": "Fort"}))
        get.assert_not_called()
        self.assertEqual(result["estimate_source"], "unavailable")

    def test_routing_failure_does_not_expose_secret_or_guess(self):
        with patch.object(agent, "_ors_coordinates", side_effect=agent.requests.RequestException("api_key=private-key")):
            result = json.loads(agent.get_distance.invoke({"origin": "Malabe", "destination": "Fort"}))
        self.assertIsNone(result["distance_km"])
        self.assertIsNone(result["travel_time_mins"])
        self.assertNotIn("private-key", json.dumps(result))

    def test_missing_destination_has_no_fabricated_defaults(self):
        with patch.object(type(agent.llm), "invoke") as model:
            result = json.loads(agent.get_distance.invoke({"origin": "Malabe"}))
        model.assert_not_called()
        self.assertIsNone(result["distance_km"])
        self.assertIsNone(result["travel_time_mins"])

    def test_invalid_route_is_unavailable(self):
        route = Mock()
        route.json.return_value = {"routes": [{"summary": {"distance": -1, "duration": 300}}]}
        with patch.object(agent, "_ors_coordinates", return_value=[80, 7]), patch.object(agent.requests, "post", return_value=route):
            result = json.loads(agent.get_distance.invoke({"origin": "Malabe", "destination": "Fort"}))
        self.assertIsNone(result["distance_km"])
        self.assertEqual(result["estimate_source"], "unavailable")

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

    def test_ranked_commute_is_copied_from_routing_tool(self):
        search_call = AIMessage(content="", tool_calls=[{"name": "search_properties", "args": {}, "id": "search-1", "type": "tool_call"}])
        final = AIMessage(content=json.dumps({"destination_landmark": "Fort", "ranked_properties": [{"property_id": "p1", "distance_km": 999, "travel_time_mins": 999}]}))
        with patch.object(type(agent.llm_with_tools), "invoke", side_effect=[search_call, final]), \
             patch.object(agent, "_ors_coordinates", return_value=[80, 7]), \
             patch.object(agent.requests, "post") as post, \
             patch.object(type(agent.search_properties), "invoke", autospec=True) as tool:
            post.return_value.json.return_value = {"routes": [{"summary": {"distance": 15000, "duration": 2280}}]}
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
