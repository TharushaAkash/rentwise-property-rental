# Component C — Backend and Agreement & Pricing Agent

These phases implement internal agreement, payment and reminder rules and an isolated deterministic Agreement & Pricing Agent in the existing backend. No shared entities, authentication, external AI/model service, clients, or migrations are implemented.

## Internal contracts

- RentalAgreement.Id, Payment.RentalAgreementId and RentReminder.RentalAgreementId are integers. Payment.Id remains a GUID.
- ApplicationId, PropertyId, TenantId and OwnerId retain their existing integer types. Positive IDs are validated, but their referenced entities cannot yet be validated.
- Both dependent collections have required foreign keys and Restrict deletion.
- MonthlyRent and Amount use numeric(12,2). Requests reject nonpositive amounts, values above 9999999999.99, and more than two decimal places.
- Agreement dates must be non-default UTC timestamps with StartDate before EndDate.
- Status strings retain their existing storage format. Agreement status has a private setter and is an EF concurrency token.
- Services support exactly Drafted -> PendingOwnerApproval; PendingOwnerApproval -> Active / Rejected / RevisionRequested; RevisionRequested -> Drafted; Active -> Ended.
- Only DecideAsync with an explicit Approve decision can activate a pending agreement. Renewed is omitted until renewal semantics are agreed.
- Payments require an existing Active agreement and are recorded as Pending. This is not a gateway or a claim of successful fund collection. IDs and timestamps are server-generated.
- DTOs omit writable status, payment identity and payment timestamps. Agreement responses contain no navigation collections.

## HTTP integration boundary

Existing routes are retained with integer route constraints. Controllers use DTOs and scoped services.

All requests matching Component C routes currently return 503 ProblemDetails through ComponentCApiBoundaryAttribute. This resource filter runs before controller construction and model binding, so it works without a configured database. It keeps private data and approval/payment actions unavailable while identity and ownership checks are absent. Invalid route IDs can still return 404 through routing.

Services remain directly testable. This is not authentication and there is no client-controlled bypass. Do not remove the boundary merely to demonstrate an anonymous approval.

Before enabling HTTP access:
1. Reconcile shared User IDs (login branch uses GUIDs; these provisional fields are integers).
2. Reuse the accepted Application contract and derive tenant, property and owner from trusted shared data. Application belongs to Component B; Property belongs to Component A.
3. Reconcile AppDbContext with the teammate ApplicationDbContext and its separate migration track. Do not copy teammate implementations.
4. Add shared authentication and resource ownership checks for every read/write. Only the verified Owner may invoke DecideAsync; a Tenant may only access/pay their own agreement.
5. Persist the human approval audit and shared workflow update atomically with activation. AI must never invoke DecideAsync.
6. Agree on one agreement per application versus renewal history before making ApplicationId unique.
7. Add payment retry/idempotency and concurrent payment-versus-agreement-ending handling before enabling external payment submissions.

Submit has an HTTP route as of phase 2; redraft and end remain service operations. Every Component C route retains the same 503 boundary.

## Database configuration

The committed DefaultConnection is now empty. Supply the existing ASP.NET Core environment override before database-backed use:

~~~powershell
$env:ConnectionStrings__DefaultConnection = 'Host=localhost;Port=5432;Database=rentwise_dev;Username=postgres;Password=<your-local-password>'
dotnet run --project RentWise-Backend/RentWise-Backend.csproj
~~~

Set the value locally; do not commit credentials or paste a real password into documentation. Existing environment overrides continue to work. The old password remains in the two existing local commits' history; no history was rewritten. Rotate that credential before publishing history if it is real or reused.

No migration has been changed or applied. The existing untracked migration/snapshot now intentionally describes the old schema and cannot provision this refined model. Keep it out of the next commit. Coordinate a migration after the shared contracts stabilize; establish whether the old migration was applied before choosing replacement versus an additive correction. Do not point this model at the old schema expecting compatibility.

## Verification

~~~powershell
dotnet build RentWise-Backend/RentWise-Backend.csproj
dotnet test RentWise-Backend.Tests/RentWise-Backend.Tests.csproj
~~~

Tests use isolated SQLite in-memory databases with foreign keys enabled, created from the current EF model using EnsureCreated. They never use the existing migrations or a local/shared PostgreSQL database. Coverage includes persisted transitions, invalid decisions, audit updates, concurrent decisions, amount/date validation, payment history, foreign keys, restricted deletion, and the HTTP integration boundary.

A model-only Npgsql test checks precision and internal relationships without opening a connection. SQLite does not reproduce PostgreSQL numeric enforcement or timestamp behavior; PostgreSQL migration/integration verification remains deferred.

## Phase 2 reminder behavior

RentReminderService creates reminders only for an existing Active agreement. DueDate must be UTC, non-default, no earlier than the injected clock's current time, and within the inclusive agreement start/end timestamps. Each agreement/due-time pair is unique, both in service validation and the EF index. No background scheduler or notification delivery is implemented.

New reminders persist as Pending with no sent timestamp. MarkSent records a server timestamp and moves Pending to Sent; it is an explicit delivery-recording operation, not an email/SMS send. Complete moves Pending or Sent to Completed. Repeating a transition or reopening a Completed reminder returns 409. Updates are scoped by both agreement ID and reminder ID, and use optimistic concurrency. Existing reminders remain readable/completable after an agreement ends, but new ones cannot be created then.

Overdue is a computed response status when DueDate is strictly before the current time and the reminder is unfinished. Stored Pending/Sent state and ReminderSentAt are preserved; GET does not write to the database. Completed reminders never appear Overdue. An overdue reminder can still be marked Sent (if previously Pending) or Completed. TimeProvider makes these rules deterministic in tests.

The unique reminder index and concurrency metadata are model changes only. No migration was generated; PostgreSQL verification remains deferred. Simultaneous duplicate inserts are rejected by the database; provider-specific translation of that race into an HTTP conflict is still needed before opening the API.

## Phase 2 routes

All routes below return 503 through ComponentCApiBoundaryAttribute while integration is unresolved:

| Method | Route | Service behavior prepared |
| --- | --- | --- |
| POST | /api/agreements/draft | Create draft |
| GET | /api/agreements/{id} | Retrieve agreement |
| GET | /api/agreements?page=1&pageSize=50 | List, newest first; ID descending tiebreaker; maximum page size 100 |
| POST | /api/agreements/{id}/submit | Drafted to PendingOwnerApproval |
| PUT | /api/agreements/{id}/decision | Explicit decision through trusted approval port |
| POST | /api/agreements/{id}/payments | Record Pending payment for Active agreement |
| GET | /api/agreements/{id}/payments | History, payment date descending then ID ascending |
| POST | /api/agreements/{id}/reminders | Create reminder |
| GET | /api/agreements/{id}/reminders | Due-date ascending reminder list |
| PUT | /api/agreements/{id}/reminders/{reminderId}/status | MarkSent or Complete |

Agreement listing currently serves internal callers only. Add trusted ownership scoping before exposing it. Reminder reads/writes also require resource ownership and agreed role permissions before the boundary can be removed.

## Observed teammate contracts (local remote-tracking references)

Inspected origin/feature/login and origin/feature/tenant-module without fetching, merging, switching branches or copying implementations. Searched all available remote-tracking references for ApprovalDecision, AgentWorkflowRun and Property implementations; none were found. These observations describe the locally available references, not guaranteed current GitHub state.

| Contract | Observed | Required integration |
| --- | --- | --- |
| User | Login User.Id is Guid; roles Tenant, Owner, Admin | Reconcile with Component C TenantId/OwnerId, which remain int. Never cast/hash/truncate a GUID into an int. |
| Claims | Login emits JWT sub=user.Id.ToString() and ClaimTypes.Role | Team JWT validation must establish identity/role. Resolve sub versus mapped NameIdentifier according to that configuration. Do not trust request IDs, email or unvalidated token text as identity. |
| Application | Component B Application.Id, TenantProfileId and PropertyId are int; accepted status is exactly Accepted | Retrieve accepted application, follow TenantProfileId to the shared user, and derive PropertyId from the application. Do not accept arbitrary client-provided owner/tenant mappings. |
| TenantProfile | Id and UserId are int | UserId conflicts with login Guid IDs; resolve before an ownership adapter can work. |
| Property | property.cs is empty in inspected branches; no mapped Property implementation found | Need agreed ID, trusted OwnerId, rent, location/address, property type, bedrooms and other pricing details. Ownership cannot be established from the current search DTO. |
| Property search DTO | Component B has int PropertyId, Title, decimal RentAmount, Location, int Bedrooms | Useful read contract but lacks owner and property type; it is not a source of verified ownership. |
| Database | Component B uses ApplicationDbContext; C uses AppDbContext | Reconcile shared context and migration history before joining entities or adding foreign keys. |
| Shared audit/workflow | No ApprovalDecision or AgentWorkflowRun implementation found in available references | Agree shared entities and atomic persistence before supplying the approval adapter. |

No duplicate User, Application, Property or shared workflow models have been added. No ICurrentUserContext implementation was invented: the narrow approval port below is the current integration point for trusted Owner identity. General read/payment/reminder authorization remains a documented team integration task.

## Approval integration port

IAgreementApprovalIntegration is a Component C interface, with two operations:

1. RequireOwnerAsync must resolve the team's trusted authenticated human reviewer, require Owner role, and verify ownership of the agreement. It receives the provisional integer OwnerId for later reconciliation; the reviewer identity is returned as canonical text to avoid imposing a final shared ID type.
2. StageDecisionAsync receives AgreementApprovalAudit: agreement ID, reviewer user ID, decision, optional reason (maximum 1000 characters), and UTC timestamp. This record is a transport contract, not a new EF entity. The future adapter must stage shared audit/workflow entities in the same scoped AppDbContext so the service's single SaveChanges commits the agreement and audit together. It must not independently save, send messages, or commit an external workflow.

The registered UnavailableAgreementApprovalIntegration denies every owner decision with 503. Even direct calls to RentalAgreementService cannot activate an agreement with this default adapter. Invalid transitions are rejected before requesting authorization; integration denial or audit staging failure leaves agreement state unchanged. Reason is trimmed; blank reasons become null. It is not stored yet because shared audit persistence does not exist.

Only tests inject a test double that simulates a trusted reviewer and captures the staged audit contract. Those tests verify invocation and failure behavior, not real human identity or final audit persistence. Production has no fake user, permissive fallback, second JWT implementation, or AI approval path. Future adapter tests must verify actual owner identity and transaction rollback of staged audit/workflow rows on concurrent decision failures.

## Agreement & Pricing Agent phase

### Inspection and scope

No Python project, requirements.txt, pyproject.toml, FastAPI service, LangGraph planner, shared agent tools/schemas, AI tests, or shared workflow entities exist in the current checkout. A read-only search of all locally available remote-tracking branches also found no shared agent/workflow implementation. No branches were fetched, copied, merged or modified.

Component C therefore provides a small in-process .NET implementation in Agents/AgreementPricing. It performs deterministic tool orchestration and template summarization. It does not pretend to call an LLM, use observed market statistics, or fulfill the future shared LangGraph/coordinator requirement. A model-backed summary tool or Python adapter can replace the corresponding interface after the team establishes that infrastructure. No new packages, Python project, HTTP server or external API are needed for this phase.

### Responsibility and contracts

The agent analyzes proposed terms, compares monthly rent with a supplied reference range, and returns a simplified explanation for human review. Amounts in this component are LKR. It cannot validate application acceptance or ownership while teammate contracts remain unresolved.

AgreementPricingInput uses camelCase JSON:

| Field | Contract |
| --- | --- |
| proposedRent | Required positive decimal, at most 9999999999.99 and two decimal places |
| startDate / endDate | Required ISO dates (yyyy-MM-dd), start strictly before end |
| applicationId / propertyId / tenantId / ownerId | Optional opaque strings, maximum 100 characters; integration references only |
| location / propertyType / bedrooms | Optional comparison context; bounded text and bedrooms 0-100 |
| termsDocument | Optional JSON string, maximum 12000 characters, containing paymentExpectation and conditions |
| marketReference | Optional input to the local tool; without it analysis returns MissingMarketData |

MarketRentReference contains estimatedMarketMin, estimatedMarketMax, kind (Simulated or Supplied), and source. Both amounts must be positive two-decimal values within the same money limit, minimum <= maximum. Source must be nonblank and at most 200 characters. No reference range is silently invented.

TermsDocument is a structured JSON object, not arbitrary prose or an uploaded PDF. Its paymentExpectation must be nonblank and at most 500 characters; conditions must be an array of at most 10 nonblank strings of at most 300 characters each. Missing documents produce explicit missing-terms warnings. Malformed documents fail instead of claiming extraction succeeded. Conditions are unverified data, never tool instructions.

AgreementPricingOutput contains summary, marketAssessment (BelowRange / WithinRange / AboveRange), estimatedMarketMin, estimatedMarketMax, proposedRent, draftTerms, warnings, referenceSource, referenceKind and requiresOwnerApproval=true. DraftTerms contains monthlyRent, startDate, endDate, paymentExpectation and conditions. It has no status, approval decision, reviewer or activation field.

An AgreementPricingResult envelope includes status (Succeeded/Failed), output or error, and observation. Failures have null output; no partial recommendation is treated as successful. Strict System.Text.Json contracts reject unknown properties, wrong numeric types, numeric enum encodings and excessive nesting. Explicit validators enforce business constraints on inputs, every tool output, and the final output after a JSON round trip. Dates/rent/conditions from the summary tool must exactly match validated terms.

### Example input

~~~json
{
  "proposedRent": 60000,
  "startDate": "2026-10-01",
  "endDate": "2027-10-01",
  "location": "Demonstration area",
  "propertyType": "Apartment",
  "bedrooms": 2,
  "marketReference": {
    "estimatedMarketMin": 50000,
    "estimatedMarketMax": 70000,
    "kind": "Simulated",
    "source": "Assignment fixture; not observed market data"
  },
  "termsDocument": "{\"paymentExpectation\":\"Pay by the fifth day of each month.\",\"conditions\":[\"No subletting without permission.\"]}"
}
~~~

This classifies as WithinRange. The boundary values are inclusive: below minimum is BelowRange; above maximum is AboveRange. Warnings always identify the comparison as a non-binding estimate and the summary as not legal advice. Simulated data is labelled explicitly; supplied data is labelled independently unverified.

### Tools and backend integration

- IMarketRentTool / SuppliedMarketRentTool returns the caller-supplied reference JSON or no data. No website scraping, payment, API credential or fabricated local dataset is involved.
- IAgreementTermsTool / StructuredAgreementTermsTool returns the structured terms document, or explicit unspecified terms when absent. No PDF/OCR/legal interpretation is claimed.
- IAgreementSummaryTool / TemplateAgreementSummaryTool returns JSON containing a concise deterministic explanation and draftTerms. A future model adapter must use the same schema and cancellation contract.
- AgreementPricingAgent orchestrates only these three allow-listed interfaces. AnalyzeAsync accepts typed input; AnalyzeJsonAsync accepts bounded strict JSON and returns structured input failures.

AddAgreementPricingAgent(configuration) supplies scoped dependency-injection registration and reads ComponentC:AgreementPricing:TimeoutMilliseconds (default 5000, supported 1-60000). The environment form is ComponentC__AgreementPricing__TimeoutMilliseconds. Registration is tested without a database or authentication. No URL or credential setting is necessary because no external service is called.

**Shared startup change required, intentionally not made:** the team can call builder.Services.AddAgreementPricingAgent(builder.Configuration) from Program.cs after reviewing composition. A future authenticated coordinator can resolve AgreementPricingAgent from DI. This phase does not alter shared startup, existing controllers, approval adapters, DbContext, or routes. The agent is callable/testable internally; it is not wired into the running API or agreement-drafting route yet.

### Human approval and workflow boundary

The agent receives no AppDbContext, RentalAgreementService, IAgreementApprovalIntegration, or mutation tool. It neither creates an agreement nor changes any status. Every successful result requires human Owner approval. Instruction-like document text remains labelled unverified data; it cannot execute actions. Display such content as escaped text in future clients.

The future coordinator must verify an accepted Application and trusted Property/User relations, run this analysis, validate/persist the result, prepare/submit a draft, then pause for Owner review. Only the existing trusted approval integration may decide an agreement. The production approval adapter still denies decisions and all existing Component C HTTP routes retain the 503 boundary. Neither AI failure nor successful analysis is approval.

### Observability and failures

AgentObservation is a returned Component C transport record, not an EF entity or replacement shared workflow schema. It carries agent name, validated input, tool names and validation outcomes, per-tool duration, final structured output, safe error code/message, total duration and final status. The future shared coordinator can map it to AgentWorkflowRun/Step. Nothing is persisted or automatically logged now. Invalid raw input and exception messages are not echoed. Observations may contain supplied terms/IDs, so persistence must use the team's access and retention controls. No chain-of-thought is requested, generated or recorded.

Failures include InvalidInput, MalformedTerms, MissingMarketData, ToolFailure, ModelUnavailable (for a future summary adapter), InvalidOutput, Timeout, Cancelled and AgentFailure. External exception text is replaced by stable safe messages. The total execution timeout includes awaited tools, and an uncooperative asynchronous tool cannot hold the caller indefinitely. Such adapters must still honor cancellation; cancellation cannot forcibly stop their internal work. The default tools have no external side effects. No automatic retries or fallback approvals exist.

### Verification and remaining dependencies

~~~powershell
dotnet build RentWise-Backend/RentWise-Backend.csproj --no-restore
dotnet test RentWise-Backend.Tests/RentWise-Backend.Tests.csproj --no-restore
dotnet test RentWise-Backend.Tests/RentWise-Backend.Tests.csproj --no-build --no-restore --filter Category=Agent
~~~

Agent tests run in the existing xUnit project and require no live model, API or database server. They cover strict JSON/typed validation, all three classifications including boundaries, missing data, malformed tools/terms/model output, safe errors, timeout/cancellation, mutable-output tampering, DI composition, and unchanged agreement/approval state. Existing backend/boundary tests remain in the full suite.

Pending team work: shared coordinator and persistent workflow schema; trusted identity/application/property adapters; reviewed startup integration; real comparable-property data source; optional actual model/Python adapter; human approval persistence and PostgreSQL integration. Other agents and components remain outside Component C scope. No migrations are created or modified.

## Safe agent-to-draft service integration

### Implemented in this phase

IAgreementPricingAgentClient is a transport-neutral, mockable boundary; LocalAgreementPricingAgentClient delegates to the preserved deterministic core. A future shared Python/FastAPI or model-service client can implement it without changing agreement business services. No endpoint URL, credential, network client or shared service is invented now.

AnalyzedAgreementDraftService.CreateAsync accepts the existing CreateAgreementDraftRequest plus Component C AgreementAnalysisContext (location, property type, bedrooms, structured terms document and optional market reference). It validates the request, maps the provisional IDs and agreement terms into agent input, runs analysis with a bounded timeout, and independently validates output and metadata against the original input. It does not trust a client's ValidationPassed flag alone. Dates are mapped from UTC agreement timestamps to date-only agent terms; persisted timestamps remain the original values.

Only a successful validated result reaches the existing RentalAgreementService.CreateDraftAsync. The response combines the persisted Drafted agreement with validated analysis and observation. Analysis is returned for use by the caller; it is NOT persisted and cannot be recovered by GET agreement after restart. No summary columns, audit tables, workflow entities or migrations are added. Agent failure, timeout, cancellation or malformed output creates no agreement. This service never submits, approves, activates or calls the approval port. Human decision remains a separate operation.

AddAgreementDraftAnalysis(configuration) composes the component client and facade with the existing RentalAgreementService registration. AddAgreementPricingAgent remains available for standalone agent use. Existing application startup and controllers remain unchanged, respecting the shared-change rule. The facade is internally callable and tested, but not exposed in the running draft route yet.

### Shared changes required, reported rather than performed

- Review adding builder.Services.AddAgreementDraftAnalysis(builder.Configuration) in Program.cs, then replace draft-route delegation with the facade only after identity/input contracts are trusted. Preserve the 503 boundary until then.
- Establish the shared accepted-Application/property lookup adapter. It must derive tenant and owner, not accept them from untrusted requests. Current analysis IDs are not proof of acceptance/ownership.
- Reconcile GUID User IDs with Component C integer TenantId/OwnerId and Component B integer TenantProfile.UserId. Application.Id, TenantProfileId and PropertyId are integers. Property remains an empty placeholder; listed rent/location/type/bedrooms/OwnerId are not yet a trusted mapped contract.
- Login currently emits JWT sub with a GUID string and ClaimTypes.Role. Team validation must determine claim mapping, validate tokens and scope all agreement/payment/reminder queries to trusted identity. Tenant sees/pays only their own resources; Owner decisions require property ownership; Admin monitoring needs an explicit team policy. No fake identity or second JWT system was added.

### Required shared workflow/persistence contract

No coordinator, Python/FastAPI service, LangGraph implementation, workflow status enum, shared agent client, AgentWorkflowRun, AgentWorkflowStep or ApprovalDecision was found in the current checkout or locally available remote-tracking references on reinspection. Remote state was not fetched or merged.

The future shared adapter must establish and persist a trusted association among WorkflowId, ApplicationId and RentalAgreementId. Persist only validated AgentObservation/input/output, tool calls, validation outcomes, safe errors, elapsed time, plan and final outcome. Keep free-text reasoning/chain-of-thought out of this contract. The current typed observation is only a handoff value; it is not evidence that a workflow was persisted.

Expected coordinator mapping:

| Event | Agreement | Shared workflow responsibility |
| --- | --- | --- |
| Accepted application verified, analysis begins | No final agreement | Running; retain trusted application/user/property references |
| Analysis fails | No newly created agreement | Failed with safe error and tool metadata; never auto-approve |
| Validated analysis used to create draft | Drafted | Persist analysis and association to draft |
| Explicit submit for owner review | PendingOwnerApproval | AwaitingApproval; pause for human decision |
| Verified Owner approves | Active | Stage ApprovalDecision and Completed atomically |
| Verified Owner rejects | Rejected | Stage decision and team-agreed rejection outcome |
| Verified Owner requests revision | RevisionRequested, then explicit redraft | Stage decision and team-agreed revision/resume state |

AgreementApprovalAudit now has an optional WorkflowId transport field alongside agreement ID, trusted reviewer ID, decision, reason and timestamp. Existing service calls leave it null because no trusted mapping exists. A future IAgreementApprovalIntegration adapter must look up and verify the association itself before staging shared entities; never populate it from untrusted decision JSON. This is not a new EF entity. Do not enable approval with missing workflow/audit persistence. Save the audit, workflow update and agreement decision in the same scoped DbContext/unit of work; test transaction rollback on concurrency or failure.

Rejected/revision workflow statuses remain deliberately unspecified because the documents name Running/AwaitingApproval/Completed/Failed but do not fully define rejection/resumption semantics. Agree this with the coordinator owner instead of inventing competing enums. The default UnavailableAgreementApprovalIntegration still blocks all decisions, and all HTTP boundaries remain unchanged.

### PostgreSQL coordination

This phase adds no EF schema changes. The old migration still mismatches the existing integer payment references, relationship/index/precision configuration and reminder uniqueness from earlier phases. Do not apply or regenerate it in isolation. Resolve shared User IDs, AppDbContext versus ApplicationDbContext, accepted-Application relationship/cardinality, Property ownership, renewal semantics and shared workflow association first. Determine whether the old migration was applied anywhere; then have the designated migration owner choose coordinated replacement (if unapplied) or additive corrections. SQLite tests do not verify PostgreSQL migration execution or final audit transactions.

## Agentic AI requirement assessment from supplied documents

Sources reviewed: RentWise_AI_Project_Proposal.pdf, sections 7, 7.1-7.3, 8, 11 and 13 (pages 3-7); RentWiseAI_Beginner_Build_Guide.pdf, alignment/refinements, ADR choice and service setup (pages 2-3, 14, 17-18, 24, 27). The original assignment specification/rubric is not attached separately; the guide's assertion that it checked the rubric is not independent access to that rubric.

| Capability/technology | Proposal requirement versus guide guidance | Current state |
| --- | --- | --- |
| Python | Not mandated as the only language in the proposal; guide's chosen implementation path | Not introduced |
| FastAPI | Not mandated by proposal; guide recommends an internal HTTP service and describes alternatives | Not introduced; replaceable client port prepared |
| LangGraph | Proposal gives it as an example (e.g. a LangGraph graph); guide recommends it and uses it in its build checklist | No shared planner exists |
| LLM/model call | Supplied proposal does not expressly specify a concrete model invocation as a standalone must; guide's OpenAI/Ollama configuration clearly anticipates a model-backed implementation | No live model call; template summary only. Cannot certify the original rubric's exact model criterion without that document |
| Tool invocation and deterministic validation | Explicit in proposal sections 7 and 7.3 | Component C invokes three bounded tools and validates their results |
| Planner/coordinator delegation across agents | Explicit in proposal sections 7-8; agents must be chained, not isolated | Not implemented; requires shared team work |
| Persisted state and observability | Explicit PostgreSQL workflow/step/audit requirement | Typed handoff metadata only; persistence missing |
| Human approval checkpoint | Mandatory before finalization, within assessed workflow | Local prevention and default-deny approval port exist; real authenticated/persisted pause/resume is missing |

A. The deterministic core satisfies Component C's testable rent classification, structured contracts, tool boundaries, simplified summary, non-binding warnings, validation, timeout/error behavior and absence of activation authority. The facade now proves a valid result can feed persistent draft creation without approval.

B. It does NOT fully satisfy the final Agentic AI requirement: no multi-agent planner/delegation, real shared workflow persistence, authenticated human pause/resume, cross-platform assessed chain, or actual model-backed behavior exists. Supplied reference data and JSON-only terms extraction are not real market retrieval or general agreement-document understanding.

C. Minimum credible additional work is to connect Component C as a tool-backed step in the team's chosen shared coordinator, supply the agreed model-backed planning/summary adapter while retaining deterministic validation/classification, connect trusted application/property data and reference tools, persist plan/steps/results/approval, implement authenticated owner pause/resume and prove the complete assessed workflow with tests. A particular Python/FastAPI/LangGraph stack is the guide's recommended route, not demonstrated as the only permitted stack by the proposal. Confirm the original rubric's exact model requirement before claiming compliance. Other students must provide their agents; Component C must not implement them.

The proposal itself has inconsistent pipeline enumeration: its prose says all four agents, while the detailed table omits explicit verification/maintenance steps and its final page mentions listing approval. Preserve the unambiguous planner, shared state and mandatory Owner approval requirements; agree the assessed chain as a team instead of expanding Component C ownership.
