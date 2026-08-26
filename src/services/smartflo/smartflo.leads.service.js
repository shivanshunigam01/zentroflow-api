import { env } from '../../config/env.js';
import { isValidMobile, normalizeMobile } from '../../helpers/mobile.js';
import { ApiError } from '../../middleware/errorHandler.middleware.js';
import Customer from '../../models/Customer.js';
import Opportunity from '../../models/Opportunity.js';
import { smartfloGet, smartfloPost, smartfloPut } from './smartflo.client.js';
import { asArray, firstString } from './smartflo.helpers.js';

const listId = () => {
  const id = env.SMARTFLO_LEAD_LIST_ID?.trim();
  if (!id) throw new ApiError(503, 'SMARTFLO_NOT_CONFIGURED', 'Smartflo lead list is not configured');
  return id;
};

/**
 * Map a ZentroFLOW opportunity + customer to Smartflo broadcast fields.
 * field_0 phone, field_1 name, field_2 email, field_3 address, field_4 branch, field_5 opportunity_id
 */
export const mapZentroflowToSmartfloLead = (opportunity, customer) => {
  const phone = normalizeMobile(customer?.mobile || customer?.mobile_normalized || '');
  if (!phone || !isValidMobile(phone)) {
    throw new ApiError(400, 'INVALID_LEAD', 'Lead phone number is invalid', 'mobile');
  }
  const row = {
    field_0: phone,
    field_1: String(customer?.name || 'Lead').trim(),
    field_5: opportunity.opportunity_id,
  };
  const email = customer?.email?.trim();
  if (email) row.field_2 = email;
  const address = customer?.address?.trim();
  if (address) row.field_3 = address;
  const company = opportunity.branch?.trim();
  if (company) row.field_4 = company;
  return row;
};

export const extractSmartfloLeadId = (response) => firstString(
  response?.lead_id,
  response?.id,
  response?.data?.lead_id,
  response?.data?.id,
  response?.data?.[0]?.lead_id,
  response?.data?.[0]?.id,
);

export const fetchLeadLists = async () => {
  const data = await smartfloGet('/broadcast/lists', undefined, 'listLeadLists');
  return asArray(data);
};

export const fetchLeadsInList = async (id = listId()) => {
  const data = await smartfloGet(`/broadcast/leads/${encodeURIComponent(id)}`, undefined, 'listLeads');
  return asArray(data);
};

export const uploadSingleSmartfloLead = async (row, id = listId()) => {
  return smartfloPost(
    `/broadcast/lead/${encodeURIComponent(id)}`,
    { ...row, duplicate_option: 'skip', priority: 1 },
    'uploadSingleLead',
  );
};

export const uploadBulkSmartfloLeads = async (rows, id = listId()) => {
  return smartfloPost(
    `/broadcast/leads/${encodeURIComponent(id)}`,
    { data: rows, duplicate_option: 'skip' },
    'uploadBulkLeads',
  );
};

export const updateSmartfloLead = async (smartfloLeadId, row, id = listId()) => {
  return smartfloPut(
    `/broadcast/lead/${encodeURIComponent(id)}`,
    { id: smartfloLeadId, ...row, duplicate_option: 'skip' },
    'updateLead',
  );
};

const findRemoteLead = (leads, opportunity, customer) => {
  const phone = normalizeMobile(customer?.mobile || '');
  const oppId = opportunity.opportunity_id;
  return leads.find((row) => {
    const field0 = normalizeMobile(row.field_0 || row.phone || row.number || '');
    const field5 = String(row.field_5 || row.ref_id || '');
    const remoteId = String(row.id || row.lead_id || '');
    if (opportunity.smartflo_lead_id && remoteId && remoteId === String(opportunity.smartflo_lead_id)) return true;
    if (field5 && field5 === oppId) return true;
    if (phone && field0 && field0 === phone) return true;
    return false;
  }) || null;
};

export const findOpportunityByDialerId = (id) => Opportunity.findOne({
  $or: [{ opportunity_id: id }, { lead_id: id }],
});

const markFailed = async (opportunity, message) => {
  opportunity.smartflo_sync_status = 'FAILED';
  opportunity.smartflo_sync_error = String(message || 'Unable to synchronize lead with Smartflo').slice(0, 280);
  opportunity.smartflo_retry_count = (opportunity.smartflo_retry_count || 0) + 1;
  await opportunity.save();
};

/**
 * Upload one ZentroFLOW opportunity to the configured Smartflo list.
 */
export const syncOpportunityToSmartflo = async (opportunityId) => {
  const opportunity = await findOpportunityByDialerId(opportunityId);
  if (!opportunity) throw new ApiError(404, 'LEAD_NOT_FOUND', 'ZentroFLOW lead not found');

  const customer = await Customer.findOne({ customer_id: opportunity.customer_id });
  if (!customer) throw new ApiError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found for this lead');

  const targetList = listId();
  let row;
  try {
    row = mapZentroflowToSmartfloLead(opportunity, customer);
  } catch (err) {
    await markFailed(opportunity, err.message);
    throw err;
  }

  try {
    const response = await uploadSingleSmartfloLead(row, targetList);
    let remoteId = extractSmartfloLeadId(response);
    if (!remoteId) {
      const remoteLeads = await fetchLeadsInList(targetList).catch(() => []);
      const match = findRemoteLead(remoteLeads, opportunity, customer);
      remoteId = firstString(match?.id, match?.lead_id);
    }

    opportunity.smartflo_lead_id = remoteId || opportunity.smartflo_lead_id || null;
    opportunity.smartflo_lead_list_id = targetList;
    opportunity.smartflo_sync_status = 'SYNCED';
    opportunity.smartflo_sync_error = null;
    opportunity.smartflo_last_synced_at = new Date();
    if (!opportunity.smartflo_dial_status) opportunity.smartflo_dial_status = 'READY';
    await opportunity.save();

    console.log(JSON.stringify({
      service: 'smartflo',
      operation: 'syncLead',
      leadId: opportunity.opportunity_id,
      smartfloListId: targetList,
      status: 'success',
    }));

    return {
      opportunity_id: opportunity.opportunity_id,
      lead_id: opportunity.lead_id,
      smartflo_lead_id: opportunity.smartflo_lead_id,
      smartflo_lead_list_id: targetList,
      smartflo_sync_status: 'SYNCED',
      result: 'synced',
    };
  } catch (err) {
    await markFailed(opportunity, err.message);
    console.log(JSON.stringify({
      service: 'smartflo',
      operation: 'syncLead',
      leadId: opportunity.opportunity_id,
      smartfloListId: targetList,
      status: 'failed',
      code: err.code,
    }));
    throw new ApiError(
      err.status || 502,
      err.code || 'SMARTFLO_LEAD_SYNC_FAILED',
      'Unable to synchronize lead with Smartflo',
    );
  }
};

export const syncPendingLeads = async (limit = 100) => {
  const pending = await Opportunity.find({
    $or: [
      { smartflo_sync_status: { $in: [null, 'PENDING', 'FAILED'] } },
      { smartflo_sync_status: { $exists: false } },
    ],
  }).limit(Math.min(Number(limit) || 100, 500));

  const results = [];
  for (const opp of pending) {
    try {
      results.push(await syncOpportunityToSmartflo(opp.opportunity_id));
    } catch (err) {
      results.push({
        opportunity_id: opp.opportunity_id,
        smartflo_sync_status: 'FAILED',
        error: err.message,
      });
    }
  }
  return { total: pending.length, results };
};

export const syncSelectedLeads = async (ids = []) => {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'leadIds is required');
  }
  const results = [];
  for (const id of ids) {
    try {
      results.push(await syncOpportunityToSmartflo(id));
    } catch (err) {
      results.push({ opportunity_id: id, smartflo_sync_status: 'FAILED', error: err.message });
    }
  }
  return { total: ids.length, results };
};

export const compareLocalAndRemoteLead = async (opportunityId) => {
  const opportunity = await findOpportunityByDialerId(opportunityId);
  if (!opportunity) throw new ApiError(404, 'LEAD_NOT_FOUND', 'ZentroFLOW lead not found');
  const customer = await Customer.findOne({ customer_id: opportunity.customer_id }).lean();
  const remoteLeads = await fetchLeadsInList();
  const match = findRemoteLead(remoteLeads, opportunity, customer);
  return {
    local: {
      opportunity_id: opportunity.opportunity_id,
      lead_id: opportunity.lead_id,
      smartflo_lead_id: opportunity.smartflo_lead_id,
      smartflo_sync_status: opportunity.smartflo_sync_status,
      smartflo_dial_status: opportunity.smartflo_dial_status,
      smartflo_disposition: opportunity.smartflo_disposition,
    },
    remote: match ? {
      id: firstString(match.id, match.lead_id),
      field_0: match.field_0 ?? null,
      field_1: match.field_1 ?? null,
      status: firstString(match.status, match.dial_status, match.lead_status),
    } : null,
    matched: Boolean(match),
  };
};
