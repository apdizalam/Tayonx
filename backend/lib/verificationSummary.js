// Shapes verification requests for the browser (used by admin review and admin user details).
const publicUser = require('./publicUser');

function fileSummary(file) {
  if (!file) return null;
  return {
    id: String(file._id),
    originalName: file.originalName,
    mimeType: file.mimeType,
    size: file.size,
  };
}

function requestSummary(request) {
  const user = request.user && typeof request.user === 'object' && request.user.email ? request.user : null;
  return {
    id: String(request._id),
    status: request.status,
    accountType: request.accountType,
    reviewNote: request.reviewNote,
    reviewedAt: request.reviewedAt,
    createdAt: request.createdAt,
    details: {
      legalName: request.details?.legalName || '',
      idNumber: request.details?.idNumber || '',
      dateOfBirth: request.details?.dateOfBirth || null,
      address: request.details?.address || '',
      registrationNumber: request.details?.registrationNumber || '',
    },
    user: user ? publicUser(user) : { id: String(request.user) },
    documents: {
      businessLicense: request.documents?.businessLicense?._id ? fileSummary(request.documents.businessLicense) : null,
      idDocument: request.documents?.idDocument?._id ? fileSummary(request.documents.idDocument) : null,
      companyLegalDocument: request.documents?.companyLegalDocument?._id ? fileSummary(request.documents.companyLegalDocument) : null,
    },
  };
}

const documentPopulate = [
  { path: 'documents.businessLicense', select: 'originalName mimeType size' },
  { path: 'documents.idDocument', select: 'originalName mimeType size' },
  { path: 'documents.companyLegalDocument', select: 'originalName mimeType size' },
];

module.exports = { fileSummary, requestSummary, documentPopulate };
