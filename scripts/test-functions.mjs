import assert from 'node:assert/strict';
import {onRequestPost as saveDemandSurvey} from '../functions/api/demand-survey.js';
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
    if (this.query.includes('WHERE email')) {
      return this.database.existingLead ? {id: 'existing'} : null;
    }
    if (this.query.includes('WHERE id')) {
      return this.database.leadExists ? {id: this.values[0]} : null;
    }
    return null;
  }

  async run() {
    this.database.writes.push({query: this.query, values: this.values});
    return {success: true};
  }
}

class MockDatabase {
  constructor({existingLead = false, leadExists = true} = {}) {
    this.existingLead = existingLead;
    this.leadExists = leadExists;
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
assert.equal(typeof waitlistResult.body.leadId, 'string');
assert.equal(waitlistDb.writes.length, 1);
assert.equal(waitlistDb.writes[0].values[2], 'tal@example.com');

const duplicateDb = new MockDatabase({existingLead: true});
const duplicateResult = await responseBody(await joinWaitlist({
  request: post('/api/waitlist', {name: 'טל ישראלי', email: 'tal@example.com', consent: true}),
  env: {DB: duplicateDb}
}));
assert.equal(duplicateResult.status, 200);
assert.equal(duplicateResult.body.alreadyRegistered, true);
assert.equal(duplicateResult.body.leadId, 'existing');

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

const surveyOpenDb = new MockDatabase();
const surveyOpenResult = await responseBody(await saveDemandSurvey({
  request: post('/api/demand-survey', {action: 'open', leadId: 'lead-123'}),
  env: {DB: surveyOpenDb}
}));
assert.equal(surveyOpenResult.status, 201);
assert.equal(surveyOpenResult.body.ok, true);
assert.equal(surveyOpenDb.writes.some(write => write.query.includes('demand_validation_responses')), true);

const surveySubmitDb = new MockDatabase();
const surveySubmitResult = await responseBody(await saveDemandSurvey({
  request: post('/api/demand-survey', {
    action: 'submit',
    leadId: 'lead-123',
    subscriptionCount: '3_5',
    painFrequency: 'monthly',
    willingnessToPay: 'yes_990'
  }),
  env: {DB: surveySubmitDb}
}));
assert.equal(surveySubmitResult.status, 200);
assert.equal(surveySubmitResult.body.ok, true);
assert.equal(surveySubmitDb.writes.at(-1).values[1], '3_5');
assert.equal(surveySubmitDb.writes.at(-1).values[3], 'yes_990');

const invalidSurveyResult = await responseBody(await saveDemandSurvey({
  request: post('/api/demand-survey', {
    action: 'submit',
    leadId: 'lead-123',
    subscriptionCount: '99',
    painFrequency: 'monthly',
    willingnessToPay: 'yes_990'
  }),
  env: {DB: new MockDatabase()}
}));
assert.equal(invalidSurveyResult.status, 400);

const unknownLeadResult = await responseBody(await saveDemandSurvey({
  request: post('/api/demand-survey', {action: 'open', leadId: 'missing'}),
  env: {DB: new MockDatabase({leadExists: false})}
}));
assert.equal(unknownLeadResult.status, 404);

console.log('Cloudflare Pages Function tests passed');
