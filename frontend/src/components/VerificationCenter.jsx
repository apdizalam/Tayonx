import { useEffect, useState } from 'react';
import FilePicker from './FilePicker.jsx';
import Icon from './Icon.jsx';
import { getMyVerification, submitVerification } from '../lib/api.js';
import { DOCUMENT_TYPES, cleanText, validateFile } from '../lib/accountFields.js';

export const REVIEW_MESSAGE = 'Your details are under review. Please wait up to 24 hours for verification or feedback.';

const DOCUMENTS = {
  cargo_provider: [
    ['businessLicense', 'Business license', 'Trade or business license issued to your company.'],
    ['idDocument', 'ID / passport photo', 'Owner or manager’s national ID or passport.'],
    ['companyLegalDocument', 'Company legal document', 'Certificate of incorporation, registration or similar.'],
  ],
  individual_cargo: [
    ['idDocument', 'Legal ID / passport photo', 'A clear photo of your national ID or passport.'],
  ],
};

const fileHint = 'JPG, PNG, WebP or PDF · max 5 MB';

function maxBirthDate() {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 18);
  return date.toISOString().slice(0, 10);
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '';
}

function TextField({ id, label, error, hint, optional, ...inputProps }) {
  return (
    <div className={`account-field${error ? ' has-error' : ''}`}>
      <label className="account-field-label" htmlFor={id}>{label}{optional && <em>Optional</em>}</label>
      <div className="account-input">
        <input id={id} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} {...inputProps} />
      </div>
      {hint && !error && <small className="account-field-hint" id={`${id}-hint`}>{hint}</small>}
      {error && <p className="account-field-error" id={`${id}-error`} role="alert">{error}</p>}
    </div>
  );
}

/**
 * Settings → Verification for cargo companies and individual cargo providers.
 * Shows the current status and, when allowed, the role-specific upload form.
 */
export default function VerificationCenter({ user, onVerificationChange }) {
  const role = user.role === 'cargo_provider' ? 'cargo_provider' : 'individual_cargo';
  const isCompany = role === 'cargo_provider';
  // The account's verification status lives on `user` (kept live by the dashboard); this holds the latest request.
  const [state, setState] = useState({ loading: true, error: '', request: null });
  const [details, setDetails] = useState({ legalName: isCompany ? '' : user.name, idNumber: '', dateOfBirth: '', address: '', registrationNumber: '' });
  const [files, setFiles] = useState({});
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [justSubmitted, setJustSubmitted] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getMyVerification({ signal: controller.signal })
      .then((result) => {
        setState({ loading: false, error: '', request: result.request });
        onVerificationChange?.(result.verification);
      })
      .catch((error) => { if (error.name !== 'AbortError') setState((current) => ({ ...current, loading: false, error: error.message })); });
    return () => controller.abort();
    // Load once when Settings opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verification = user.verification || {};
  const status = verification.status || 'unverified';
  const canSubmit = status === 'unverified' || status === 'rejected';

  function setDetail(field) {
    return (event) => {
      setDetails((current) => ({ ...current, [field]: event.target.value }));
      setErrors((current) => ({ ...current, [field]: '' }));
    };
  }

  function validate() {
    const next = {};
    for (const [field, label] of DOCUMENTS[role]) {
      if (!files[field]) next[field] = `${label} is required.`;
      else {
        const fileError = validateFile(files[field], DOCUMENT_TYPES);
        if (fileError) next[field] = fileError;
      }
    }
    const legalName = cleanText(details.legalName);
    if (isCompany) {
      if (legalName && legalName.split(' ').length < 2) next.legalName = 'Enter the contact person’s full name.';
    } else {
      if (legalName.split(' ').filter(Boolean).length < 3) next.legalName = 'Enter your full legal name as on your ID (three names).';
      if (!/^[A-Za-z0-9-]{4,50}$/.test(cleanText(details.idNumber))) next.idNumber = 'Enter your ID or passport number.';
      if (!details.dateOfBirth || details.dateOfBirth > maxBirthDate()) next.dateOfBirth = 'Enter your date of birth (you must be at least 18).';
      if (cleanText(details.address).length < 5) next.address = 'Enter your current address (city and district).';
    }
    return Object.fromEntries(Object.entries(next).filter(([, message]) => message));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError('');
    const validationErrors = validate();
    setErrors(validationErrors);
    const firstInvalid = Object.keys(validationErrors)[0];
    if (firstInvalid) {
      document.getElementById(`verify-${firstInvalid}`)?.focus();
      return;
    }

    const body = new FormData();
    for (const [field] of DOCUMENTS[role]) body.append(field, files[field]);
    for (const [key, value] of Object.entries(details)) if (cleanText(value)) body.append(key, cleanText(value));

    setSubmitting(true);
    try {
      const result = await submitVerification(body);
      setState({ loading: false, error: '', request: result.request });
      setFiles({});
      setJustSubmitted(true);
      onVerificationChange?.(result.verification);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setSubmitError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="dashboard-card verification-center">
      <div className="card-heading">
        <div>
          <h2>Account verification</h2>
          <p>{isCompany ? 'Verify your cargo company to earn the verified badge and customer trust.' : 'Verify your identity to become an approved individual cargo provider.'}</p>
        </div>
        <span className={`verification-chip verification-${status}`}><Icon name="shield" size={14} />{{ unverified: 'Not verified', pending: 'Under review', approved: 'Verified', rejected: 'Needs changes' }[status]}</span>
      </div>

      {state.loading && <p className="empty-table" role="status">Loading verification status…</p>}
      {state.error && <p className="verification-alert error" role="alert"><Icon name="alert" size={18} />{state.error}</p>}

      {!state.loading && status === 'pending' && (
        <div className={`verification-alert info${justSubmitted ? ' highlight' : ''}`} role={justSubmitted ? 'alert' : 'status'}>
          <Icon name="clock" size={20} />
          <div>
            <strong>{REVIEW_MESSAGE}</strong>
            {state.request?.createdAt && <small>Submitted {formatDate(state.request.createdAt)}. We’ll notify you here as soon as an administrator reviews your documents.</small>}
          </div>
        </div>
      )}

      {!state.loading && status === 'approved' && (
        <div className="verification-alert success" role="status">
          <Icon name="check" size={20} />
          <div>
            <strong>Your account is verified.</strong>
            <small>{verification.reviewedAt ? `Approved ${formatDate(verification.reviewedAt)}. ` : ''}Customers will see the verified badge on your profile.</small>
          </div>
        </div>
      )}

      {!state.loading && status === 'rejected' && (
        <div className="verification-alert warning" role="status">
          <Icon name="alert" size={20} />
          <div>
            <strong>Your verification needs changes.</strong>
            {verification.reviewNote && <small>Feedback from the Tayonx team: “{verification.reviewNote}”</small>}
            <small>Update your documents below and submit again.</small>
          </div>
        </div>
      )}

      {!state.loading && canSubmit && (
        <form className="verification-form account-form" onSubmit={handleSubmit} noValidate>
          <div className="verification-steps" aria-hidden="true">
            <span className="active"><b>1</b>Details</span><i /><span className="active"><b>2</b>Documents</span><i /><span><b>3</b>Review (24h)</span>
          </div>

          <fieldset className="verification-section">
            <legend>{isCompany ? 'Company details' : 'Personal details'}</legend>
            {isCompany ? (
              <div className="account-fields-row">
                <TextField id="verify-legalName" label="Contact person full name" optional value={details.legalName} onChange={setDetail('legalName')} error={errors.legalName} maxLength={100} autoComplete="name" placeholder="Ahmed Ali Farah" />
                <TextField id="verify-registrationNumber" label="Business registration number" optional value={details.registrationNumber} onChange={setDetail('registrationNumber')} error={errors.registrationNumber} maxLength={60} placeholder="SL-12345" />
              </div>
            ) : (
              <>
                <TextField id="verify-legalName" label="Full legal name (as on your ID)" value={details.legalName} onChange={setDetail('legalName')} error={errors.legalName} maxLength={100} autoComplete="name" required />
                <div className="account-fields-row">
                  <TextField id="verify-idNumber" label="ID / passport number" value={details.idNumber} onChange={setDetail('idNumber')} error={errors.idNumber} maxLength={50} placeholder="P1234567" required />
                  <TextField id="verify-dateOfBirth" label="Date of birth" type="date" max={maxBirthDate()} value={details.dateOfBirth} onChange={setDetail('dateOfBirth')} error={errors.dateOfBirth} required />
                </div>
                <TextField id="verify-address" label="Current address" value={details.address} onChange={setDetail('address')} error={errors.address} maxLength={200} autoComplete="street-address" placeholder="Hargeisa, 26 June district" required />
              </>
            )}
          </fieldset>

          <fieldset className="verification-section">
            <legend>Documents</legend>
            <div className={`verification-documents${isCompany ? '' : ' single'}`}>
              {DOCUMENTS[role].map(([field, label, help]) => (
                <div key={field}>
                  <FilePicker
                    id={`verify-${field}`}
                    label={label}
                    hint={fileHint}
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    required
                    file={files[field] || null}
                    error={errors[field]}
                    onChange={(file) => { setFiles((current) => ({ ...current, [field]: file })); setErrors((current) => ({ ...current, [field]: '' })); }}
                  />
                  <small className="account-field-hint">{help}</small>
                </div>
              ))}
            </div>
          </fieldset>

          {submitError && <p className="verification-alert error" role="alert"><Icon name="alert" size={18} />{submitError}</p>}
          <div className="verification-submit">
            <small><Icon name="shield" size={14} />Your documents are only visible to you and Tayonx administrators.</small>
            <button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Submitting…' : status === 'rejected' ? 'Resubmit for review' : 'Submit for verification'}</button>
          </div>
        </form>
      )}
    </section>
  );
}
