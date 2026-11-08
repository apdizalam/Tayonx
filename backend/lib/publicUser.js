// The account fields that are safe to send to the browser.
function publicUser(user) {
  const verification = user.verification || {};
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    country: user.country,
    phone: user.phone || '',
    profilePhoto: user.profilePhoto ? String(user.profilePhoto) : null,
    verification: {
      status: verification.status || 'unverified',
      submittedAt: verification.submittedAt || null,
      reviewedAt: verification.reviewedAt || null,
      reviewNote: verification.reviewNote || '',
    },
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

module.exports = publicUser;
