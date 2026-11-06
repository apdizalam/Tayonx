import { useState } from 'react';
import logo from './assets/tayonx-logo.png';
import './App.css';

const customerCountries = ['Somaliland', 'Other'];
const providerCountries = ['China', 'Turkey'];

function CheckIcon() {
  return (
    <svg className="icon check-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

function CustomerIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

function CargoIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 17h18l-2 4H5l-2-4Z" />
      <path d="M5 17V9h14v8M9 9V5h6v4" />
    </svg>
  );
}

function App() {
  const [role, setRole] = useState('customer');
  const [country, setCountry] = useState(customerCountries[0]);
  const [formMessage, setFormMessage] = useState('');
  const isCustomer = role === 'customer';
  const countries = isCustomer ? customerCountries : providerCountries;

  function chooseRole(nextRole) {
    setRole(nextRole);
    setCountry(
      nextRole === 'customer' ? customerCountries[0] : providerCountries[0],
    );
    setFormMessage('');
  }

  function handleSubmit(event) {
    event.preventDefault();
    setFormMessage(
      'Your details are ready. Account creation is not connected yet.',
    );
  }

  return (
    <div className="signup-page">
      <aside className="welcome-panel">
        <a className="brand" href="/" aria-label="Tayonx home">
          <img src={logo} alt="Tayonx" />
        </a>

        <div className="welcome-copy">
          <h1>Connect. Request. Chat. Get it done.</h1>
          <p>
            One account to source products from China and Turkey, or to serve
            customers in Somaliland.
          </p>
          <ul className="benefit-list">
            <li><CheckIcon />Verified cargo companies</li>
            <li><CheckIcon />Real-time chat</li>
            <li><CheckIcon />Track every order</li>
          </ul>
        </div>

        <p className="panel-footnote">Everything you need, all in one place.</p>
      </aside>

      <main className="form-panel">
        <form className="signup-form" onSubmit={handleSubmit}>
          <header className="form-heading">
            <h2>Create your account</h2>
            <p>
              Already have one? <a href="#sign-in">Sign in</a>
            </p>
          </header>

          <fieldset className="role-picker">
            <legend>I am a…</legend>
            <button
              className={`role-option${isCustomer ? ' is-selected' : ''}`}
              type="button"
              aria-pressed={isCustomer}
              onClick={() => chooseRole('customer')}
            >
              <span className="role-icon customer-icon"><CustomerIcon /></span>
              <span className="role-description">
                <span className="role-title">Customer</span>
                <span className="role-subtitle">
                  I want to buy products from China or Turkey.
                </span>
              </span>
            </button>
            <button
              className={`role-option${!isCustomer ? ' is-selected' : ''}`}
              type="button"
              aria-pressed={!isCustomer}
              onClick={() => chooseRole('provider')}
            >
              <span className="role-icon provider-icon"><CargoIcon /></span>
              <span className="role-description">
                <span className="role-title">Cargo company</span>
                <span className="role-subtitle">
                  I source and ship products for customers.
                </span>
              </span>
            </button>
          </fieldset>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="account-name">
                {isCustomer ? 'Full name' : 'Company name'}
              </label>
              <input
                autoComplete={isCustomer ? 'name' : 'organization'}
                id="account-name"
                name="name"
                placeholder={isCustomer ? 'Abdi Hassan' : 'Global Cargo Ltd'}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="country">Country</label>
              <select
                id="country"
                name="country"
                onChange={(event) => setCountry(event.target.value)}
                value={country}
              >
                {countries.map((country) => (
                  <option key={country} value={country}>{country}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="contact">Phone or email</label>
            <input
              autoComplete="email"
              id="contact"
              name="contact"
              placeholder="+252 63 … or name@email.com"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              autoComplete="new-password"
              id="password"
              minLength={8}
              name="password"
              placeholder="At least 8 characters"
              required
              type="password"
            />
          </div>

          {!isCustomer && (
            <div className="verification-note" role="note">
              <span className="info-icon" aria-hidden="true">i</span>
              <div>
                <strong>Verification required</strong>
                <p>
                  You&apos;ll upload your business license next. You can send
                  offers once an admin approves you.
                </p>
              </div>
            </div>
          )}

          <button className="submit-button" type="submit">Create account</button>
          <p className="legal-copy">
            By continuing you agree to the <a href="#terms">terms</a> and{' '}
            <a href="#privacy">privacy policy</a>.
          </p>
          <p className="form-message" aria-live="polite">{formMessage}</p>
        </form>
      </main>
    </div>
  );
}

export default App;
