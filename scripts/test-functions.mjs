import assert from 'node:assert/strict';
import {onRequestPost as recordEvent} from '../functions/api/event.js';
import {onRequestPost as joinWaitlist} from '../functions/api/waitlist.js';

class MockStatement {
  constructor(database, query) {
    this.database = database;
    this.query = query;
    this.values = [];
  }

  bind(...values) {
    this.values = values;
    return this;
  }

  async first() {
    return this.database.existingLead ? {id: 'existing'} : null;
  }

  async run() {
    this.database.writes.push({query: this.query, values: this.values});
    return {success: true};
  }
}

class MockDatabase {
  constructor({existingLead = false} = {}) {
    this.existingLead = existingLead;
    this.writes = [];
  }

  prepare(query) {
    return new MockStatement(this, query);
  }
}

function post(path, body, {origin = 'https://subsaver.pages.dev'} = {}) {
  return new Request(`https://subsaver.pages.dev${path}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', Origin: origin},
    body: JSON.stringify(body)
  });
}

async function responseBody(response) {
  return {status: response.status, body: await response.json()};
}

const waitlistDb = new MockDatabase();
const waitlistResult = await responseBody(await joinWaitlist({
  request: post('/api/waitlist', {name: 'טל ישראלי', email: 'Tal@Example.com', consent: true}),
  env: {DB: waitlistDb}
}));
assert.equal(waitlistResult.status, 200);
assert.equal(waitlistResult.body.ok, true);
assert.equal(waitlistResult.body.alreadyRegistered, false);
assert.equal(waitlistDb.writes.length, 1);
assert.equal(waitlistDb.writes[0].values[2], 'tal@example.com');

const duplicateDb = new MockDatabase({existingLead: true});
const duplicateResult = await responseBody(await joinWaitlist({
  request: post('/api/waitlist', {name: 'טל ישראלי', email: 'tal@example.com', consent: true}),
  env: {DB: duplicateDb}
}));
assert.equal(duplicateResult.status, 200);
assert.equal(duplicateResult.body.alreadyRegistered, true);

const invalidResult = await responseBody(await joinWaitlist({
  request: post('/api/waitlist', {name: 'טל ישראלי', email: 'invalid', consent: true}),
  env: {DB: new MockDatabase()}
}));
assert.equal(invalidResult.status, 400);

const blockedOriginResult = await responseBody(await joinWaitlist({
  request: post('/api/waitlist', {name: 'טל ישראלי', email: 'tal@example.com', consent: true}, {origin: 'https://example.org'}),
  env: {DB: new MockDatabase()}
}));
assert.equal(blockedOriginResult.status, 403);

const eventDb = new MockDatabase();
const eventResult = await responseBody(await recordEvent({
  request: post('/api/event', {event: 'page_view', properties: {session_id: 'test-session', path: '/'}}),
  env: {DB: eventDb}
}));
assert.equal(eventResult.status, 201);
assert.equal(eventDb.writes.length, 1);

const invalidEventResult = await responseBody(await recordEvent({
  request: post('/api/event', {event: 'unknown'}),
  env: {DB: new MockDatabase()}
}));
assert.equal(invalidEventResult.status, 400);

console.log('Cloudflare Pages Function tests passed');
