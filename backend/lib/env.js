// Checks required environment variables at startup. Error messages name the
// variable that is wrong but never print its value.

const MIN_JWT_SECRET_LENGTH = 32;

function checkMongoUri(env) {
  const uri = env.MONGO_URI;
  if (!uri || !uri.trim()) return 'MONGO_URI is not set.';
  if (!/^mongodb(\+srv)?:\/\//.test(uri.trim())) return 'MONGO_URI must start with mongodb:// or mongodb+srv://.';
  if (/<[^>]*>/.test(uri)) return 'MONGO_URI still contains a <placeholder>. Use your real connection string.';
  return '';
}

function checkJwtSecret(env) {
  const secret = env.JWT_SECRET;
  if (!secret) return 'JWT_SECRET is not set.';
  if (secret.length < MIN_JWT_SECRET_LENGTH) {
    return `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters.`;
  }
  if (/replace|change|example|your[-_ ]?secret/i.test(secret)) {
    return 'JWT_SECRET still looks like the example value. Generate a random secret.';
  }
  return '';
}

/**
 * Returns a list of problems for the given variables (empty when all is fine).
 * `required` picks which checks run, so the seed script can skip JWT_SECRET.
 */
function validateEnv(env = process.env, required = ['MONGO_URI', 'JWT_SECRET']) {
  const checks = { MONGO_URI: checkMongoUri, JWT_SECRET: checkJwtSecret };
  return required.map((name) => checks[name](env)).filter(Boolean);
}

/** Exits the process with a clear message when a required variable is missing or unsafe. */
function assertEnv(required) {
  const problems = validateEnv(process.env, required);
  if (problems.length === 0) return;
  console.error('Configuration error. Fix backend/.env (see backend/.env.example):');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

module.exports = { MIN_JWT_SECRET_LENGTH, validateEnv, assertEnv };
