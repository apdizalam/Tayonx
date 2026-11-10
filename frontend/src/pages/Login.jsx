import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import logo from '../assets/tayonx-logo.png';
import Icon from '../components/Icon.jsx';
import '../App.css';
import '../login.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';
const dashboardPaths = { admin: '/admin/dashboard', customer: '/customer/dashboard', cargo_provider: '/cargo/dashboard', individual_cargo: '/cargo/dashboard' };
// "Remember me" keeps only the email address on this device; the password is never stored.
const REMEMBER_KEY = 'tayonx:remember-email';
const HERO_FEATURES = [
  ['shield', 'Verified providers', 'Every cargo company is document-checked before it can quote.'],
  ['ship', 'Live tracking', 'Follow each shipment from purchase to in transit to delivered.'],
  ['mail', 'Instant quotes', 'Receive, compare and accept offers in one place.'],
  ['globe', 'Global connectivity', 'Work with providers across countries and routes, by sea or air.'],
];

function rememberedEmail() {
  try {
    return localStorage.getItem(REMEMBER_KEY) || '';
  } catch {
    return '';
  }
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const registered = location.state?.registered === true;
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState(typeof location.state?.email === 'string' ? location.state.email : rememberedEmail());
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(() => Boolean(rememberedEmail()));
  const [showPassword, setShowPassword] = useState(false);
  const [showResetHelp, setShowResetHelp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    document.title = 'Tayonx | Sign in';
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json();

      if (!response.ok) {
        setMessage(result.message || result.error || 'Sign-in failed. Check your email and password.');
        return;
      }

      if (typeof result.token !== 'string' || !result.token || !result.user || typeof result.user !== 'object') {
        setMessage('The account service returned an invalid sign-in response. Please try again.');
        return;
      }

      const dashboardPath = dashboardPaths[result.user.role];
      if (!dashboardPath) {
        setMessage('The account service returned an unsupported account role. Please contact support.');
        return;
      }

      try {
        if (remember) localStorage.setItem(REMEMBER_KEY, email.trim());
        else localStorage.removeItem(REMEMBER_KEY);
      } catch {
        // Storage can be unavailable (private mode); sign-in still continues.
      }
      localStorage.setItem('token', result.token);
      localStorage.setItem('user', JSON.stringify(result.user));
      navigate(dashboardPath);
    } catch {
      setMessage('Cannot reach the account service. Check that the backend is running.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-scene">
      <div className="login-shell login-form-column">
        <form className="login-card" onSubmit={handleSubmit}>
          <Link className="login-logo" to="/" aria-label="Tayonx home"><img src={logo} alt="Tayonx" /></Link>
          <header className="login-header">
            <h1>Welcome to Tayonx</h1>
            <p>Sign in to manage your shipments and cargo operations.</p>
          </header>

          {registered && <p className="login-notice success" role="status"><Icon name="check" size={15} />Your account was created. Sign in to continue.</p>}

          <label className="login-field" htmlFor="signin-email">
            <span>Email address</span>
            <span className="login-input">
              <Icon name="mail" size={17} />
              <input autoComplete="email" id="signin-email" name="email" onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" required type="email" value={email} />
            </span>
          </label>

          <label className="login-field" htmlFor="signin-password">
            <span>Password</span>
            <span className="login-input">
              <Icon name="lock" size={17} />
              <input autoComplete="current-password" id="signin-password" name="password" onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required type={showPassword ? 'text' : 'password'} value={password} />
              <button type="button" className="login-reveal" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>
                <Icon name={showPassword ? 'eye-off' : 'eye'} size={17} />
              </button>
            </span>
          </label>

          <div className="login-options">
            <label className="login-remember">
              <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
              <span>Remember me</span>
            </label>
            <button type="button" className="login-text-link" onClick={() => setShowResetHelp((shown) => !shown)} aria-expanded={showResetHelp} aria-controls="login-reset-help">Forgot password?</button>
          </div>
          {showResetHelp && (
            <p className="login-notice" id="login-reset-help" role="note">
              <Icon name="headphones" size={15} />
              Password resets are handled by Tayonx support. Contact your Tayonx administrator with your account email to get a new password.
            </p>
          )}

          <button className="login-submit" disabled={isSubmitting} type="submit">
            {isSubmitting ? <><span className="login-spinner" aria-hidden="true" />Signing in…</> : <>Log in<Icon name="login" size={17} /></>}
          </button>

          <p className="login-message" aria-live="polite" role={message ? 'alert' : undefined}>{message}</p>

          <p className="login-signup">New to Tayonx? <Link to="/register">Create an account</Link></p>
        </form>
      </div>

      <section className="login-hero" aria-labelledby="login-hero-title">
        <div className="login-hero-content">
          <p className="login-hero-eyebrow"><span aria-hidden="true" />Tayonx cargo marketplace</p>
          <h2 id="login-hero-title">Next-Generation Cargo &amp; Logistics Management</h2>
          <p className="login-hero-lead">
            One workspace to request shipments, compare quotes from verified cargo providers and follow every order
            from purchase to delivery — with real-time tracking and direct chat at each step.
          </p>
          <ul className="login-features">
            {HERO_FEATURES.map(([icon, title, text]) => (
              <li key={title}>
                <span className="login-feature-icon"><Icon name={icon} size={19} /></span>
                <span><b>{title}</b><small>{text}</small></span>
              </li>
            ))}
          </ul>
          <ol className="login-journey" aria-label="How Tayonx works">
            {['Request', 'Quote', 'Ship', 'Deliver'].map((step, index) => (
              <li key={step}><span>{index + 1}</span>{step}</li>
            ))}
          </ol>
        </div>
      </section>
    </main>
  );
}
