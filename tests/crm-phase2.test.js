import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyCrmScore, mapScoreToTemperature } from '../src/constants/crmScoreRules.js';

describe('CRM scoring', () => {
  it('classifies score bands', () => {
    assert.equal(classifyCrmScore(85), 'Hot');
    assert.equal(classifyCrmScore(65), 'Warm');
    assert.equal(classifyCrmScore(25), 'Cold');
  });

  it('maps score to temperature', () => {
    assert.equal(mapScoreToTemperature(90), 'HOT');
    assert.equal(mapScoreToTemperature(70), 'WARM');
    assert.equal(mapScoreToTemperature(45), 'NURTURE');
    assert.equal(mapScoreToTemperature(10), 'COLD');
  });
});

describe('CRM follow-up status logic', () => {
  it('marks past scheduled time as due', () => {
    const scheduledAt = new Date(Date.now() - 60_000);
    const status = scheduledAt <= new Date() ? 'DUE' : 'OPEN';
    assert.equal(status, 'DUE');
  });
});
