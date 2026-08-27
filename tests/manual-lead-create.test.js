import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isValidMobile, normalizeMobile } from '../src/helpers/mobile.js';

describe('manual lead create validation', () => {
  it('accepts valid Indian mobiles', () => {
    assert.equal(isValidMobile('9876543210'), true);
    assert.equal(normalizeMobile('+91 9876543210'), '9876543210');
  });

  it('rejects invalid mobiles', () => {
    assert.equal(isValidMobile('12345'), false);
    assert.equal(isValidMobile(''), false);
  });
});
