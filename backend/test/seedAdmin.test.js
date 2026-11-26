const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { readAdminConfig } = require('../seedAdmin');

test('has no built-in admin email or password', () => {
  const { problems } = readAdminConfig({});
  assert.deepEqual(problems, ['ADMIN_EMAIL is not set.', 'ADMIN_PASSWORD is not set.']);
});

test('rejects a short admin password and a bad email', () => {
  const { problems } = readAdminConfig({ ADMIN_EMAIL: 'not-an-email', ADMIN_PASSWORD: 'short123' });
  assert.equal(problems.length, 2);
  assert.match(problems[1], /at least 12/);
});

test('accepts a valid config and defaults the name', () => {
  const config = readAdminConfig({ ADMIN_EMAIL: ' Admin@Example.com ', ADMIN_PASSWORD: 'a-long-unique-passphrase' });
  assert.deepEqual(config.problems, []);
  assert.equal(config.email, 'admin@example.com');
  assert.equal(config.name, 'Administrator');
});

test('the script stops before connecting when settings are missing', () => {
  const script = path.join(__dirname, '..', 'seedAdmin.js');
  const env = { PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT, DOTENV_CONFIG_PATH: path.join(__dirname, 'no-such.env') };
  const result = spawnSync(process.execPath, [script], { env, encoding: 'utf8', timeout: 20000 });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /MONGO_URI is not set/);
});
