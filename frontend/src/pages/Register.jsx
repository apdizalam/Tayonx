import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../assets/tayonx-logo.png';
import Icon from '../components/Icon.jsx';
import '../App.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [role, setRole] = useState('customer');
  const [country, setCountry] = useState('Somaliland');
  const isCustomer = role === 'customer';
  const countries = isCustomer ? ['Somaliland', 'Somalia', 'Other'] : ['China', 'Turkey'];

  useEffect(() => {
    document.title = 'Tayonx | Create account';
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage('');

    const formData = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.get('name'),
          email: formData.get('email'),
          password: formData.get('password'),
          role: isCustomer ? 'customer' : 'cargo_provider',
          country,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        setMessage(result.message || result.error || 'Account creation failed. Please check your details and try again.');
        return;
      }

      navigate('/login');
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
          <p>One account to source products from China and Turkey, or to serve customers in Somaliland.</p>
          <ul>
            <li><Icon name="check" size={17} />Verified cargo companies</li>
            <li><Icon name="check" size={17} />Real-time chat</li>
            <li><Icon name="check" size={17} />Track every order</li>
          </ul>
        </div>
        <p className="signup-panel-footnote">Everything you need, all in one place.</p>
      </aside>

      <section className="signup-form-panel">
        <form className="signup-form" onSubmit={handleSubmit}>
          <header className="signup-heading">
            <h2>Create your account</h2>
            <p>Already have one? <Link to="/login">Sign in</Link></p>
          </header>

          <fieldset className="signup-role-picker">
            <legend>I am a…</legend>
            <button
              aria-pressed={isCustomer}
              className={`signup-role-option${isCustomer ? ' selected' : ''}`}
              onClick={() => {
                setRole('customer');
                setCountry('Somaliland');
                setMessage('');
              }}
              type="button"
            >
              <span className="signup-role-icon customer">
                <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21a8 8 0 0 1 16 0" />
                </svg>
              </span>
              <span><b>Customer</b><small>I want to buy products from China or Turkey.</small></span>
            </button>
            <button
              aria-pressed={!isCustomer}
              className={`signup-role-option${!isCustomer ? ' selected' : ''}`}
              onClick={() => {
                setRole('provider');
                setCountry('China');
                setMessage('');
              }}
              type="button"
            >
              <span className="signup-role-icon provider">
                <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 17h18l-2 4H5l-2-4Z" />
                  <path d="M5 17V9h14v8M9 9V5h6v4" />
                </svg>
              </span>
              <span><b>Cargo company</b><small>I source and ship products for customers.</small></span>
            </button>
          </fieldset>

          <div className="signup-name-country">
            <label htmlFor="register-name">
              {isCustomer ? 'Full name' : 'Company name'}
              <input
                autoComplete={isCustomer ? 'name' : 'organization'}
                id="register-name"
                name="name"
                placeholder={isCustomer ? 'Abdi Hassan' : 'Global Cargo Ltd'}
                required
                maxLength={100}
              />
            </label>
            <label htmlFor="register-country">
              Country
              <select
                id="register-country"
                name="country"
                onChange={(event) => setCountry(event.target.value)}
                value={country}
              >
                {countries.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          </div>

          <label htmlFor="register-email">
            Email address
            <input autoComplete="email" id="register-email" name="email" placeholder="you@example.com" required type="email" />
          </label>
          <label htmlFor="register-password">
            Password
            <input autoComplete="new-password" id="register-password" minLength={8} maxLength={72} name="password" placeholder="At least 8 characters" required type="password" />
          </label>

          {!isCustomer && (
            <div className="signup-verification-note">
              <Icon name="shield" size={20} />
              <div><b>Verification required</b><p>You&apos;ll upload your business license next. You can send offers once an admin approves you.</p></div>
            </div>
          )}

          <button className="primary-button signup-submit" disabled={isSubmitting} type="submit">{isSubmitting ? 'Creating account…' : 'Create account'}</button>
          <p className="signup-legal">By continuing you agree to the <a href="#terms">terms</a> and <a href="#privacy">privacy policy</a>.</p>
          <p className="signin-message" aria-live="polite" role={message ? 'alert' : undefined}>{message}</p>
        </form>
      </section>
    </main>
  );
}
