const { rateLimit } = require('express-rate-limit');

// Slows down password guessing: 10 failed sign-in attempts per IP every 15 minutes.
// Successful sign-ins do not count.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Try again in 15 minutes.' },
});

// Limits account creation from one IP: 20 sign-ups per hour.
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many sign-ups from this network. Try again later.' },
});

module.exports = { loginLimiter, registerLimiter };
