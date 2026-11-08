import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { DocumentPreview, ProtectedAvatar } from './ProtectedFile.jsx';
import { getVerificationRequests, reviewVerification } from '../lib/api.js';
import { ROLE_LABELS } from '../lib/accountFields.js';

const FILTERS = [
  ['pending', 'Pending'],
  ['approved', 'Approved'],
  ['rejected', 'Rejected'],
  ['all', 'All'],
];
const STATUS_LABELS = { pending: 'Pending review', approved: 'Approved', rejected: 'Rejected' };

function formatDate(value) {
  return value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}

function ReviewModal({ request, onClose, onReviewed }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const isCompany = request.accountType === 'cargo_provider';
  const { user, details, documents } = request;

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function decide(decision) {
    setError('');
    if (decision === 'rejected' && note.trim().length < 5) {
      setError('Tell the user what to fix before rejecting (at least 5 characters).');
      document.getElementById('verification-note')?.focus();
      return;
    }
    setBusy(decision);
    try {
      const result = await reviewVerification(request.id, decision, note.trim());
      onReviewed(result.request);
    } catch (reviewError) {
      setError(reviewError.message);
    } finally {
      setBusy('');
    }
  }

  const detailRows = isCompany
    ? [['Company name', user.name], ['Contact person', details.legalName || '—'], ['Registration number', details.registrationNumber || '—']]
    : [['Account name', user.name], ['Legal name', details.legalName], ['ID / passport number', details.idNumber], ['Date of birth', details.dateOfBirth ? new Date(details.dateOfBirth).toLocaleDateString() : '—'], ['Address', details.address]];

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="request-modal verification-review-modal" role="dialog" aria-modal="true" aria-labelledby="verification-review-title">
        <div className="modal-heading">
          <div>
            <p className="eyebrow">VERIFICATION REVIEW</p>
            <h2 id="verification-review-title">{user.name}</h2>
          </div>
          <button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}><Icon name="close" /></button>
        </div>

        <div className="verification-review-grid">
          <div className="verification-review-section">
            <h3>Account</h3>
            <dl>
              <div><dt>Account type</dt><dd>{ROLE_LABELS[request.accountType]}</dd></div>
              <div><dt>Email</dt><dd><a href={`mailto:${user.email}`}>{user.email}</a></dd></div>
              <div><dt>Phone</dt><dd>{user.phone ? <a href={`tel:${user.phone}`}>{user.phone}</a> : '—'}</dd></div>
              <div><dt>Country</dt><dd>{user.country}</dd></div>
              <div><dt>Submitted</dt><dd>{formatDate(request.createdAt)}</dd></div>
            </dl>
          </div>
          <div className="verification-review-section">
            <h3>{isCompany ? 'Company details' : 'Personal details'}</h3>
            <dl>{detailRows.map(([term, value]) => <div key={term}><dt>{term}</dt><dd>{value || '—'}</dd></div>)}</dl>
          </div>
        </div>

        <div className="verification-review-section">
          <h3>Documents</h3>
          <div className="verification-review-documents">
            {isCompany && <DocumentPreview label="Business license" file={documents.businessLicense} />}
            <DocumentPreview label={isCompany ? 'ID / passport photo' : 'Legal ID / passport photo'} file={documents.idDocument} />
            {isCompany && <DocumentPreview label="Company legal document" file={documents.companyLegalDocument} />}
          </div>
        </div>

        {request.status === 'pending' ? (
          <>
            <label className="verification-note-field" htmlFor="verification-note">
              <span>Feedback to the user <em>(required when rejecting)</em></span>
              <textarea id="verification-note" rows="3" maxLength="1000" value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. The passport photo is blurry, please upload a clearer copy." />
            </label>
            {error && <p className="signin-message" role="alert">{error}</p>}
            <div className="verification-review-actions">
              <button type="button" className="reject-button verification-reject" disabled={Boolean(busy)} onClick={() => decide('rejected')}><Icon name="close" size={15} />{busy === 'rejected' ? 'Rejecting…' : 'Reject'}</button>
              <button type="button" className="primary-button" disabled={Boolean(busy)} onClick={() => decide('approved')}><Icon name="check" size={15} />{busy === 'approved' ? 'Approving…' : 'Approve & verify account'}</button>
            </div>
          </>
        ) : (
          <div className={`verification-alert ${request.status === 'approved' ? 'success' : 'warning'}`}>
            <Icon name={request.status === 'approved' ? 'check' : 'alert'} size={18} />
            <div>
              <strong>{request.status === 'approved' ? 'Approved' : 'Rejected'} {formatDate(request.reviewedAt)}</strong>
              {request.reviewNote && <small>Feedback: “{request.reviewNote}”</small>}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

/** Admin → Verifications: review documents and approve or reject cargo accounts. */
export default function AdminVerifications({ refreshKey = 0, onPendingCountChange, onMessage }) {
  const [filter, setFilter] = useState('pending');
  const [selected, setSelected] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [loaded, setLoaded] = useState({ key: '', requests: [], error: '' });
  const loadKey = `${filter}:${refreshKey}:${reloadKey}`;
  // Keep showing the previous list while a refresh loads; show "Loading" only for a new filter.
  const loading = loaded.key !== loadKey && !loaded.key.startsWith(`${filter}:`);
  const { requests, error } = loaded;

  useEffect(() => {
    const controller = new AbortController();
    getVerificationRequests(filter, { signal: controller.signal })
      .then((result) => {
        setLoaded({ key: loadKey, requests: result.requests || [], error: '' });
        onPendingCountChange?.(result.pendingCount || 0);
      })
      .catch((loadError) => { if (loadError.name !== 'AbortError') setLoaded((current) => ({ ...current, key: loadKey, error: loadError.message })); });
    return () => controller.abort();
  }, [filter, loadKey, onPendingCountChange]);

  function handleReviewed(updated) {
    setSelected(null);
    onMessage?.(updated.status === 'approved' ? `${updated.user.name} is now verified.` : `${updated.user.name} was asked to update their documents.`);
    setReloadKey((key) => key + 1);
  }

  return (
    <section className="dashboard-card admin-verifications">
      <div className="card-heading">
        <div><h2>Verification requests</h2><p>Review documents from cargo companies and individual providers, then approve or reject them.</p></div>
        <div className="provider-request-filters" role="group" aria-label="Filter by status">
          {FILTERS.map(([value, label]) => <button key={value} type="button" className={filter === value ? 'active' : ''} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
        </div>
      </div>

      {error && <p className="verification-alert error" role="alert"><Icon name="alert" size={18} />{error}</p>}
      {loading ? <p className="empty-table" role="status">Loading verification requests…</p> : requests.length ? (
        <div className="table-scroll">
          <table className="data-table verification-table">
            <thead><tr><th>Applicant</th><th>Type</th><th>Contact</th><th>Submitted</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id}>
                  <td><span className="verification-applicant"><ProtectedAvatar fileId={request.user.profilePhoto} name={request.user.name} /><span><span className="table-primary">{request.user.name}</span><span className="table-secondary">{request.user.country}</span></span></span></td>
                  <td>{ROLE_LABELS[request.accountType]}</td>
                  <td><span className="table-primary">{request.user.email}</span><span className="table-secondary">{request.user.phone || '—'}</span></td>
                  <td>{formatDate(request.createdAt)}</td>
                  <td><span className={`verification-chip verification-${request.status}`}>{STATUS_LABELS[request.status]}</span></td>
                  <td><button type="button" className={request.status === 'pending' ? 'small-primary' : 'customer-outline-button'} onClick={() => setSelected(request)}>{request.status === 'pending' ? 'Review' : 'View'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <strong>{filter === 'pending' ? 'No requests waiting for review' : 'No verification requests here'}</strong>
          <p>New requests appear here instantly when a cargo company or individual provider submits their documents.</p>
        </div>
      )}

      {selected && <ReviewModal request={selected} onClose={() => setSelected(null)} onReviewed={handleReviewed} />}
    </section>
  );
}
