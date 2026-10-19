import { useEffect, useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { AlertCircle, CheckCircle2, Loader2, LogIn, UserPlus } from 'lucide-react';
import { useApp } from '@/app/AppContext';
import { Button, FieldError, Modal } from '@/components/ui';
import { ApiError } from '@/services/api';

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email address.').email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Enter your full name.')
      .max(100, 'Name must be 100 characters or fewer.'),
    email: z
      .string()
      .trim()
      .min(1, 'Enter your email address.')
      .email('Enter a valid email address.')
      .max(254, 'Email must be 254 characters or fewer.'),
    password: z
      .string()
      .min(10, 'Password must be at least 10 characters.')
      .max(128, 'Password must be 128 characters or fewer.')
      .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, 'Password must contain at least one letter and one digit.'),
    confirmPassword: z.string().min(1, 'Please confirm your password.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });

type LoginForm = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;

export function AuthModal() {
  const { authModal, closeAuthModal, login, register: signup } = useApp();
  const [mode, setMode] = useState<'login' | 'register'>(authModal.mode);
  const [apiError, setApiError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sync mode whenever modal is opened
  useEffect(() => {
    if (authModal.open) {
      setMode(authModal.mode);
      setApiError(null);
      setSuccessMessage(null);
    }
  }, [authModal.open, authModal.mode]);

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });

  const onLoginSubmit = loginForm.handleSubmit(async (values) => {
    setApiError(null);
    setSuccessMessage(null);
    try {
      await login(values);
      loginForm.reset();
      closeAuthModal();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401 || err.code === 'INVALID_CREDENTIALS') {
          setApiError('Incorrect email or password. Please verify your credentials.');
        } else {
          setApiError(err.message || 'Unable to sign in. Please try again.');
        }
      } else {
        setApiError('Unable to sign in. Please verify your network connection.');
      }
    }
  });

  const onRegisterSubmit = registerForm.handleSubmit(async (values) => {
    setApiError(null);
    setSuccessMessage(null);
    try {
      await signup({
        name: values.name.trim(),
        email: values.email.trim(),
        password: values.password,
      });
      registerForm.reset();
      setSuccessMessage('Account created successfully! Connecting your session…');
      window.setTimeout(() => {
        closeAuthModal();
      }, 700);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409 || err.code === 'EMAIL_ALREADY_REGISTERED') {
          setApiError('An account with this email address already exists. Please sign in or use another email.');
        } else if (err.fieldErrors && err.fieldErrors.length > 0) {
          const detail = err.fieldErrors.map((f) => `${f.field}: ${f.message}`).join(', ');
          setApiError(`Registration rejected: ${detail}`);
        } else {
          setApiError(err.message || 'Registration failed. Please check the details entered.');
        }
      } else {
        setApiError('Unable to connect to the server to create your account. Please check your network.');
      }
    }
  });

  const isSubmitting = loginForm.formState.isSubmitting || registerForm.formState.isSubmitting;

  return (
    <Modal
      open={authModal.open}
      onClose={closeAuthModal}
      title={mode === 'login' ? 'Sign in to NutriTrack' : 'Create your NutriTrack account'}
      subtitle={
        mode === 'login'
          ? 'Connect to sync your diary, goals, and nutrition records.'
          : 'Start syncing your health journey securely with your account.'
      }
    >
      <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
        <Button
          type="button"
          tone={mode === 'login' ? 'primary' : 'secondary'}
          size="sm"
          style={{ flex: 1 }}
          onClick={() => {
            setMode('login');
            setApiError(null);
            setSuccessMessage(null);
          }}
        >
          <LogIn size={15} /> Sign In
        </Button>
        <Button
          type="button"
          tone={mode === 'register' ? 'primary' : 'secondary'}
          size="sm"
          style={{ flex: 1 }}
          onClick={() => {
            setMode('register');
            setApiError(null);
            setSuccessMessage(null);
          }}
        >
          <UserPlus size={15} /> Create Account
        </Button>
      </div>

      {successMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            marginBottom: '14px',
            borderRadius: '8px',
            background: 'rgba(34, 197, 94, 0.12)',
            color: '#15803d',
            fontSize: '0.875rem',
            fontWeight: 500,
          }}
          role="status"
        >
          <CheckCircle2 size={16} />
          <span>{successMessage}</span>
        </div>
      )}

      {apiError && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            marginBottom: '14px',
            borderRadius: '8px',
            background: 'rgba(239, 68, 68, 0.1)',
            color: '#b91c1c',
            fontSize: '0.875rem',
          }}
          role="alert"
        >
          <AlertCircle size={16} />
          <span>{apiError}</span>
        </div>
      )}

      {mode === 'login' ? (
        <form onSubmit={onLoginSubmit} className="form-stack">
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              {...loginForm.register('email')}
            />
            {loginForm.formState.errors.email && (
              <FieldError>{loginForm.formState.errors.email.message}</FieldError>
            )}
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              {...loginForm.register('password')}
            />
            {loginForm.formState.errors.password && (
              <FieldError>{loginForm.formState.errors.password.message}</FieldError>
            )}
          </label>

          <div className="modal-actions" style={{ marginTop: '14px' }}>
            <Button type="button" tone="secondary" onClick={closeAuthModal} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 size={15} className="spin" /> Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </div>

          <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.875rem', color: '#6b7280' }}>
            Don’t have an account?{' '}
            <button
              type="button"
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: '#15803d',
                fontWeight: 600,
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
              onClick={() => {
                setMode('register');
                setApiError(null);
                setSuccessMessage(null);
              }}
            >
              Create account
            </button>
          </p>
        </form>
      ) : (
        <form onSubmit={onRegisterSubmit} className="form-stack">
          <label className="field">
            <span>Full Name</span>
            <input
              type="text"
              autoComplete="name"
              placeholder="Alex Morgan"
              {...registerForm.register('name')}
            />
            {registerForm.formState.errors.name && (
              <FieldError>{registerForm.formState.errors.name.message}</FieldError>
            )}
          </label>

          <label className="field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              {...registerForm.register('email')}
            />
            {registerForm.formState.errors.email && (
              <FieldError>{registerForm.formState.errors.email.message}</FieldError>
            )}
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="new-password"
              placeholder="At least 10 chars, with 1 letter & 1 digit"
              {...registerForm.register('password')}
            />
            <small style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '2px' }}>
              Minimum 10 characters, including at least one letter and one number.
            </small>
            {registerForm.formState.errors.password && (
              <FieldError>{registerForm.formState.errors.password.message}</FieldError>
            )}
          </label>

          <label className="field">
            <span>Confirm Password</span>
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Re-enter your password"
              {...registerForm.register('confirmPassword')}
            />
            {registerForm.formState.errors.confirmPassword && (
              <FieldError>{registerForm.formState.errors.confirmPassword.message}</FieldError>
            )}
          </label>

          <div className="modal-actions" style={{ marginTop: '14px' }}>
            <Button type="button" tone="secondary" onClick={closeAuthModal} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 size={15} className="spin" /> Creating account…
                </>
              ) : (
                'Create account'
              )}
            </Button>
          </div>

          <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.875rem', color: '#6b7280' }}>
            Already have an account?{' '}
            <button
              type="button"
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: '#15803d',
                fontWeight: 600,
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
              onClick={() => {
                setMode('login');
                setApiError(null);
                setSuccessMessage(null);
              }}
            >
              Sign in
            </button>
          </p>
        </form>
      )}
    </Modal>
  );
}
