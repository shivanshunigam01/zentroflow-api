/** Auto-generated Stage Master SSOT — Consolidated Developer Spec sheet 02 */
export const STAGE_MASTER = [
  {
    "code": "C0.1",
    "macro": "C0",
    "name": "Lead Captured",
    "businessObjective": "Create a valid lead, customer and opportunity record.",
    "entryTrigger": "lead.created",
    "entryConditions": "Lead received from approved source; tenant, branch and source identifiable.",
    "currentOwner": "SYSTEM",
    "currentAction": "Generate Lead ID, Customer ID and Opportunity ID; save source attribution.",
    "mandatoryValidation": "Mobile or approved alternate identifier; source; branch/territory; product interest; consent status.",
    "mandatoryFields": [
      "mobile",
      "source",
      "branch",
      "product",
      "consent_status"
    ],
    "possibleOutcomes": [
      "VALID LEAD",
      "INCOMPLETE LEAD",
      "INVALID LEAD"
    ],
    "exitCondition": "Lead record saved and canonical IDs generated.",
    "nextStage": "C0.2",
    "nextAction": "Run identity resolution",
    "nextOwner": "SYSTEM",
    "defaultSla": "1 minute",
    "escalationPath": "Technical support if record creation fails.",
    "exceptionPath": "Incomplete data queue; invalid lead rejection.",
    "systemEvent": "lead.captured"
  },
  {
    "code": "C0.2",
    "macro": "C0",
    "name": "Identity Resolution",
    "businessObjective": "Determine whether the enquiry is new, duplicate, reopened or linked to an existing customer.",
    "entryTrigger": "lead.captured",
    "entryConditions": "Canonical lead exists and minimum identifier is available.",
    "currentOwner": "SYSTEM",
    "currentAction": "Match customer, opportunity and product using mobile, email, vehicle, company and prior history.",
    "mandatoryValidation": "Identity confidence score; duplicate type; existing customer link; prior opportunity status.",
    "mandatoryFields": [],
    "possibleOutcomes": [
      "NEW CUSTOMER",
      "EXISTING CUSTOMER",
      "REOPEN",
      "UPGRADE",
      "CROSS-SELL",
      "EXCHANGE",
      "FLEET EXPANSION",
      "DUPLICATE"
    ],
    "exitCondition": "Identity status is resolved or sent for manual review.",
    "nextStage": "C0.3",
    "nextAction": "Evaluate contact health",
    "nextOwner": "SYSTEM",
    "defaultSla": "1 minute",
    "escalationPath": "CRM data steward if confidence is below threshold.",
    "exceptionPath": "Manual duplicate review; merge or retain separate opportunity.",
    "systemEvent": "lead.identity_resolved"
  },
  {
    "code": "C0.3",
    "macro": "C0",
    "name": "Contact Health",
    "businessObjective": "Identify the safest and most effective communication route.",
    "entryTrigger": "lead.identity_resolved",
    "entryConditions": "Customer identity or review decision is available.",
    "currentOwner": "SYSTEM",
    "currentAction": "Validate WhatsApp, call reachability, email, DND, geography and contact score.",
    "mandatoryValidation": "WhatsApp status; call status; email validity; DND; territory; language; preferred channel.",
    "mandatoryFields": [
      "whatsapp_status",
      "dnd_status",
      "territory"
    ],
    "possibleOutcomes": [
      "WA ACTIVE",
      "CALL ONLY",
      "EMAIL ONLY",
      "INVALID",
      "DND",
      "OUT OF TERRITORY"
    ],
    "exitCondition": "Contact route and contactability score generated.",
    "nextStage": "C0.4 or C0.5",
    "nextAction": "Start bot journey or create call task",
    "nextOwner": "BOT or AUTODIALER",
    "defaultSla": "Immediate",
    "escalationPath": "CRM manager if no valid contact route.",
    "exceptionPath": "Invalid nurture, data correction or out-of-territory transfer.",
    "systemEvent": "lead.contact_health_completed"
  },
  {
    "code": "C0.4",
    "macro": "C0",
    "name": "Bot Engagement",
    "businessObjective": "Engage WhatsApp-active customers and capture basic intent.",
    "entryTrigger": "lead.contact_health_completed",
    "entryConditions": "WhatsApp active; consent valid; approved template available.",
    "currentOwner": "ZentroBOT",
    "currentAction": "Send approved opening message and capture product, location, language and intent.",
    "mandatoryValidation": "Template; customer name; consent; product context; branch routing; opt-out handling.",
    "mandatoryFields": [
      "consent_status",
      "product",
      "branch"
    ],
    "possibleOutcomes": [
      "REPLIED",
      "READ_NO_REPLY",
      "DELIVERED_NO_READ",
      "OPTED_OUT",
      "CALLBACK_REQUESTED"
    ],
    "exitCondition": "Bot outcome recorded and next route selected.",
    "nextStage": "C0.5 or C0.6",
    "nextAction": "Create call task or start discovery",
    "nextOwner": "AUTODIALER or SALES EXECUTIVE",
    "defaultSla": "15 minutes to first response",
    "escalationPath": "Telesales manager if bot route fails or callback is missed.",
    "exceptionPath": "Retry message; call-only route; nurture; opt-out close.",
    "systemEvent": "lead.bot_outcome_recorded"
  },
  {
    "code": "C0.5",
    "macro": "C0",
    "name": "Call Contact",
    "businessObjective": "Establish voice contact and classify the lead.",
    "entryTrigger": "call.task_created",
    "entryConditions": "Valid callable number; no blocking DND condition; call script available.",
    "currentOwner": "AUTODIALER / TELESALES",
    "currentAction": "Attempt call, capture disposition, recording reference and callback commitment.",
    "mandatoryValidation": "Attempt count; disposition; connected duration; callback date/time; invalid reason.",
    "mandatoryFields": [
      "call_disposition"
    ],
    "possibleOutcomes": [
      "CONNECTED_INTERESTED",
      "CONNECTED_NOT_NOW",
      "NOT_ANSWERED",
      "BUSY",
      "INVALID",
      "NOT_INTERESTED"
    ],
    "exitCondition": "Valid disposition saved and next action scheduled.",
    "nextStage": "C0.6 or C0.9",
    "nextAction": "Start discovery or nurture/retry",
    "nextOwner": "SALES EXECUTIVE or CRM TEAM",
    "defaultSla": "Hot 5 min; Warm 30 min; Standard 2 hrs",
    "escalationPath": "Team leader, manager and auto-reassignment by SLA.",
    "exceptionPath": "Retry sequence; invalid correction; nurture; close with reason.",
    "systemEvent": "call.completed"
  },
  {
    "code": "C0.6",
    "macro": "C0",
    "name": "Need Discovery",
    "businessObjective": "Understand customer use case and purchase requirement.",
    "entryTrigger": "customer.engaged",
    "entryConditions": "Customer connected through bot, call, walk-in or referral.",
    "currentOwner": "SALES EXECUTIVE",
    "currentAction": "Capture usage, route, load, passenger type, budget, purchase timeline, location and finance preference.",
    "mandatoryValidation": "Usage; product need; route/load; budget; timeline; finance; exchange; decision maker; location.",
    "mandatoryFields": [
      "usage",
      "product",
      "route",
      "budget",
      "purchase_timeline",
      "finance_preference",
      "exchange",
      "decision_maker",
      "location"
    ],
    "possibleOutcomes": [
      "DISCOVERY COMPLETE",
      "MORE INFORMATION NEEDED",
      "CUSTOMER UNAVAILABLE"
    ],
    "exitCondition": "Mandatory discovery fields completed or approved follow-up created.",
    "nextStage": "C0.7",
    "nextAction": "Qualify lead",
    "nextOwner": "SALES EXECUTIVE",
    "defaultSla": "Same day",
    "escalationPath": "Sales team leader if hot lead remains incomplete.",
    "exceptionPath": "Follow-up; nurture; specialist consultation.",
    "systemEvent": "lead.discovery_completed"
  },
  {
    "code": "C0.7",
    "macro": "C0",
    "name": "Lead Qualification",
    "businessObjective": "Determine fit, seriousness and commercial eligibility.",
    "entryTrigger": "lead.discovery_completed",
    "entryConditions": "Minimum discovery data available.",
    "currentOwner": "SALES EXECUTIVE",
    "currentAction": "Classify fit, purchase horizon, authority, affordability, competition and expected value.",
    "mandatoryValidation": "Product fit; budget fit; timeline; decision maker; finance readiness; competition; expected value.",
    "mandatoryFields": [
      "product",
      "budget",
      "purchase_timeline",
      "decision_maker",
      "finance_preference",
      "competition"
    ],
    "possibleOutcomes": [
      "QUALIFIED",
      "NURTURE",
      "INVALID",
      "LOST",
      "SPECIALIST REVIEW"
    ],
    "exitCondition": "Qualification status and reason saved.",
    "nextStage": "C0.8",
    "nextAction": "Calculate lead score",
    "nextOwner": "SYSTEM",
    "defaultSla": "Real time",
    "escalationPath": "Manager review for high-value disqualification.",
    "exceptionPath": "Nurture, invalid, lost or specialist route.",
    "systemEvent": "lead.qualified"
  },
  {
    "code": "C0.8",
    "macro": "C0",
    "name": "Lead Scoring",
    "businessObjective": "Calculate priority using intent, fit, behaviour and value.",
    "entryTrigger": "lead.qualified",
    "entryConditions": "Qualification and engagement data available.",
    "currentOwner": "SYSTEM",
    "currentAction": "Calculate score, temperature and priority band.",
    "mandatoryValidation": "Intent score; engagement score; fit score; value; urgency; contact risk; negative signals.",
    "mandatoryFields": [],
    "possibleOutcomes": [
      "CRITICAL",
      "HOT",
      "WARM",
      "COLD",
      "NURTURE"
    ],
    "exitCondition": "Lead score, band and reason are stored.",
    "nextStage": "C0.9",
    "nextAction": "Generate next best action",
    "nextOwner": "SYSTEM",
    "defaultSla": "Real time",
    "escalationPath": "Rule administrator if score cannot be computed.",
    "exceptionPath": "Default score or manual priority review.",
    "systemEvent": "lead.scored"
  },
  {
    "code": "C0.9",
    "macro": "C0",
    "name": "Next Best Action",
    "businessObjective": "Select the highest-value next action and owner.",
    "entryTrigger": "lead.scored",
    "entryConditions": "Current context complete and at least one eligible rule available.",
    "currentOwner": "SYSTEM",
    "currentAction": "Evaluate rules, resolve conflicts and create one current action.",
    "mandatoryValidation": "Stage; score; customer request; last activity; product; finance; stock; SLA; owner availability.",
    "mandatoryFields": [
      "product",
      "finance_preference"
    ],
    "possibleOutcomes": [
      "QUOTE",
      "CALL",
      "DEMO",
      "FINANCE",
      "MANAGER INTERVENTION",
      "NURTURE",
      "DATA CORRECTION"
    ],
    "exitCondition": "One current action, owner, due time and reason created.",
    "nextStage": "C0.10 or relevant route",
    "nextAction": "Execute selected action",
    "nextOwner": "Rule-selected owner",
    "defaultSla": "Immediate",
    "escalationPath": "Action Engine health alert if no eligible rule.",
    "exceptionPath": "Fallback rule or management exception.",
    "systemEvent": "action.current_created"
  },
  {
    "code": "C0.10",
    "macro": "C0",
    "name": "Quote Readiness",
    "businessObjective": "Validate whether the opportunity can enter commercial discussion.",
    "entryTrigger": "action.current_created",
    "entryConditions": "Next best action is quote/commercial discussion.",
    "currentOwner": "SALES EXECUTIVE",
    "currentAction": "Complete quote-readiness checklist and collect missing inputs.",
    "mandatoryValidation": "Variant; quantity; budget; timeline; finance; decision maker; location; exchange; competition; taxes/registration context.",
    "mandatoryFields": [
      "variant",
      "quantity",
      "budget",
      "purchase_timeline",
      "finance_preference",
      "decision_maker",
      "location",
      "exchange",
      "competition",
      "taxes_registration"
    ],
    "possibleOutcomes": [
      "READY",
      "NOT READY",
      "MANAGER REVIEW"
    ],
    "exitCondition": "All mandatory quote fields complete.",
    "nextStage": "C1.1",
    "nextAction": "Generate and share quotation",
    "nextOwner": "SALES EXECUTIVE",
    "defaultSla": "1 hour",
    "escalationPath": "Sales manager if hot lead misses SLA.",
    "exceptionPath": "Return to discovery; specialist or approval route.",
    "systemEvent": "lead.quote_ready"
  },
  {
    "code": "C1.1",
    "macro": "C1",
    "name": "Quotation Shared",
    "businessObjective": "Present a version-controlled commercial proposal.",
    "entryTrigger": "lead.quote_ready",
    "entryConditions": "Quote readiness passed and current price/product masters are available.",
    "currentOwner": "SALES EXECUTIVE",
    "currentAction": "Generate quotation, EMI/TCO where applicable and share through approved channel.",
    "mandatoryValidation": "Quotation version; price; taxes; insurance; finance; exchange; accessories/body; validity.",
    "mandatoryFields": [
      "quotation_id",
      "insurance_policy",
      "finance_preference",
      "exchange"
    ],
    "possibleOutcomes": [
      "DELIVERED",
      "VIEWED",
      "FAILED",
      "REVISION REQUESTED"
    ],
    "exitCondition": "Quotation successfully shared and delivery status captured.",
    "nextStage": "C1.2",
    "nextAction": "Obtain acknowledgement",
    "nextOwner": "SALES EXECUTIVE",
    "defaultSla": "1 hour",
    "escalationPath": "Team leader if not shared or delivery fails.",
    "exceptionPath": "Correct contact; regenerate quote; alternate channel.",
    "systemEvent": "quote.shared"
  },
  {
    "code": "C1.2",
    "macro": "C1",
    "name": "Quote Acknowledgement",
    "businessObjective": "Confirm customer receipt and initial reaction.",
    "entryTrigger": "quote.shared",
    "entryConditions": "Quotation delivery attempted.",
    "currentOwner": "SALES EXECUTIVE / BOT",
    "currentAction": "Capture acknowledgement, questions, interest and follow-up commitment.",
    "mandatoryValidation": "Acknowledgement status; viewed status; response; next callback; decision date.",
    "mandatoryFields": [],
    "possibleOutcomes": [
      "ACKNOWLEDGED",
      "NO RESPONSE",
      "REVISION REQUESTED",
      "OBJECTION"
    ],
    "exitCondition": "Customer response or approved no-response follow-up saved.",
    "nextStage": "C1.3",
    "nextAction": "Capture objection or proceed",
    "nextOwner": "SALES EXECUTIVE",
    "defaultSla": "2 hours",
    "escalationPath": "Team leader for hot lead no-response.",
    "exceptionPath": "Automated reminder; call task; nurture.",
    "systemEvent": "quote.acknowledged"
  },
  {
    "code": "C1.3",
    "macro": "C1",
    "name": "Objection Capture",
    "businessObjective": "Classify the specific barrier preventing progression.",
    "entryTrigger": "customer.objection_received",
    "entryConditions": "Customer has expressed concern, hesitation or comparison.",
    "currentOwner": "SALES EXECUTIVE",
    "currentAction": "Record objection category, details, severity and desired resolution.",
    "mandatoryValidation": "Price; EMI; product; feature; delivery; finance; competition; trust; family/management approval.",
    "mandatoryFields": [
      "product",
      "delivery_proof",
      "finance_preference",
      "competition"
    ],
    "possibleOutcomes": [
      "PRICE",
      "AFFORDABILITY",
      "FINANCE",
      "PRODUCT",
      "COMPETITOR",
      "DELIVERY",
      "APPROVAL",
      "OTHER"
    ],
    "exitCondition": "Objection and evidence are saved.",
    "nextStage": "C1.4/C1.5/C1.6/C1.8/C1.9",
    "nextAction": "Route to objection-specific action",
    "nextOwner": "Relevant owner",
    "defaultSla": "Same day",
    "escalationPath": "Sales manager if no route exists.",
    "exceptionPath": "Specialist, manager, nurture or lost route.",
    "systemEvent": "objection.captured"
  },
  {
    "code": "C1.4",
    "macro": "C1",
    "name": "Affordability Resolution",
    "businessObjective": "Solve price, EMI, down-payment or ownership-cost concerns.",
    "entryTrigger": "objection.captured",
    "entryConditions": "Objection category is price, EMI, budget or value.",
    "currentOwner": "SALES EXECUTIVE / FINANCE EXECUTIVE",
    "currentAction": "Run EMI/TCO, scheme, exchange and value comparison; seek discount approval if needed.",
    "mandatoryValidation": "Budget gap; EMI tolerance; down payment; scheme; exchange value; discount approval.",
    "mandatoryFields": [
      "budget",
      "payment_reference",
      "exchange"
    ],
    "possibleOutcomes": [
      "RESOLVED",
      "FINANCE REQUIRED",
      "APPROVAL REQUIRED",
      "NOT FEASIBLE"
    ],
    "exitCondition": "Customer accepts commercial path or clear alternate path selected.",
    "nextStage": "C1.5/C1.8/C1.10/C1.9",
    "nextAction": "Finance discussion, approval, proceed or nurture",
    "nextOwner": "Relevant owner",
    "defaultSla": "Same day",
    "escalationPath": "Sales manager for unresolved hot/high-value case.",
    "exceptionPath": "Discount approval; lower variant; nurture; lost.",
    "systemEvent": "affordability.resolved"
  },
  {
    "code": "C1.5",
    "macro": "C1",
    "name": "Finance Discussion",
    "businessObjective": "Understand financing requirement and readiness.",
    "entryTrigger": "finance.required",
    "entryConditions": "Customer wants finance or affordability route requires finance.",
    "currentOwner": "FINANCE EXECUTIVE",
    "currentAction": "Capture lender preference, income type, approximate eligibility, documents and consent.",
    "mandatoryValidation": "Consent; income type; monthly income; liabilities; down payment; tenure; bureau permission; lender preference.",
    "mandatoryFields": [
      "consent_status",
      "income_type",
      "payment_reference",
      "lender"
    ],
    "possibleOutcomes": [
      "ELIGIBLE TO APPLY",
      "MORE DOCS",
      "ALTERNATE STRUCTURE",
      "CUSTOMER DECLINES"
    ],
    "exitCondition": "Finance eligibility inputs complete and consent captured.",
    "nextStage": "C1.10 or C1A.1",
    "nextAction": "Create finance application or return commercial decision",
    "nextOwner": "FINANCE EXECUTIVE",
    "defaultSla": "4 hours",
    "escalationPath": "Finance manager if hot case unattended.",
    "exceptionPath": "Document collection; alternate structure; nurture.",
    "systemEvent": "finance.discussion_completed"
  },
  {
    "code": "C1.6",
    "macro": "C1",
    "name": "Competitor Comparison",
    "businessObjective": "Resolve competitor-led hesitation with structured comparison.",
    "entryTrigger": "objection.captured",
    "entryConditions": "Competitor product or offer identified.",
    "currentOwner": "SALES EXECUTIVE / PRODUCT SPECIALIST",
    "currentAction": "Compare product, ownership cost, service, finance, resale and use-case suitability.",
    "mandatoryValidation": "Competitor; quoted price; feature gap; service network; customer priority; counter-positioning.",
    "mandatoryFields": [
      "quotation_id"
    ],
    "possibleOutcomes": [
      "CUSTOMER CONVINCED",
      "DEMO REQUIRED",
      "MANAGER SUPPORT",
      "LOST TO COMPETITOR"
    ],
    "exitCondition": "Comparison outcome and next commitment recorded.",
    "nextStage": "C1.7/C1.8/C1.10/C1.9",
    "nextAction": "Demo, manager intervention, proceed or nurture",
    "nextOwner": "Relevant owner",
    "defaultSla": "Same day",
    "escalationPath": "Sales manager for strategic/high-value loss risk.",
    "exceptionPath": "Demo; senior intervention; nurture; competitor-lost lifecycle.",
    "systemEvent": "competitor.comparison_completed"
  },
  {
    "code": "C1.7",
    "macro": "C1",
    "name": "Demo / Test Drive",
    "businessObjective": "Provide product experience and capture outcome.",
    "entryTrigger": "test_drive.requested",
    "entryConditions": "Customer, eligible product, location and slot available; required licence/OTP conditions met.",
    "currentOwner": "SALES EXECUTIVE / DEMO COORDINATOR",
    "currentAction": "Schedule, assign vehicle, send reminders, execute demo and capture feedback.",
    "mandatoryValidation": "Slot; vehicle; executive; route; OTP/licence; start/end; feedback; rating; photos if required.",
    "mandatoryFields": [
      "route",
      "customer_otp",
      "feedback_rating"
    ],
    "possibleOutcomes": [
      "POSITIVE",
      "NEUTRAL",
      "NEGATIVE",
      "RESCHEDULE",
      "NO SHOW"
    ],
    "exitCondition": "Demo completed or approved reschedule/no-show action created.",
    "nextStage": "C1.8/C1.10/C1.9",
    "nextAction": "Manager intervention, proceed or nurture",
    "nextOwner": "Relevant owner",
    "defaultSla": "Same day / selected slot",
    "escalationPath": "Sales manager for no allocation or repeated no-show.",
    "exceptionPath": "Reschedule; alternate vehicle; virtual demo; nurture.",
    "systemEvent": "test_drive.completed"
  },
  {
    "code": "C1.8",
    "macro": "C1",
    "name": "Manager Intervention",
    "businessObjective": "Resolve high-value, exception, discount or stuck opportunity.",
    "entryTrigger": "manager.intervention_required",
    "entryConditions": "Rule threshold, SLA breach, approval need or executive request met.",
    "currentOwner": "SALES MANAGER / BRANCH HEAD",
    "currentAction": "Review full context, contact customer if needed and decide intervention.",
    "mandatoryValidation": "Lead summary; value; objection; requested approval; activity history; recommended action.",
    "mandatoryFields": [],
    "possibleOutcomes": [
      "APPROVED",
      "REVISED OFFER",
      "OWNER CHANGE",
      "NURTURE",
      "LOST",
      "ESCALATE"
    ],
    "exitCondition": "Manager decision and responsibility recorded.",
    "nextStage": "C1.4/C1.5/C1.7/C1.10/C1.9",
    "nextAction": "Execute manager decision",
    "nextOwner": "Decision owner",
    "defaultSla": "30 minutes hot; same day standard",
    "escalationPath": "Branch head or business head.",
    "exceptionPath": "Reassign; exception approval; strategic review.",
    "systemEvent": "manager.intervention_completed"
  },
  {
    "code": "C1.9",
    "macro": "C1",
    "name": "Nurture / Hold",
    "businessObjective": "Maintain future opportunity with a dated reason and next trigger.",
    "entryTrigger": "nurture.selected",
    "entryConditions": "Customer not ready now but remains potentially valid.",
    "currentOwner": "CRM TEAM / SALES EXECUTIVE",
    "currentAction": "Set nurture reason, next date, channel and content track.",
    "mandatoryValidation": "Reason; expected purchase date; next follow-up; product; campaign; consent.",
    "mandatoryFields": [
      "product",
      "consent_status"
    ],
    "possibleOutcomes": [
      "REENGAGED",
      "CONTINUE NURTURE",
      "LOST",
      "INVALID"
    ],
    "exitCondition": "Future trigger and owner are scheduled.",
    "nextStage": "C0.5/C0.6/C1.1 or remain C1.9",
    "nextAction": "Re-engage through call/bot/content",
    "nextOwner": "CRM TEAM / SALES",
    "defaultSla": "As configured",
    "escalationPath": "CRM manager when nurture date is missed.",
    "exceptionPath": "Long-term lifecycle; invalid; lost.",
    "systemEvent": "lead.nurture_scheduled"
  },
  {
    "code": "C1.10",
    "macro": "C1",
    "name": "Commercial Commitment",
    "businessObjective": "Confirm the customer’s willingness to proceed to finance or booking.",
    "entryTrigger": "commercial.intent_detected",
    "entryConditions": "Quotation, objection resolution and required demo/manager actions are complete.",
    "currentOwner": "SALES EXECUTIVE",
    "currentAction": "Capture selected variant, price understanding, finance route, expected booking date and commitment.",
    "mandatoryValidation": "Variant; colour; price acceptance; finance/cash; expected booking date; add-on interest.",
    "mandatoryFields": [
      "variant",
      "colour",
      "finance_preference"
    ],
    "possibleOutcomes": [
      "FINANCE APPLICATION",
      "DIRECT BOOKING",
      "HOLD",
      "LOST"
    ],
    "exitCondition": "Commercial route and commitment are recorded.",
    "nextStage": "C1A.1 or C2.1 or C1.9",
    "nextAction": "Start finance or collect booking payment",
    "nextOwner": "FINANCE EXECUTIVE or SALES/ACCOUNTS",
    "defaultSla": "Same day",
    "escalationPath": "Sales manager if committed hot lead stalls.",
    "exceptionPath": "Nurture; lost; manager intervention.",
    "systemEvent": "commercial.commitment_recorded"
  },
  {
    "code": "C1A.1",
    "macro": "C1A",
    "name": "Finance Application Submitted",
    "businessObjective": "Create a complete lender-ready finance case.",
    "entryTrigger": "finance.application_requested",
    "entryConditions": "Consent captured; customer chooses finance route.",
    "currentOwner": "FINANCE EXECUTIVE",
    "currentAction": "Create application and lender case reference.",
    "mandatoryValidation": "Applicant/co-applicant; consent; product; loan amount; tenure; branch; lender; KYC basics.",
    "mandatoryFields": [
      "consent_status",
      "product",
      "branch",
      "lender",
      "kyc_docs"
    ],
    "possibleOutcomes": [
      "SUBMITTED",
      "INCOMPLETE",
      "DUPLICATE",
      "LENDER ERROR"
    ],
    "exitCondition": "Application reference created.",
    "nextStage": "C1A.2",
    "nextAction": "Collect and verify documents",
    "nextOwner": "FINANCE EXECUTIVE",
    "defaultSla": "Same day",
    "escalationPath": "Finance manager if system/lender error persists.",
    "exceptionPath": "Retry lender; alternate lender; manual case.",
    "systemEvent": "finance.application_submitted"
  },
  {
    "code": "C1A.2",
    "macro": "C1A",
    "name": "Finance Documents",
    "businessObjective": "Collect mandatory documents and verify completeness.",
    "entryTrigger": "finance.application_submitted",
    "entryConditions": "Active finance case exists.",
    "currentOwner": "FINANCE EXECUTIVE",
    "currentAction": "Issue checklist, collect documents, classify pending items and verify legibility.",
    "mandatoryValidation": "KYC; income; banking; address; business/employment; co-applicant; consent; document quality.",
    "mandatoryFields": [
      "kyc_docs",
      "income_type",
      "consent_status"
    ],
    "possibleOutcomes": [
      "COMPLETE",
      "PENDING CUSTOMER",
      "INVALID DOC",
      "ALTERNATE DOC REQUIRED"
    ],
    "exitCondition": "Mandatory documents complete or approved exception recorded.",
    "nextStage": "C1A.3",
    "nextAction": "Start FI/verification",
    "nextOwner": "FINANCE EXECUTIVE",
    "defaultSla": "24 hours standard; 48 hours max",
    "escalationPath": "Finance manager at threshold.",
    "exceptionPath": "Reminder; field collection; alternate lender; nurture.",
    "systemEvent": "finance.documents_completed"
  },
  {
    "code": "C1A.3",
    "macro": "C1A",
    "name": "Field Investigation",
    "businessObjective": "Complete residence/business/employment verification where required.",
    "entryTrigger": "finance.documents_completed",
    "entryConditions": "Lender or policy requires field investigation.",
    "currentOwner": "FI AGENCY / FINANCE TEAM",
    "currentAction": "Assign FI, capture visit, geo/photo/evidence and result.",
    "mandatoryValidation": "Address; contact; visit slot; geo; photographs; verifier remarks; result.",
    "mandatoryFields": [],
    "possibleOutcomes": [
      "POSITIVE",
      "NEGATIVE",
      "NOT CONTACTABLE",
      "RESCHEDULE"
    ],
    "exitCondition": "FI result submitted.",
    "nextStage": "C1A.4",
    "nextAction": "Run lender verification/credit checks",
    "nextOwner": "FINANCE EXECUTIVE",
    "defaultSla": "24 hours",
    "escalationPath": "Finance manager for delayed FI.",
    "exceptionPath": "Reschedule; alternate proof; alternate lender.",
    "systemEvent": "finance.fi_completed"
  },
  {
    "code": "C1A.4",
    "macro": "C1A",
    "name": "Credit and Verification",
    "businessObjective": "Run bureau, KYC, banking and lender validations.",
    "entryTrigger": "finance.fi_completed or finance.documents_completed",
    "entryConditions": "Required consent and documents available.",
    "currentOwner": "FINANCE SYSTEM / FINANCE EXECUTIVE",
    "currentAction": "Invoke verification APIs and consolidate outcome.",
    "mandatoryValidation": "Bureau response; KYC; bank statement; fraud flags; policy rules; lender response.",
    "mandatoryFields": [
      "kyc_docs",
      "policy_expiry",
      "lender"
    ],
    "possibleOutcomes": [
      "PASS",
      "REFER",
      "FAIL",
      "API ERROR"
    ],
    "exitCondition": "Verification result and reason stored.",
    "nextStage": "C1A.5",
    "nextAction": "Lender decision",
    "nextOwner": "FINANCE EXECUTIVE",
    "defaultSla": "4 hours after complete file",
    "escalationPath": "Finance manager on API/lender delay.",
    "exceptionPath": "Retry; manual review; alternate lender.",
    "systemEvent": "finance.verification_completed"
  },
  {
    "code": "C1A.5",
    "macro": "C1A",
    "name": "Finance Decision",
    "businessObjective": "Obtain lender approve, decline or conditional decision.",
    "entryTrigger": "finance.verification_completed",
    "entryConditions": "Lender-ready file submitted.",
    "currentOwner": "LENDER / FINANCE EXECUTIVE",
    "currentAction": "Track decision, conditions, sanctioned amount and validity.",
    "mandatoryValidation": "Decision; sanctioned amount; tenure; rate; conditions; validity; rejection reason.",
    "mandatoryFields": [
      "sanction_amount"
    ],
    "possibleOutcomes": [
      "APPROVED",
      "CONDITIONAL",
      "REJECTED",
      "PENDING"
    ],
    "exitCondition": "Decision communicated and next route selected.",
    "nextStage": "C1A.6 or C1A.2 or C1.9",
    "nextAction": "Process approval, fulfil conditions or alternate/nurture",
    "nextOwner": "FINANCE EXECUTIVE",
    "defaultSla": "Same day",
    "escalationPath": "Finance manager and sales manager.",
    "exceptionPath": "Alternate lender; document fulfilment; nurture.",
    "systemEvent": "finance.decision_received"
  },
  {
    "code": "C1A.6",
    "macro": "C1A",
    "name": "Approval Received",
    "businessObjective": "Confirm finance approval and customer acceptance.",
    "entryTrigger": "finance.decision_received",
    "entryConditions": "Approved or conditional decision available.",
    "currentOwner": "FINANCE EXECUTIVE",
    "currentAction": "Explain sanction and capture acceptance of rate, tenure and conditions.",
    "mandatoryValidation": "Sanction letter; amount; EMI; tenure; rate; margin; conditions; customer acceptance.",
    "mandatoryFields": [
      "sanction_amount",
      "margin"
    ],
    "possibleOutcomes": [
      "ACCEPTED",
      "RENEGOTIATE",
      "DECLINED",
      "CONDITIONAL PENDING"
    ],
    "exitCondition": "Customer accepts workable approval.",
    "nextStage": "C1A.7",
    "nextAction": "Confirm margin/down payment",
    "nextOwner": "FINANCE + SALES",
    "defaultSla": "Same day",
    "escalationPath": "Finance manager for rejected acceptance.",
    "exceptionPath": "Alternate lender; revised structure; nurture.",
    "systemEvent": "finance.approval_accepted"
  },
  {
    "code": "C1A.7",
    "macro": "C1A",
    "name": "Margin Confirmation",
    "businessObjective": "Confirm customer contribution and payment plan.",
    "entryTrigger": "finance.approval_accepted",
    "entryConditions": "Sanction terms available.",
    "currentOwner": "FINANCE EXECUTIVE / SALES EXECUTIVE",
    "currentAction": "Calculate final down payment, margin, booking and payment schedule.",
    "mandatoryValidation": "Sanction; ex-showroom/on-road; margin; exchange; advance; payment dates.",
    "mandatoryFields": [
      "sanction_amount",
      "margin",
      "exchange",
      "payment_reference"
    ],
    "possibleOutcomes": [
      "CONFIRMED",
      "SHORTFALL",
      "APPROVAL REQUIRED",
      "CUSTOMER HOLD"
    ],
    "exitCondition": "Margin/payment plan accepted.",
    "nextStage": "C1A.8",
    "nextAction": "Lock variant and commercial configuration",
    "nextOwner": "SALES EXECUTIVE",
    "defaultSla": "Same day",
    "escalationPath": "Sales manager for shortfall/high discount.",
    "exceptionPath": "Rework finance; discount approval; lower variant; nurture.",
    "systemEvent": "finance.margin_confirmed"
  },
  {
    "code": "C1A.8",
    "macro": "C1A",
    "name": "Variant Lock",
    "businessObjective": "Freeze model, variant, colour and quantity for booking.",
    "entryTrigger": "finance.margin_confirmed or cash_commitment",
    "entryConditions": "Commercial commitment is valid.",
    "currentOwner": "SALES EXECUTIVE",
    "currentAction": "Confirm selected product configuration and availability intent.",
    "mandatoryValidation": "Model; variant; colour; quantity; branch; expected delivery; price version.",
    "mandatoryFields": [
      "variant",
      "colour",
      "quantity",
      "branch",
      "delivery_proof"
    ],
    "possibleOutcomes": [
      "LOCKED",
      "CHANGE REQUESTED",
      "UNAVAILABLE"
    ],
    "exitCondition": "Product configuration accepted.",
    "nextStage": "C1A.9",
    "nextAction": "Finalize add-ons and protections",
    "nextOwner": "SALES EXECUTIVE",
    "defaultSla": "Same day",
    "escalationPath": "Sales manager/stock manager if unavailable.",
    "exceptionPath": "Alternative variant; stock transfer; waitlist.",
    "systemEvent": "product.variant_locked"
  },
  {
    "code": "C1A.9",
    "macro": "C1A",
    "name": "Add-on Finalisation",
    "businessObjective": "Finalize insurance, accessories, AMC, warranty, body and related add-ons.",
    "entryTrigger": "product.variant_locked",
    "entryConditions": "Variant locked and add-on catalogue available.",
    "currentOwner": "SALES EXECUTIVE / SPECIALIST",
    "currentAction": "Present eligible add-ons and capture acceptance/decline.",
    "mandatoryValidation": "Insurance; accessories; warranty; AMC; body; service plan; approved pricing.",
    "mandatoryFields": [
      "insurance_policy"
    ],
    "possibleOutcomes": [
      "ACCEPTED",
      "PARTIAL",
      "DECLINED",
      "APPROVAL REQUIRED"
    ],
    "exitCondition": "Selected add-ons and prices recorded.",
    "nextStage": "C1A.10",
    "nextAction": "Confirm booking intent",
    "nextOwner": "SALES EXECUTIVE",
    "defaultSla": "Same day",
    "escalationPath": "Sales manager for approval delay.",
    "exceptionPath": "Proceed without optional add-ons; approval; nurture.",
    "systemEvent": "commercial.addons_finalized"
  },
  {
    "code": "C1A.10",
    "macro": "C1A",
    "name": "Booking Intent Confirmed",
    "businessObjective": "Obtain explicit confirmation to pay booking amount.",
    "entryTrigger": "commercial.addons_finalized",
    "entryConditions": "Variant and commercial structure finalised.",
    "currentOwner": "SALES EXECUTIVE",
    "currentAction": "Record booking commitment, amount, payment mode and expected time.",
    "mandatoryValidation": "Booking amount; payment mode; payer; expected payment time; final quotation reference.",
    "mandatoryFields": [
      "booking_amount",
      "payment_reference",
      "quotation_id"
    ],
    "possibleOutcomes": [
      "CONFIRMED",
      "HOLD",
      "DECLINED"
    ],
    "exitCondition": "Customer confirms booking and payment action is created.",
    "nextStage": "C2.1",
    "nextAction": "Collect and verify booking payment",
    "nextOwner": "SALES / ACCOUNTS",
    "defaultSla": "Same day",
    "escalationPath": "Sales manager if committed customer misses payment.",
    "exceptionPath": "Reminder; nurture; cancel intent.",
    "systemEvent": "booking.intent_confirmed"
  },
  {
    "code": "C2.1",
    "macro": "C2",
    "name": "Booking Done",
    "businessObjective": "Create confirmed booking against verified payment.",
    "entryTrigger": "booking.payment_received",
    "entryConditions": "Payment successful and booking intent active.",
    "currentOwner": "ACCOUNTS / SALES",
    "currentAction": "Verify payment, issue receipt and create booking record.",
    "mandatoryValidation": "Payment reference; amount; mode; receipt; quotation; customer; product; branch.",
    "mandatoryFields": [
      "payment_reference",
      "quotation_id",
      "product",
      "branch"
    ],
    "possibleOutcomes": [
      "CONFIRMED",
      "PAYMENT FAILED",
      "PAYMENT PENDING",
      "CANCELLED"
    ],
    "exitCondition": "Booking ID and verified receipt generated.",
    "nextStage": "C2.2",
    "nextAction": "Allocate vehicle or procurement path",
    "nextOwner": "STOCK MANAGER",
    "defaultSla": "Same day",
    "escalationPath": "Sales manager and accounts if mismatch.",
    "exceptionPath": "Retry payment; refund; pending payment follow-up.",
    "systemEvent": "booking.completed"
  },
  {
    "code": "C2.2",
    "macro": "C2",
    "name": "Vehicle Allocation",
    "businessObjective": "Reserve available chassis/stock against booking.",
    "entryTrigger": "booking.completed",
    "entryConditions": "Confirmed booking and product configuration exist.",
    "currentOwner": "STOCK MANAGER",
    "currentAction": "Allocate chassis or initiate stock transfer/procurement.",
    "mandatoryValidation": "Model; variant; colour; chassis; yard; branch; booking priority; ETA.",
    "mandatoryFields": [
      "variant",
      "colour",
      "chassis",
      "branch"
    ],
    "possibleOutcomes": [
      "ALLOCATED",
      "TRANSFER REQUIRED",
      "PROCUREMENT REQUIRED",
      "WAITLIST"
    ],
    "exitCondition": "Allocation or approved supply path recorded.",
    "nextStage": "C2.3",
    "nextAction": "Confirm variant/stock lock",
    "nextOwner": "STOCK MANAGER",
    "defaultSla": "Same day",
    "escalationPath": "Sales/branch manager if unavailable.",
    "exceptionPath": "Alternative variant; transfer; waitlist; refund route.",
    "systemEvent": "vehicle.allocation_completed"
  },
  {
    "code": "C2.3",
    "macro": "C2",
    "name": "Stock and Variant Confirmation",
    "businessObjective": "Confirm that allocated unit matches customer commitment.",
    "entryTrigger": "vehicle.allocation_completed",
    "entryConditions": "Chassis allocation or supply plan available.",
    "currentOwner": "STOCK MANAGER / SALES",
    "currentAction": "Validate product, colour, build/specification and customer approval for changes.",
    "mandatoryValidation": "Chassis; VIN; variant; colour; manufacturing details; customer acceptance.",
    "mandatoryFields": [
      "chassis",
      "variant",
      "colour"
    ],
    "possibleOutcomes": [
      "CONFIRMED",
      "CHANGE REQUESTED",
      "CUSTOMER APPROVAL PENDING"
    ],
    "exitCondition": "Customer and dealer confirm allocated configuration.",
    "nextStage": "C2.4",
    "nextAction": "Start billing",
    "nextOwner": "BILLING TEAM",
    "defaultSla": "Same day",
    "escalationPath": "Sales manager if customer approval delayed.",
    "exceptionPath": "Reallocate; change variant; waitlist.",
    "systemEvent": "vehicle.stock_confirmed"
  },
  {
    "code": "C2.4",
    "macro": "C2",
    "name": "Billing Preparation",
    "businessObjective": "Prepare invoice and required commercial documents.",
    "entryTrigger": "vehicle.stock_confirmed",
    "entryConditions": "Allocation confirmed and commercial approvals complete.",
    "currentOwner": "BILLING TEAM",
    "currentAction": "Validate invoice data, tax, discount, financier and customer details.",
    "mandatoryValidation": "GST/customer data; price version; discount approval; financier; insurance; address; chassis.",
    "mandatoryFields": [
      "insurance_policy",
      "chassis"
    ],
    "possibleOutcomes": [
      "READY TO BILL",
      "DATA ERROR",
      "APPROVAL PENDING"
    ],
    "exitCondition": "Billing checklist passed.",
    "nextStage": "C2.5",
    "nextAction": "Initiate disbursement/final billing",
    "nextOwner": "BILLING / FINANCE",
    "defaultSla": "Same day",
    "escalationPath": "Accounts manager for unresolved data/approval.",
    "exceptionPath": "Data correction; approval; hold.",
    "systemEvent": "billing.ready"
  },
  {
    "code": "C2.5",
    "macro": "C2",
    "name": "Disbursement and Finance Closure",
    "businessObjective": "Complete lender disbursement and financial clearance.",
    "entryTrigger": "billing.ready",
    "entryConditions": "Finance-approved case or cash route; invoice readiness available.",
    "currentOwner": "FINANCE EXECUTIVE / ACCOUNTS",
    "currentAction": "Submit invoice/docs to lender, track disbursement and reconcile.",
    "mandatoryValidation": "Invoice; sanction; margin receipt; lender docs; disbursement reference; amount.",
    "mandatoryFields": [
      "sanction_amount",
      "margin",
      "lender"
    ],
    "possibleOutcomes": [
      "DISBURSED",
      "PENDING",
      "SHORT",
      "REJECTED"
    ],
    "exitCondition": "Required disbursement amount received or approved exception exists.",
    "nextStage": "C2.6",
    "nextAction": "Collect remaining down payment",
    "nextOwner": "ACCOUNTS",
    "defaultSla": "Same day / lender SLA",
    "escalationPath": "Finance manager and accounts head.",
    "exceptionPath": "Re-submit; alternate finance; payment hold.",
    "systemEvent": "finance.disbursed"
  },
  {
    "code": "C2.6",
    "macro": "C2",
    "name": "Final Down Payment",
    "businessObjective": "Collect and reconcile customer balance contribution.",
    "entryTrigger": "finance.disbursed or cash_booking",
    "entryConditions": "Final payable amount calculated.",
    "currentOwner": "ACCOUNTS",
    "currentAction": "Issue demand, collect payment and reconcile booking/margin/balance.",
    "mandatoryValidation": "Total payable; paid amount; pending amount; payment mode; receipt; waiver/approval.",
    "mandatoryFields": [
      "payment_reference"
    ],
    "possibleOutcomes": [
      "PAID",
      "PARTIAL",
      "FAILED",
      "APPROVED PENDING"
    ],
    "exitCondition": "Financial clearance for delivery process is available.",
    "nextStage": "C2.7",
    "nextAction": "Activate insurance",
    "nextOwner": "INSURANCE TEAM",
    "defaultSla": "Same day",
    "escalationPath": "Accounts/sales manager if overdue.",
    "exceptionPath": "Payment reminder; approved pending; cancellation.",
    "systemEvent": "payment.final_clearance"
  },
  {
    "code": "C2.7",
    "macro": "C2",
    "name": "Insurance Activation",
    "businessObjective": "Issue valid insurance policy for allocated vehicle.",
    "entryTrigger": "payment.final_clearance",
    "entryConditions": "Customer and vehicle data complete; insurer selected.",
    "currentOwner": "INSURANCE TEAM",
    "currentAction": "Create proposal, collect required declarations/payment and issue policy.",
    "mandatoryValidation": "Customer; nominee; chassis; insurer; cover; add-ons; premium; policy dates.",
    "mandatoryFields": [
      "chassis",
      "policy_expiry"
    ],
    "possibleOutcomes": [
      "POLICY ISSUED",
      "QUERY",
      "PAYMENT PENDING",
      "REJECTED"
    ],
    "exitCondition": "Valid policy number and document available.",
    "nextStage": "C2.8",
    "nextAction": "Start registration",
    "nextOwner": "REGISTRATION TEAM",
    "defaultSla": "Same day",
    "escalationPath": "Insurance manager / branch head.",
    "exceptionPath": "Correct data; alternate insurer; hold registration.",
    "systemEvent": "insurance.activated"
  },
  {
    "code": "C2.8",
    "macro": "C2",
    "name": "Registration Processing",
    "businessObjective": "Complete RTO registration workflow.",
    "entryTrigger": "insurance.activated",
    "entryConditions": "Insurance active; billing/vehicle/customer documents complete.",
    "currentOwner": "REGISTRATION TEAM",
    "currentAction": "Submit registration, track approval and number allocation.",
    "mandatoryValidation": "Invoice; insurance; KYC; address; financier; form data; fees; application reference.",
    "mandatoryFields": [
      "insurance_policy",
      "kyc_docs"
    ],
    "possibleOutcomes": [
      "SUBMITTED",
      "APPROVED",
      "QUERY",
      "REJECTED"
    ],
    "exitCondition": "Registration approval or permitted temporary-delivery condition recorded.",
    "nextStage": "C2.9",
    "nextAction": "Process HSRP / number plate",
    "nextOwner": "REGISTRATION TEAM",
    "defaultSla": "As per RTO SLA",
    "escalationPath": "Registration manager for unresolved query.",
    "exceptionPath": "Correct documents; resubmit; approved temporary delivery.",
    "systemEvent": "registration.approved"
  },
  {
    "code": "C2.9",
    "macro": "C2",
    "name": "HSRP / Number Plate",
    "businessObjective": "Obtain and fit required registration plates.",
    "entryTrigger": "registration.approved",
    "entryConditions": "Registration number or authorised HSRP request available.",
    "currentOwner": "REGISTRATION / YARD TEAM",
    "currentAction": "Order, receive, fit and verify HSRP/number plate.",
    "mandatoryValidation": "Registration number; order reference; plate status; fitment proof.",
    "mandatoryFields": [
      "registration_number"
    ],
    "possibleOutcomes": [
      "FITTED",
      "IN TRANSIT",
      "DELAYED",
      "EXEMPT/APPROVED PENDING"
    ],
    "exitCondition": "Plate fitted or approved exception recorded.",
    "nextStage": "C2.10",
    "nextAction": "Run final PDI",
    "nextOwner": "PDI TEAM",
    "defaultSla": "Before delivery",
    "escalationPath": "Delivery manager if delayed.",
    "exceptionPath": "Delivery reschedule; exception approval.",
    "systemEvent": "hsrp.completed"
  },
  {
    "code": "C2.10",
    "macro": "C2",
    "name": "Pre-Delivery Inspection",
    "businessObjective": "Ensure vehicle quality and delivery compliance.",
    "entryTrigger": "hsrp.completed or vehicle.ready_for_pdi",
    "entryConditions": "Allocated vehicle physically available and inspection checklist applicable.",
    "currentOwner": "PDI TEAM",
    "currentAction": "Perform technical, cosmetic, accessory, document and readiness inspection.",
    "mandatoryValidation": "Checklist; odometer; battery/fuel; damage; accessories; tools; documents; photos; defect closure.",
    "mandatoryFields": [],
    "possibleOutcomes": [
      "APPROVED",
      "DEFECT FOUND",
      "REWORK",
      "REJECT UNIT"
    ],
    "exitCondition": "PDI approved and all critical defects closed.",
    "nextStage": "C3.1",
    "nextAction": "Confirm final payment readiness",
    "nextOwner": "ACCOUNTS",
    "defaultSla": "Before delivery",
    "escalationPath": "Delivery manager and branch head.",
    "exceptionPath": "Rework; reallocate; delivery reschedule.",
    "systemEvent": "pdi.approved"
  },
  {
    "code": "C3.1",
    "macro": "C3",
    "name": "Final Payment Clearance",
    "businessObjective": "Confirm no unauthorised financial dues remain.",
    "entryTrigger": "pdi.approved",
    "entryConditions": "PDI approved and final payable statement generated.",
    "currentOwner": "ACCOUNTS",
    "currentAction": "Reconcile all receipts, lender funds, refunds, discounts and pending dues.",
    "mandatoryValidation": "Invoice total; lender amount; customer payment; accessories; refunds; approved credit.",
    "mandatoryFields": [
      "lender",
      "payment_reference"
    ],
    "possibleOutcomes": [
      "CLEAR",
      "PENDING",
      "APPROVED EXCEPTION"
    ],
    "exitCondition": "Financial delivery clearance issued.",
    "nextStage": "C3.2",
    "nextAction": "Verify insurance and documents",
    "nextOwner": "DELIVERY TEAM",
    "defaultSla": "Same day",
    "escalationPath": "Accounts head / branch head.",
    "exceptionPath": "Payment recovery; approved exception; reschedule.",
    "systemEvent": "delivery.financially_cleared"
  },
  {
    "code": "C3.2",
    "macro": "C3",
    "name": "Insurance and Document Verification",
    "businessObjective": "Confirm all legal and customer documents are correct.",
    "entryTrigger": "delivery.financially_cleared",
    "entryConditions": "Financial clearance available.",
    "currentOwner": "DELIVERY TEAM",
    "currentAction": "Verify insurance, invoice, registration, finance, warranty and customer handover documents.",
    "mandatoryValidation": "Policy; invoice; RC/application; finance docs; warranty; manuals; customer KYC; receipts.",
    "mandatoryFields": [
      "policy_expiry",
      "finance_preference",
      "kyc_docs"
    ],
    "possibleOutcomes": [
      "COMPLETE",
      "MISSING",
      "CORRECTION REQUIRED"
    ],
    "exitCondition": "Document checklist passed.",
    "nextStage": "C3.3",
    "nextAction": "Confirm registration/HSRP readiness",
    "nextOwner": "DELIVERY TEAM",
    "defaultSla": "Same day",
    "escalationPath": "Registration manager.",
    "exceptionPath": "Correct/reprint; reschedule; approved exception.",
    "systemEvent": "delivery.documents_verified"
  },
  {
    "code": "C3.3",
    "macro": "C3",
    "name": "Registration Readiness",
    "businessObjective": "Confirm registration number, HSRP and statutory readiness.",
    "entryTrigger": "delivery.documents_verified",
    "entryConditions": "Document checklist complete.",
    "currentOwner": "DELIVERY / REGISTRATION TEAM",
    "currentAction": "Verify registration status, HSRP and any approved temporary-delivery conditions.",
    "mandatoryValidation": "Registration number; HSRP; permit where relevant; tax; statutory approvals.",
    "mandatoryFields": [
      "registration_number"
    ],
    "possibleOutcomes": [
      "READY",
      "PENDING APPROVED",
      "BLOCKED"
    ],
    "exitCondition": "Legal delivery status is acceptable.",
    "nextStage": "C3.4",
    "nextAction": "Confirm PDI and accessory readiness",
    "nextOwner": "DELIVERY TEAM",
    "defaultSla": "Same day",
    "escalationPath": "Branch head if legal block persists.",
    "exceptionPath": "Reschedule; statutory escalation.",
    "systemEvent": "delivery.registration_ready"
  },
  {
    "code": "C3.4",
    "macro": "C3",
    "name": "Vehicle and Accessory Readiness",
    "businessObjective": "Prepare the vehicle exactly as committed.",
    "entryTrigger": "delivery.registration_ready",
    "entryConditions": "Vehicle cleared legally and financially.",
    "currentOwner": "PDI / ACCESSORY / DELIVERY TEAM",
    "currentAction": "Verify cleanliness, fuel/charge, accessories, toolkit, documents and branding.",
    "mandatoryValidation": "PDI approval; accessories; body; fuel/charge; cleanliness; toolkit; key count; photos.",
    "mandatoryFields": [
      "pdi_status"
    ],
    "possibleOutcomes": [
      "READY",
      "REWORK",
      "MISSING ITEM"
    ],
    "exitCondition": "Vehicle preparation checklist complete.",
    "nextStage": "C3.5",
    "nextAction": "Schedule delivery appointment",
    "nextOwner": "DELIVERY EXECUTIVE",
    "defaultSla": "Before appointment",
    "escalationPath": "Delivery manager.",
    "exceptionPath": "Rework; procure missing item; reschedule.",
    "systemEvent": "vehicle.delivery_ready"
  },
  {
    "code": "C3.5",
    "macro": "C3",
    "name": "Delivery Appointment",
    "businessObjective": "Confirm date, time, location and participants.",
    "entryTrigger": "vehicle.delivery_ready",
    "entryConditions": "Vehicle and documentation ready.",
    "currentOwner": "DELIVERY EXECUTIVE",
    "currentAction": "Schedule appointment, send reminders and coordinate customer/family/fleet stakeholders.",
    "mandatoryValidation": "Date/time; location; contact; attendees; ceremony preference; training requirement.",
    "mandatoryFields": [
      "location"
    ],
    "possibleOutcomes": [
      "CONFIRMED",
      "RESCHEDULED",
      "CANCELLED",
      "NO SHOW"
    ],
    "exitCondition": "Confirmed delivery slot exists.",
    "nextStage": "C3.6",
    "nextAction": "Complete vehicle handover",
    "nextOwner": "DELIVERY EXECUTIVE",
    "defaultSla": "Selected slot",
    "escalationPath": "Delivery manager for missed slot.",
    "exceptionPath": "Reschedule; cancellation review.",
    "systemEvent": "delivery.appointment_confirmed"
  },
  {
    "code": "C3.6",
    "macro": "C3",
    "name": "Vehicle Delivery",
    "businessObjective": "Complete compliant handover and proof of delivery.",
    "entryTrigger": "delivery.appointment_confirmed",
    "entryConditions": "Customer present; all blocking controls passed.",
    "currentOwner": "DELIVERY EXECUTIVE",
    "currentAction": "Verify identity, demonstrate product, obtain signatures/photos and hand over keys/documents.",
    "mandatoryValidation": "Customer OTP/signature; handover checklist; training; odometer; photos; documents; key count.",
    "mandatoryFields": [
      "customer_otp"
    ],
    "possibleOutcomes": [
      "DELIVERED",
      "PARTIAL/HOLD",
      "CUSTOMER REFUSED"
    ],
    "exitCondition": "Proof of delivery complete and customer_vehicle record activated.",
    "nextStage": "C3.7",
    "nextAction": "Collect feedback and activate lifecycle",
    "nextOwner": "CRM TEAM / SYSTEM",
    "defaultSla": "Immediate",
    "escalationPath": "Delivery manager for incomplete proof.",
    "exceptionPath": "Hold delivery closure; rectify issue.",
    "systemEvent": "delivery.done"
  },
  {
    "code": "C3.7",
    "macro": "C3",
    "name": "Delivery Feedback",
    "businessObjective": "Measure experience and identify immediate recovery needs.",
    "entryTrigger": "delivery.done",
    "entryConditions": "Delivery record complete.",
    "currentOwner": "CRM TEAM / BOT",
    "currentAction": "Send feedback, NPS/rating and complaint capture.",
    "mandatoryValidation": "Rating; NPS; remarks; issue category; consent for testimonial.",
    "mandatoryFields": [
      "feedback_rating",
      "nps_rating",
      "consent_status"
    ],
    "possibleOutcomes": [
      "POSITIVE",
      "NEUTRAL",
      "NEGATIVE",
      "COMPLAINT"
    ],
    "exitCondition": "Feedback captured or reminder schedule created.",
    "nextStage": "C3.8/C3.9/L1",
    "nextAction": "Testimonial, referral or lifecycle/service route",
    "nextOwner": "CRM TEAM",
    "defaultSla": "Day 1–3",
    "escalationPath": "CRM manager for detractor.",
    "exceptionPath": "Complaint recovery before advocacy ask.",
    "systemEvent": "delivery.feedback_captured"
  },
  {
    "code": "C3.8",
    "macro": "C3",
    "name": "Testimonial / Advocacy",
    "businessObjective": "Convert satisfied customers into approved advocates.",
    "entryTrigger": "delivery.feedback_captured",
    "entryConditions": "Positive rating and marketing consent available.",
    "currentOwner": "CRM / MARKETING TEAM",
    "currentAction": "Request text/video testimonial and advocacy permission.",
    "mandatoryValidation": "Consent; testimonial; media file; product; branch; usage rights.",
    "mandatoryFields": [
      "consent_status",
      "product",
      "branch",
      "usage"
    ],
    "possibleOutcomes": [
      "SUBMITTED",
      "DECLINED",
      "PENDING"
    ],
    "exitCondition": "Approved testimonial saved or customer declined.",
    "nextStage": "C3.9 or L1",
    "nextAction": "Request referral or start lifecycle",
    "nextOwner": "CRM TEAM",
    "defaultSla": "Within 7 days",
    "escalationPath": "Marketing manager if campaign rule fails.",
    "exceptionPath": "Skip advocacy; lifecycle only.",
    "systemEvent": "customer.advocacy_outcome"
  },
  {
    "code": "C3.9",
    "macro": "C3",
    "name": "Referral Activation",
    "businessObjective": "Generate and track customer referral opportunity.",
    "entryTrigger": "customer.advocacy_outcome",
    "entryConditions": "Referral campaign active and customer eligible.",
    "currentOwner": "CRM / REFERRAL ENGINE",
    "currentAction": "Generate code/link, capture referred contacts and track reward eligibility.",
    "mandatoryValidation": "Customer; code; link; referred name/mobile; consent; campaign; reward rules.",
    "mandatoryFields": [
      "mobile",
      "consent_status"
    ],
    "possibleOutcomes": [
      "REFERRAL SUBMITTED",
      "SHARED",
      "DECLINED",
      "NO RESPONSE"
    ],
    "exitCondition": "Referral record or declined/no-response outcome saved.",
    "nextStage": "L1",
    "nextAction": "Activate lifecycle schedules",
    "nextOwner": "SYSTEM / CRM",
    "defaultSla": "Within 7 days",
    "escalationPath": "CRM manager if eligible customer not activated.",
    "exceptionPath": "Lifecycle only; future referral campaign.",
    "systemEvent": "referral.outcome_recorded"
  },
  {
    "code": "L1",
    "macro": "Lifecycle",
    "name": "Service Reminder",
    "businessObjective": "Drive first and recurring service retention.",
    "entryTrigger": "lifecycle.activated or service.due",
    "entryConditions": "Delivered vehicle active and service schedule available.",
    "currentOwner": "SERVICE CRM / BOT",
    "currentAction": "Send service reminder, enable booking and route response.",
    "mandatoryValidation": "Vehicle; service due date/km; branch; contact preference; slot availability.",
    "mandatoryFields": [
      "service_due_date",
      "branch"
    ],
    "possibleOutcomes": [
      "BOOKED",
      "REMINDER SENT",
      "DECLINED",
      "NOT REACHABLE"
    ],
    "exitCondition": "Service booking or next reminder scheduled.",
    "nextStage": "L2 or remain L1",
    "nextAction": "Service booking/follow-up",
    "nextOwner": "SERVICE TEAM",
    "defaultSla": "As service policy",
    "escalationPath": "Service manager for missed first service.",
    "exceptionPath": "Escalated reminder; alternate workshop.",
    "systemEvent": "service.reminder_processed"
  },
  {
    "code": "L2",
    "macro": "Lifecycle",
    "name": "Insurance Renewal",
    "businessObjective": "Retain renewal and protect customer relationship.",
    "entryTrigger": "insurance.renewal_due",
    "entryConditions": "Policy expiry window reached and consent valid.",
    "currentOwner": "INSURANCE CRM",
    "currentAction": "Send quote/reminder, capture interest and complete renewal.",
    "mandatoryValidation": "Policy; expiry; vehicle; insurer; premium; claim history where available.",
    "mandatoryFields": [
      "policy_expiry"
    ],
    "possibleOutcomes": [
      "RENEWED",
      "INTERESTED",
      "DECLINED",
      "LOST"
    ],
    "exitCondition": "Renewal outcome recorded.",
    "nextStage": "L3 or remain L2",
    "nextAction": "AMC/retention action or follow-up",
    "nextOwner": "INSURANCE TEAM",
    "defaultSla": "30/15/7 days before expiry",
    "escalationPath": "Insurance manager.",
    "exceptionPath": "Alternate insurer; nurture.",
    "systemEvent": "insurance.renewal_outcome"
  },
  {
    "code": "L3",
    "macro": "Lifecycle",
    "name": "AMC / Warranty / Retention",
    "businessObjective": "Sell maintenance and protection products.",
    "entryTrigger": "lifecycle.eligibility_event",
    "entryConditions": "Vehicle/customer eligible by age, service or product rule.",
    "currentOwner": "SERVICE / CRM TEAM",
    "currentAction": "Offer AMC, warranty or protection product and track conversion.",
    "mandatoryValidation": "Vehicle age; service history; eligible product; price; consent.",
    "mandatoryFields": [
      "product",
      "consent_status"
    ],
    "possibleOutcomes": [
      "PURCHASED",
      "INTERESTED",
      "DECLINED"
    ],
    "exitCondition": "Outcome and next eligible date stored.",
    "nextStage": "L4",
    "nextAction": "Evaluate upgrade/exchange",
    "nextOwner": "CRM TEAM",
    "defaultSla": "As campaign SLA",
    "escalationPath": "CRM manager.",
    "exceptionPath": "Future campaign.",
    "systemEvent": "lifecycle.retention_outcome"
  },
  {
    "code": "L4",
    "macro": "Lifecycle",
    "name": "Upgrade / Exchange",
    "businessObjective": "Identify replacement, upgrade or additional-vehicle opportunity.",
    "entryTrigger": "upgrade.eligible",
    "entryConditions": "Vehicle age/usage, customer behaviour or campaign rule meets threshold.",
    "currentOwner": "SALES CRM / EXCHANGE TEAM",
    "currentAction": "Estimate upgrade need, exchange value and new product fit.",
    "mandatoryValidation": "Vehicle age; usage; service history; exchange estimate; new need; finance.",
    "mandatoryFields": [
      "usage",
      "exchange",
      "finance_preference"
    ],
    "possibleOutcomes": [
      "NEW OPPORTUNITY",
      "NURTURE",
      "DECLINED"
    ],
    "exitCondition": "New opportunity created or future date scheduled.",
    "nextStage": "C0.6 or L5",
    "nextAction": "Start new sales discovery or repeat/referral route",
    "nextOwner": "SALES EXECUTIVE",
    "defaultSla": "Same day after interest",
    "escalationPath": "Sales manager for high-value fleet/customer.",
    "exceptionPath": "Nurture; future upgrade.",
    "systemEvent": "upgrade.outcome_recorded"
  },
  {
    "code": "L5",
    "macro": "Lifecycle",
    "name": "Repeat Sale / Referral Revenue",
    "businessObjective": "Create repeat, cross-sell, fleet or referral revenue.",
    "entryTrigger": "repeat_or_referral_signal",
    "entryConditions": "Valid customer relationship and eligible signal exist.",
    "currentOwner": "CRM / SALES TEAM",
    "currentAction": "Create linked opportunity with inherited customer context.",
    "mandatoryValidation": "Customer 360; prior vehicle; relationship; referral source; new product interest.",
    "mandatoryFields": [
      "source",
      "product"
    ],
    "possibleOutcomes": [
      "OPPORTUNITY CREATED",
      "NURTURE",
      "CLOSED"
    ],
    "exitCondition": "New opportunity ID created or future action scheduled.",
    "nextStage": "C0.6 or L1",
    "nextAction": "Run discovery for linked opportunity or continue lifecycle",
    "nextOwner": "SALES EXECUTIVE / CRM",
    "defaultSla": "Same day",
    "escalationPath": "CRM manager.",
    "exceptionPath": "Continue lifecycle.",
    "systemEvent": "lifecycle.revenue_opportunity_created"
  }
];

export const STAGE_MASTER_BY_CODE = Object.fromEntries(STAGE_MASTER.map((r) => [r.code, r]));

export const getStageMaster = (code) => STAGE_MASTER_BY_CODE[code];

export const parseSlaToMinutes = (sla = '') => {
  const t = String(sla).trim().toLowerCase();
  if (!t) return null;
  const m = t.match(/(\d+(?:\.\d+)?)\s*(minute|min|hour|hr|day|second|sec)/);
  if (!m) {
    if (t.includes('same day')) return 8 * 60;
    if (t.includes('real time') || t.includes('instant')) return 1;
    return null;
  }
  const n = Number(m[1]);
  const u = m[2];
  if (u.startsWith('sec')) return Math.max(1, Math.ceil(n / 60));
  if (u.startsWith('min')) return n;
  if (u.startsWith('hour') || u.startsWith('hr')) return n * 60;
  if (u.startsWith('day')) return n * 24 * 60;
  return null;
};
