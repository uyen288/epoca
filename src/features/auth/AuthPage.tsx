import { useState, type FormEvent } from 'react';
import { ArrowRight, Check, CircleHelp, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, authResponseSchema, jsonBody } from '@/lib/api';

interface AuthPageProps {
  onAuthenticated: () => void | Promise<void>;
}

export function AuthPage({ onAuthenticated }: AuthPageProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const authMutation = useMutation({
    mutationFn: () => apiRequest(
      isRegistering ? '/auth/register' : '/auth/login',
      authResponseSchema,
      { method: 'POST', body: jsonBody(isRegistering ? { name, email, password } : { email, password }) },
    ),
    onSuccess: onAuthenticated,
  });

  function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    authMutation.mutate();
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <a className="brand brand-auth" href="/" aria-label="época home">
          <span className="brand-mark">e</span>
          <span>época</span>
        </a>
        <span className="eyebrow">YOUR PERSONAL WORKSPACE</span>
        <h1>{isRegistering ? 'A calmer way to begin.' : 'Welcome back.'}</h1>
        <p className="auth-intro">
          {isRegistering
            ? 'Create a space for everything you want to keep in view.'
            : 'Pick up right where you left off.'}
        </p>
        <form className="auth-form" onSubmit={submitAuth}>
          {isRegistering && (
            <label className="field">
              <span>Your name</span>
              <span className="input-wrap"><UserRound size={17} /><input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} /></span>
            </label>
          )}
          <label className="field">
            <span>Email address</span>
            <span className="input-wrap"><Mail size={17} /><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} /></span>
          </label>
          <label className="field">
            <span>Password</span>
            <span className="input-wrap"><LockKeyhole size={17} /><input type="password" autoComplete={isRegistering ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={isRegistering ? 8 : 1} maxLength={72} /></span>
            {isRegistering && <small>Use at least 8 characters.</small>}
          </label>
          {authMutation.isError && <p className="form-error" role="alert">{authMutation.error.message}</p>}
          <button className="button button-primary auth-submit" type="submit" disabled={authMutation.isPending}>
            {authMutation.isPending ? 'One moment…' : isRegistering ? 'Create your space' : 'Sign in'}
            {!authMutation.isPending && <ArrowRight size={17} />}
          </button>
        </form>
        <p className="auth-switch">
          {isRegistering ? 'Already have an account?' : 'New to época?'}{' '}
          <button type="button" onClick={() => { setIsRegistering(!isRegistering); authMutation.reset(); }}>
            {isRegistering ? 'Sign in' : 'Create an account'}
          </button>
        </p>
        <div className="auth-footnote"><Check size={15} /> Your work stays private to your account <CircleHelp size={15} aria-hidden="true" /></div>
      </section>
      <aside className="auth-art" aria-label="Organize your day with intention">
        <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
        <span className="art-sparkle sparkle-one">✳</span><span className="art-sparkle sparkle-two">✳</span>
        <div className="art-note">
          <span className="art-note-kicker">A LITTLE MORE CLARITY</span>
          <h2>Make room<br />for what matters.</h2>
          <div className="art-note-rule" />
          <p>Tasks, thoughts, and the spaces between them — all in one place.</p>
          <span className="art-signoff">everything at a glance</span>
        </div>
        <span className="art-caption">A workspace for the life you’re building.</span>
      </aside>
    </main>
  );
}
