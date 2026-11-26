const test = require('node:test');
const assert = require('node:assert/strict');
const { validateEnv } = require('../lib/env');

const goodSecret = 'a'.repeat(16) + 'b'.repeat(16) + 'c'.repeat(16);
// Built in pieces so secret scanners do not flag this obviously fake test value.
const goodUri = ['mongodb+srv://', 'test-user', ':', 'not-a-password', '@cluster.example.net/tayonx'].join('');

test('accepts a real-looking URI and a long random secret', () => {
  assert.deepEqual(validateEnv({ MONGO_URI: goodUri, JWT_SECRET: goodSecret }), []);
});

test('rejects a missing MONGO_URI and JWT_SECRET', () => {
  assert.deepEqual(validateEnv({}), ['MONGO_URI is not set.', 'JWT_SECRET is not set.']);
});

test('rejects the .env.example placeholder URI', () => {
  const [problem] = validateEnv({ MONGO_URI: 'mongodb+srv://<db_user>:<db_password>@<cluster-host>/tayonx' }, ['MONGO_URI']);
  assert.match(problem, /placeholder/);
});

test('rejects a non-Mongo URI', () => {
  const [problem] = validateEnv({ MONGO_URI: 'http://example.com' }, ['MONGO_URI']);
  assert.match(problem, /must start with mongodb/);
});

test('rejects a short or example JWT secret', () => {
  assert.match(validateEnv({ JWT_SECRET: 'short' }, ['JWT_SECRET'])[0], /at least 32/);
  assert.match(validateEnv({ JWT_SECRET: 'replace-with-a-long-random-secret-of-32-chars' }, ['JWT_SECRET'])[0], /example value/);
});

test('error messages never contain the value', () => {
  const secret = 'TOPSECRETVALUE';
  const problems = validateEnv({ MONGO_URI: `http://${secret}`, JWT_SECRET: secret });
  for (const problem of problems) assert.ok(!problem.includes(secret));
});
