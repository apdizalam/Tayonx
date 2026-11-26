// Creates the administrator account, or updates its password if it already exists.
// Usage: set ADMIN_EMAIL and ADMIN_PASSWORD in backend/.env, then `npm run seed:admin`.
// The password is hashed before it is stored and is never printed.
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const { assertEnv } = require('./lib/env');

const MIN_ADMIN_PASSWORD_LENGTH = 12;

/** Returns the admin details from the environment, plus a list of problems. */
function readAdminConfig(env = process.env) {
  const email = (env.ADMIN_EMAIL || '').trim().toLowerCase();
  const name = (env.ADMIN_NAME || '').trim() || 'Administrator';
  const password = env.ADMIN_PASSWORD || '';
  const problems = [];

  if (!email) problems.push('ADMIN_EMAIL is not set.');
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) problems.push('ADMIN_EMAIL is not a valid email address.');

  if (!password) problems.push('ADMIN_PASSWORD is not set.');
  else if (password.length < MIN_ADMIN_PASSWORD_LENGTH) {
    problems.push(`ADMIN_PASSWORD must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters.`);
  } else if (Buffer.byteLength(password, 'utf8') > 72) {
    problems.push('ADMIN_PASSWORD must be no more than 72 UTF-8 bytes.');
  }

  return { email, name, password, problems };
}

async function seedAdmin() {
  assertEnv(['MONGO_URI']);
  const { email, name, password, problems } = readAdminConfig();
  if (problems.length) {
    console.error('Cannot seed the admin account:');
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update in place so the admin keeps the same id (chats and reports point to it).
    const existing = await User.findOne({ email });
    if (existing) {
      existing.password = hashedPassword;
      existing.role = 'admin';
      existing.name = name;
      await existing.save();
      console.log(`Admin password updated for ${email}.`);
    } else {
      await User.create({ name, email, password: hashedPassword, role: 'admin' });
      console.log(`Admin account created for ${email}.`);
    }
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error during seeding:', error.message);
    process.exit(1);
  }
}

if (require.main === module) seedAdmin();

module.exports = { readAdminConfig, MIN_ADMIN_PASSWORD_LENGTH };
