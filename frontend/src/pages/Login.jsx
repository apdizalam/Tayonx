import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../assets/tayonx-logo.png';
import '../App.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';
const dashboardPaths = { admin: '/admin/dashboard', customer: '/customer/dashboard', cargo_provider: '/cargo/dashboard' };

export default function LoginPage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    <main className="signin-page">
      <Link className="signin-brand" to="/login" aria-label="Tayonx home"><img src={logo} alt="Tayonx" /></Link>
      <form className="signin-card" onSubmit={handleSubmit}>
        <p className="eyebrow">CUSTOMER PORTAL</p>
        <h1>Welcome back</h1>
        <p className="page-description">Sign in to continue to your Tayonx workspace.</p>
        <label htmlFor="signin-email">Email address<input autoComplete="email" id="signin-email" name="email" onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required type="email" value={email} /></label>
        <label htmlFor="signin-password">Password<input autoComplete="current-password" id="signin-password" name="password" onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required type="password" value={password} /></label>
        <button className="primary-button full-button" disabled={isSubmitting} type="submit">{isSubmitting ? 'Signing in…' : 'Sign in'}</button>
        <Link className="secondary-button full-button auth-link-button" to="/register">Create an account</Link>
        <p className="signin-message" aria-live="polite" role={message ? 'alert' : undefined}>{message}</p>
      </form>
      <p className="signin-footnote">Connect · Request · Chat · Get it done</p>
    </main>
  );
}
