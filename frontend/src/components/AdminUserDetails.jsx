import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { DocumentPreview } from './ProtectedFile.jsx';
import { getUserDetails } from '../lib/api.js';
import { useFileUrl } from '../lib/useFileUrl.js';
import { ROLE_LABELS, VERIFICATION_LABELS } from '../lib/accountFields.js';

const CARGO_ROLES = ['cargo_provider', 'individual_cargo'];

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—';
}

function initialsOf(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';
}

/** Large profile picture; click opens the full image in a new tab. */
function LargeAvatar({ fileId, name }) {
  const { url, loading } = useFileUrl(fileId);
  if (url) {
    return (
      <a className="user-details-avatar has-photo" href={url} target="_blank" rel="noreferrer" title="Open full-size photo">
        <img src={url} alt={`${name} profile`} />
        <span className="user-details-avatar-zoom" aria-hidden="true"><Icon name="eye" size={14} /></span>
      </a>
    );
  }
  return <span className="user-details-avatar" aria-hidden="true">{fileId && loading ? <Icon name="clock" size={22} /> : initialsOf(name)}</span>;
}

function Row({ label, children }) {
  return <div><dt>{label}</dt><dd>{children}</dd></div>;
}

function VerificationSection({ account, requests }) {
  const status = account.verification?.status || 'unverified';
  const latest = requests[0] || null;
  const isCompany = account.role === 'cargo_provider';
  const documents = latest?.documents || {};
  const details = latest?.details || {};
  const detailRows = isCompany
    ? [['Contact person', details.legalName], ['Registration number', details.registrationNumber], ['Address', details.address]]
    : [['Legal name', details.legalName], ['ID / passport number', details.idNumber], ['Date of birth', formatDate(details.dateOfBirth)], ['Address', details.address]];

  return (
    <section className="offer-details-section user-details-verification">
      <h3>Verification</h3>
      <dl>
        <Row label="Status"><span className={`verification-chip verification-${status}`}><Icon name="shield" size={13} />{VERIFICATION_LABELS[status] || status}</span></Row>
        <Row label="Submitted">{formatDateTime(account.verification?.submittedAt || latest?.createdAt)}</Row>
        <Row label="Reviewed">{formatDateTime(account.verification?.reviewedAt || latest?.reviewedAt)}</Row>
        {(account.verification?.reviewNote || latest?.reviewNote) && <Row label="Review note">{account.verification?.reviewNote || latest?.reviewNote}</Row>}
      </dl>

      {latest ? (
        <>
          <h4>{isCompany ? 'Company details' : 'Personal details'}</h4>
          <dl>{detailRows.map(([label, value]) => <Row key={label} label={label}>{value && value !== '—' ? value : '—'}</Row>)}</dl>
          <h4>Uploaded documents</h4>
          <div className="verification-review-documents user-details-documents">
            {isCompany && <DocumentPreview label="Business license" file={documents.businessLicense} />}
            <DocumentPreview label={isCompany ? 'ID / passport photo' : 'Legal ID / passport photo'} file={documents.idDocument} />
            {isCompany && <DocumentPreview label="Company legal document" file={documents.companyLegalDocument} />}
          </div>
          {requests.length > 1 && (
            <>
              <h4>Earlier submissions</h4>
              <ul className="user-details-history">
                {requests.slice(1).map((request) => (
                  <li key={request.id}>
                    <span className={`verification-chip verification-${request.status}`}>{VERIFICATION_LABELS[request.status] || request.status}</span>
                    <span>{formatDateTime(request.createdAt)}</span>
                    {request.reviewNote && <small>“{request.reviewNote}”</small>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      ) : (
        <p className="user-details-empty"><Icon name="file" size={16} />No verification documents have been uploaded yet.</p>
      )}
    </section>
  );
}

/**
 * Admin "View user" modal: large photo, contact details, role, country, verification
 * status with uploaded documents, registration date and account activity.
 * `account` is the row from the users table (shown at once); full details load from the API.
 */
export default function AdminUserDetails({ account, isSelf, busy, onClose, onEdit, onDelete, onReviewVerification }) {
  const [details, setDetails] = useState({ id: '', data: null, error: '' });
  const closeRef = useRef(null);
  const accountId = account.id;

  useEffect(() => {
    const controller = new AbortController();
    getUserDetails(accountId, { signal: controller.signal })
      .then((data) => setDetails({ id: accountId, data, error: '' }))
      .catch((error) => { if (error.name !== 'AbortError') setDetails({ id: accountId, data: null, error: error.message }); });
    return () => controller.abort();
  }, [accountId]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const loaded = details.id === accountId;
  const full = loaded && details.data ? details.data.user : null;
  const person = { ...account, ...(full || {}) };
  const isCargo = CARGO_ROLES.includes(person.role);
  const activity = loaded && details.data ? details.data.activity : null;
  const status = person.verification?.status || 'unverified';

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="request-modal offer-details-modal user-details-modal" role="dialog" aria-modal="true" aria-labelledby="user-details-title">
        <header className="user-details-header">
          <LargeAvatar fileId={person.profilePhoto} name={person.name} />
          <div className="user-details-identity">
            <p className="eyebrow">User details</p>
            <h2 id="user-details-title">{person.name}</h2>
            <div className="user-details-chips">
              <span className={`admin-user-role admin-user-role-${person.role}`}>{ROLE_LABELS[person.role] || person.role}</span>
              {isCargo && <span className={`verification-chip verification-${status}`}><Icon name="shield" size={13} />{VERIFICATION_LABELS[status] || status}</span>}
              <span className="user-details-status"><i aria-hidden="true" />Active</span>
              {isSelf && <span className="user-details-you">You</span>}
            </div>
          </div>
          <button ref={closeRef} type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}><Icon name="close" /></button>
        </header>

        {loaded && details.error && <p className="signin-message" role="alert">{details.error}</p>}

        <div className="offer-details-grid">
          <section className="offer-details-section">
            <h3>Contact</h3>
            <dl>
              <Row label={person.role === 'cargo_provider' ? 'Company name' : 'Full name'}>{person.name}</Row>
              <Row label="Email"><a href={`mailto:${person.email}`}>{person.email}</a></Row>
              <Row label="Phone">{person.phone ? <a href={`tel:${person.phone}`}>{person.phone}</a> : <span className="table-secondary">Not provided</span>}</Row>
              <Row label="Country">{person.country || '—'}</Row>
            </dl>
          </section>
          <section className="offer-details-section">
            <h3>Account</h3>
            <dl>
              <Row label="Role">{ROLE_LABELS[person.role] || person.role}</Row>
              <Row label="Account status"><span className="user-details-status"><i aria-hidden="true" />Active</span></Row>
              <Row label="Registered">{formatDateTime(person.createdAt)}</Row>
              <Row label="Last updated">{formatDateTime(person.updatedAt)}</Row>
              <Row label="User ID"><code className="user-details-id">{person.id}</code></Row>
            </dl>
          </section>
        </div>

        {activity && (person.role === 'customer' || isCargo) && (
          <div className="user-details-stats">
            {person.role === 'customer' ? (
              <>
                <div><strong>{activity.requests}</strong><span>Shipping requests</span></div>
                <div><strong>{activity.activeRequests}</strong><span>Active requests</span></div>
              </>
            ) : (
              <>
                <div><strong>{activity.offers}</strong><span>Offers sent</span></div>
                <div><strong>{activity.acceptedOffers}</strong><span>Accepted offers</span></div>
              </>
            )}
          </div>
        )}

        {isCargo && (loaded
          ? <VerificationSection account={person} requests={details.data?.verificationRequests || []} />
          : <p className="empty-table" role="status">Loading verification documents…</p>)}

        <footer className="offer-details-footer user-details-footer">
          {isCargo && status === 'pending' && onReviewVerification && (
            <button type="button" className="customer-outline-button" onClick={onReviewVerification}><Icon name="shield" size={15} />Review verification</button>
          )}
          <button type="button" className="customer-outline-button" onClick={() => onEdit(person)}><Icon name="edit" size={15} />Edit user</button>
          <button type="button" className="reject-button" disabled={isSelf || busy} title={isSelf ? 'You cannot delete your own account' : 'Delete user'} onClick={() => onDelete(person)}><Icon name="trash" size={15} />Delete user</button>
        </footer>
      </section>
    </div>
  );
}
