import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLead } from '../server/lead-server.mjs';

test('accepts and normalizes a valid Russian phone', () => {
  assert.deepEqual(validateLead({ name: 'Иван', phone: '+7 (999) 123-45-67' }), {
    name: 'Иван', phone: '+79991234567', city: '', volume: '', product: '', form: '', page: '', requestId: '', utm: {},
  });
});

test('rejects invalid submissions', () => {
  assert.equal(validateLead({ name: 'A', phone: '+7 999 123-45-67' }), null);
  assert.equal(validateLead({ name: 'Иван', phone: '123' }), null);
  assert.equal(validateLead(null), null);
});
