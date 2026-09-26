import json
import unittest
from unittest.mock import Mock, patch

from langchain_core.messages import AIMessage, ToolMessage
from agents.PropertyVerification import property_verification as verification


PROPERTY_ID = "4a2cc050-568f-4c1f-a4da-5726559d8911"
ADDRESS = "12/3 Garden Lane, Piliyandala"
DOCUMENT = "https://example.test/bill.jpg"


def tool_messages(document_result="Consistent: Addresses match.", duplicate_result="No duplicate property found. Address is unique.", excluded_id=PROPERTY_ID):
    checks = [
        ("get_property_submission", {"property_id": PROPERTY_ID}, json.dumps({
            "property": {"address": ADDRESS}, "documents": [{"documentUrl": DOCUMENT}], "photos": []})),
        ("check_document_consistency", {"property_address": ADDRESS, "document_url": DOCUMENT}, document_result),
        ("check_duplicate_property", {"address": ADDRESS, "exclude_property_id": excluded_id}, duplicate_result),
    ]
    messages = []
    for index, (name, args, output) in enumerate(checks):
        call_id = str(index)
        messages.extend([
            AIMessage(content="", tool_calls=[{"id": call_id, "name": name, "args": args}]),
            ToolMessage(content=output, tool_call_id=call_id, name=name),
        ])
    # A fabricated final approval must never override the actual tool results.
    messages.append(AIMessage(content='{"recommendation":"Approve-ready","reasoning":"OK"}'))
    return messages


class PropertyVerificationTests(unittest.TestCase):
    def run_workflow(self, messages):
        with patch.object(verification, "get_property_verification_agent") as factory:
            factory.return_value.invoke.return_value = {"messages": messages}
            return verification.run_property_verification_agent({
                "property_id": PROPERTY_ID, "document_url": DOCUMENT})["verification_report"]

    def test_complete_checks_approve(self):
        self.assertEqual(self.run_workflow(tool_messages())["recommendation"], "Approve-ready")

    def test_mismatch_or_duplicate_cannot_be_overridden_by_final_approval(self):
        for messages in [tool_messages(document_result="Inconsistent: Different house number."),
                         tool_messages(duplicate_result="Duplicate found: Another property.")]:
            with self.subTest(messages=messages):
                self.assertEqual(self.run_workflow(messages)["recommendation"], "Reject-recommended")

    def test_missing_or_failed_checks_need_review(self):
        for messages in [tool_messages()[:2], tool_messages(document_result="Error analyzing document: unavailable"),
                         tool_messages(document_result="Unclear: Cannot read address."),
                         tool_messages(duplicate_result="Error checking duplicate property: timeout"),
                         tool_messages(excluded_id="different-property")]:
            with self.subTest(messages=messages):
                self.assertEqual(self.run_workflow(messages)["recommendation"], "Needs Review")

    def test_wrong_document_cannot_approve(self):
        with self.assertRaises(ValueError):
            verification._validated_report(tool_messages(), PROPERTY_ID, "https://example.test/new.jpg")

    def test_service_exception_is_reviewable(self):
        with patch.object(verification, "get_property_verification_agent", side_effect=RuntimeError("offline")):
            result = verification.run_property_verification_agent({"property_id": PROPERTY_ID})
        self.assertEqual(result["verification_report"]["recommendation"], "Needs Review")

    def test_duplicate_request_excludes_current_property(self):
        with patch.object(verification.requests, "get") as get:
            get.return_value.json.return_value = {"exists": False}
            result = verification.check_duplicate_property.invoke({"address": ADDRESS, "exclude_property_id": PROPERTY_ID})
        self.assertTrue(result.startswith("No duplicate"))
        self.assertEqual(get.call_args.kwargs["params"]["excludePropertyId"], PROPERTY_ID)
        self.assertEqual(get.call_args.kwargs["timeout"], 20)

    def test_invalid_duplicate_response_is_not_treated_as_unique(self):
        with patch.object(verification.requests, "get") as get:
            get.return_value.json.return_value = {"error": "unavailable"}
            result = verification.check_duplicate_property.invoke({"address": ADDRESS, "exclude_property_id": PROPERTY_ID})
        self.assertTrue(result.startswith("Error checking"))

    def test_submission_reads_all_three_backend_resources(self):
        responses = [Mock(), Mock(), Mock()]
        for response, data in zip(responses, [{"address": ADDRESS}, [{"documentUrl": DOCUMENT}], []]):
            response.status_code = 200
            response.json.return_value = data
        with patch.object(verification.requests, "get", side_effect=responses) as get:
            result = json.loads(verification.get_property_submission.invoke({"property_id": PROPERTY_ID}))
        self.assertEqual(result["property"]["address"], ADDRESS)
        self.assertEqual(len(get.call_args_list), 3)
        self.assertTrue(all(call.kwargs["timeout"] == 20 for call in get.call_args_list))

    def test_vision_content_blocks_are_supported(self):
        with patch.object(verification, "ChatGoogleGenerativeAI") as model:
            model.return_value.invoke.return_value.content = [{"type": "text", "text": "Consistent: Same address."}]
            result = verification.check_document_consistency.invoke({"property_address": ADDRESS, "document_url": DOCUMENT})
        self.assertEqual(result, "Consistent: Same address.")


if __name__ == "__main__":
    unittest.main()
