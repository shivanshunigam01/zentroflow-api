import DomainEvent from '../models/DomainEvent.js';

export const publishEvent = async ({ type, opportunity_id, customer_id, payload = {}, correlation_id }) => DomainEvent.create({ type, opportunity_id, customer_id, payload, correlation_id });
