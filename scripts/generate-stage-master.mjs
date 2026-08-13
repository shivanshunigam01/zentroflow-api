/**
 * Generates src/constants/stageMaster.js + automationRules.js from the Excel SSOT
 * (or from frontend stage-master if Excel missing).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const excelCandidates = [
  path.join(process.env.USERPROFILE || '', 'Downloads', 'ZentroFlow_Consolidated_Developer_Specification (1).xlsx'),
  path.join(process.env.HOME || '', 'Downloads', 'ZentroFlow_Consolidated_Developer_Specification (1).xlsx'),
];

function parseMandatory(text) {
  if (!text) return [];
  const parts = String(text).split(/[;,]|\band\b/i);
  const keys = [];
  const mapping = [
    ['taxes/registration', 'taxes_registration'],
    ['mobile', 'mobile'],
    ['source', 'source'],
    ['branch', 'branch'],
    ['territory', 'territory'],
    ['product', 'product'],
    ['consent', 'consent_status'],
    ['variant', 'variant'],
    ['quantity', 'quantity'],
    ['budget', 'budget'],
    ['timeline', 'purchase_timeline'],
    ['finance', 'finance_preference'],
    ['decision maker', 'decision_maker'],
    ['location', 'location'],
    ['exchange', 'exchange'],
    ['competition', 'competition'],
    ['quotation', 'quotation_id'],
    ['quote', 'quotation_id'],
    ['disposition', 'call_disposition'],
    ['whatsapp', 'whatsapp_status'],
    ['dnd', 'dnd_status'],
    ['usage', 'usage'],
    ['route', 'route'],
    ['load', 'load'],
    ['colour', 'colour'],
    ['color', 'colour'],
    ['chassis', 'chassis'],
    ['payment', 'payment_reference'],
    ['insurance', 'insurance_policy'],
    ['registration', 'registration_number'],
    ['pdi', 'pdi_status'],
    ['kyc', 'kyc_docs'],
    ['income', 'income_type'],
    ['lender', 'lender'],
    ['booking amount', 'booking_amount'],
    ['sanction', 'sanction_amount'],
    ['margin', 'margin'],
    ['down payment', 'down_payment'],
    ['delivery', 'delivery_proof'],
    ['otp', 'customer_otp'],
    ['signature', 'customer_signature'],
    ['nps', 'nps_rating'],
    ['rating', 'feedback_rating'],
    ['service due', 'service_due_date'],
    ['policy', 'policy_expiry'],
  ];
  for (const p of parts) {
    const s = p.trim().toLowerCase();
    if (s.length < 3) continue;
    for (const [needle, key] of mapping) {
      if (s.includes(needle) && !keys.includes(key)) {
        keys.push(key);
        break;
      }
    }
  }
  return keys;
}

async function fromExcel(excelPath) {
  const { default: openpyxl } = await import('xlsx');
  const wb = openpyxl.readFile(excelPath);
  const stageSheet = wb.Sheets['02 Stage Master'];
  const ruleSheet = wb.Sheets['03 Rule Engine'];
  // Row 4 (1-based) is the header row in the consolidated workbook
  const stageRows = openpyxl.utils.sheet_to_json(stageSheet, { defval: '', range: 3 });
  const ruleRows = openpyxl.utils.sheet_to_json(ruleSheet, { defval: '', range: 3 });

  const stages = stageRows
    .filter((r) => r['Stage Code'])
    .map((r) => {
      const code = String(r['Stage Code']);
      let fields = parseMandatory(r['Mandatory Data / Validation']);
      if (code === 'C0.10') {
        for (const f of ['variant', 'budget', 'purchase_timeline', 'decision_maker', 'finance_preference']) {
          if (!fields.includes(f)) fields.push(f);
        }
      }
      return {
        code,
        macro: String(r['Macro Stage'] || ''),
        name: String(r['Stage Name'] || ''),
        businessObjective: String(r['Business Objective'] || ''),
        entryTrigger: String(r['Entry Trigger'] || ''),
        entryConditions: String(r['Entry Conditions'] || ''),
        currentOwner: String(r['Current Owner'] || ''),
        currentAction: String(r['Current Action'] || ''),
        mandatoryValidation: String(r['Mandatory Data / Validation'] || ''),
        mandatoryFields: fields,
        possibleOutcomes: String(r['Possible Outcomes'] || '')
          .split(';')
          .map((x) => x.trim())
          .filter(Boolean),
        exitCondition: String(r['Exit Condition'] || ''),
        nextStage: String(r['Next Stage'] || ''),
        nextAction: String(r['Next Action'] || ''),
        nextOwner: String(r['Next Owner'] || ''),
        defaultSla: String(r['Default SLA'] || ''),
        escalationPath: String(r['Escalation Path'] || ''),
        exceptionPath: String(r['Exception / Alternate Path'] || ''),
        systemEvent: String(r['System Event'] || ''),
      };
    });

  const rules = ruleRows
    .filter((r) => r['Rule Code'])
    .map((r) => ({
      ruleCode: String(r['Rule Code']),
      name: String(r['Rule Name'] || ''),
      ruleType: String(r['Rule Type'] || 'EVENT'),
      triggerEvent: String(r['Trigger Event'] || ''),
      scope: String(r['Scope'] || ''),
      conditionGroup: String(r['Condition Group'] || 'ALL'),
      field: String(r['Field'] || ''),
      operator: String(r['Operator'] || 'EQUALS'),
      expectedValue: String(r['Expected Value'] || ''),
      actionType: String(r['Action Type'] || ''),
      actionOwnerLogic: String(r['Action Owner Logic'] || ''),
      priority: String(r['Priority'] || 'P2'),
      slaMinutes: Number(r['SLA Minutes'] || 60),
      escalationLogic: String(r['Escalation Logic'] || ''),
      exitCondition: String(r['Exit Condition'] || ''),
      nextStage: String(r['Next Stage'] || ''),
      status: String(r['Rule Status'] || 'ACTIVE'),
      version: 1,
    }));

  return { stages, rules };
}

function writeOutputs(stages, rules) {
  const stageOut = `/** Auto-generated Stage Master SSOT — Consolidated Developer Spec sheet 02 */\nexport const STAGE_MASTER = ${JSON.stringify(stages, null, 2)};\n\nexport const STAGE_MASTER_BY_CODE = Object.fromEntries(STAGE_MASTER.map((r) => [r.code, r]));\n\nexport const getStageMaster = (code) => STAGE_MASTER_BY_CODE[code];\n\nexport const parseSlaToMinutes = (sla = '') => {\n  const t = String(sla).trim().toLowerCase();\n  if (!t) return null;\n  const m = t.match(/(\\d+(?:\\.\\d+)?)\\s*(minute|min|hour|hr|day|second|sec)/);\n  if (!m) {\n    if (t.includes('same day')) return 8 * 60;\n    if (t.includes('real time') || t.includes('instant')) return 1;\n    return null;\n  }\n  const n = Number(m[1]);\n  const u = m[2];\n  if (u.startsWith('sec')) return Math.max(1, Math.ceil(n / 60));\n  if (u.startsWith('min')) return n;\n  if (u.startsWith('hour') || u.startsWith('hr')) return n * 60;\n  if (u.startsWith('day')) return n * 24 * 60;\n  return null;\n};\n`;

  const rulesOut = `/** Auto-generated Rule Engine seeds — Consolidated Developer Spec sheet 03 */\nexport const AUTOMATION_RULE_SEEDS = ${JSON.stringify(rules, null, 2)};\n\nexport const getActiveAutomationRules = () => AUTOMATION_RULE_SEEDS.filter((r) => r.status === 'ACTIVE');\n\nexport const getAutomationRule = (code) => AUTOMATION_RULE_SEEDS.find((r) => r.ruleCode === code);\n`;

  fs.writeFileSync(path.join(root, 'src/constants/stageMaster.js'), stageOut);
  fs.writeFileSync(path.join(root, 'src/constants/automationRules.js'), rulesOut);
  console.log(`Wrote ${stages.length} stages, ${rules.length} rules`);
}

const excel = excelCandidates.find((p) => p && fs.existsSync(p));
if (!excel) {
  console.error('Excel SSOT not found in Downloads. Place ZentroFlow_Consolidated_Developer_Specification (1).xlsx there.');
  process.exit(1);
}

const { stages, rules } = await fromExcel(excel);
writeOutputs(stages, rules);
