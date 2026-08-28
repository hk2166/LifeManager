import { useState } from 'react';
import { login, register } from './api';

export function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const p = mode === 'login' ? login(email, password) : register(email, password, name);
    p.catch((err) => {
      setError(String(err.message ?? err));
      setBusy(false);
    });
    // on success the token flips and App swaps this screen out — no need to reset busy
  };

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-brand">
          <span className="dot" />
          Life OS
        </div>
        <p className="auth-tagline">It reads what you have. It remembers what you'd forget.</p>

        <div className="auth-toggle" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => setMode('login')}>
            Sign in
          </button>
          <button type="button" role="tab" aria-selected={mode === 'register'} onClick={() => setMode('register')}>
            Create account
          </button>
        </div>

        {mode === 'register' && (
          <label className="auth-field">
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Your name" />
          </label>
        )}
        <label className="auth-field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
            required
          />
        </label>
        <label className="auth-field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'}
            required
          />
        </label>

        {error && <p className="warn">{error}</p>}

        <button className="btn auth-submit" type="submit" disabled={busy}>
          {busy ? 'One moment…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>

        <p className="auth-switch">
          {mode === 'login' ? "New here? " : 'Already have an account? '}
          <button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'Create an account' : 'Sign in'}
          </button>
        </p>
      </form>
    </div>
  );
}
