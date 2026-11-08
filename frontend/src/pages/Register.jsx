import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../assets/tayonx-logo.png';
import AccountFields from '../components/AccountFields.jsx';
import Icon from '../components/Icon.jsx';
import { ACCOUNT_TYPES, cleanText, normalizePhone, validateAccount } from '../lib/accountFields.js';
import '../App.css';
import '../account-forms.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const roleIcons = {
  customer: (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
  ),
  cargo_provider: (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17h18l-2 4H5l-2-4Z" /><path d="M5 17V9h14v8M9 9V5h6v4" /></svg>
  ),
  individual_cargo: (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="6" r="3" /><path d="M6 21v-5a6 6 0 0 1 12 0v5M9 13h6v4H9z" /></svg>
  ),
};

const emptyValues = { name: '', phone: '', email: '', country: 'Somaliland', password: '', profilePhoto: null };
const fieldInputIds = { profilePhoto: 'register-photo' };

export default function RegisterPage() {
  const navigate = useNavigate();
  const [role, setRole] = useState('customer');
  const [values, setValues] = useState(emptyValues);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isCargo = role !== 'customer';

  useEffect(() => {
    document.title = 'Tayonx | Create account';
  }, []);

  function chooseRole(nextRole) {
    setRole(nextRole);
    setErrors({});
    setMessage('');
    // The name means something different per role (person vs company), so start it fresh.
    setValues((current) => ({ ...current, name: '', profilePhoto: nextRole === 'customer' ? current.profilePhoto : null }));
  }

  function updateField(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) {
      setErrors((current) => {
        const next = { ...current };
        delete next[field];
        return next;
      });
    }
  }

  function focusField(field) {
    document.getElementById(fieldInputIds[field] || `register-${field}`)?.focus();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    const validationErrors = validateAccount(values, role);
    setErrors(validationErrors);
    const firstInvalid = Object.keys(validationErrors)[0];
    if (firstInvalid) {
      focusField(firstInvalid);
      return;
    }

    const body = new FormData();
    body.append('role', role);
    body.append('name', cleanText(values.name));
    body.append('phone', normalizePhone(values.phone));
    body.append('email', cleanText(values.email));
    body.append('country', values.country);
    body.append('password', values.password);
    if (role === 'customer' && values.profilePhoto) body.append('profilePhoto', values.profilePhoto);

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, { method: 'POST', body });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (result.field) {
          setErrors({ [result.field]: result.error });
          focusField(result.field);
        }
        setMessage(result.error || 'Account creation failed. Please check your details and try again.');
        return;
      }
      navigate('/login', { state: { registered: true, email: result.user?.email } });
    } catch {
      setMessage('Cannot reach the account service. Check that the backend is running.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="signup-page">
      <aside className="signup-welcome">
        <Link className="signup-brand" to="/login" aria-label="Tayonx home"><img src={logo} alt="Tayonx" /></Link>
        <div className="signup-welcome-copy">
          <h1>Connect. Request. Chat. Get it done.</h1>
          <p>One account to source products from abroad, or to serve customers in Somaliland and beyond.</p>
          <ul>
            <li><Icon name="check" size={17} />Verified cargo companies</li>
            <li><Icon name="check" size={17} />Real-time chat</li>
            <li><Icon name="check" size={17} />Track every order</li>
          </ul>
        </div>
        <p className="signup-panel-footnote">Everything you need, all in one place.</p>
      </aside>

      <section className="signup-form-panel">
        <form className="signup-form account-form" onSubmit={handleSubmit} noValidate>
          <header className="signup-heading">
            <h2>Create your account</h2>
            <p>Already have one? <Link to="/login">Sign in</Link></p>
          </header>

          <fieldset className="signup-role-picker role-picker-3">
            <legend>I am a…</legend>
            {Object.entries(ACCOUNT_TYPES).map(([value, type]) => (
              <button
                key={value}
                type="button"
                aria-pressed={role === value}
                className={`signup-role-option${role === value ? ' selected' : ''}`}
                onClick={() => chooseRole(value)}
              >
                <span className={`signup-role-icon ${value === 'customer' ? 'customer' : 'provider'}`}>{roleIcons[value]}</span>
                <span><b>{type.label}</b><small>{type.description}</small></span>
              </button>
            ))}
          </fieldset>

          <AccountFields role={role} values={values} errors={errors} onChange={updateField} idPrefix="register" />

          <div className={`account-field${errors.password ? ' has-error' : ''}`}>
            <label className="account-field-label" htmlFor="register-password">Password</label>
            <div className="account-input with-icon">
              <Icon name="shield" size={16} />
              <input
                id="register-password"
                name="password"
                type="password"
                autoComplete="new-password"
                value={values.password}
                onChange={(event) => updateField('password', event.target.value)}
                placeholder="At least 8 characters"
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? 'register-password-error' : undefined}
                maxLength={72}
                required
              />
            </div>
            {errors.password && <p className="account-field-error" id="register-password-error" role="alert">{errors.password}</p>}
          </div>

          {isCargo && (
            <div className="signup-verification-note">
              <Icon name="shield" size={20} />
              <div>
                <b>Get verified after you sign in</b>
                <p>
                  {role === 'cargo_provider'
                    ? 'Upload your business license, an ID/passport photo and your company legal document in Settings to become a verified company.'
                    : 'Upload your ID/passport photo and personal details in Settings to become a verified provider.'}
                </p>
              </div>
            </div>
          )}

          <button className="primary-button signup-submit" disabled={isSubmitting} type="submit">{isSubmitting ? 'Creating account…' : `Create ${ACCOUNT_TYPES[role].label.toLowerCase()} account`}</button>
          <p className="signup-legal">By continuing you agree to the <a href="#terms">terms</a> and <a href="#privacy">privacy policy</a>.</p>
          <p className="signin-message" aria-live="polite" role={message ? 'alert' : undefined}>{message}</p>
        </form>
      </section>
    </main>
  );
}
