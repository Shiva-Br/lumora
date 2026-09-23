'use client';

// Lumora login modal.
//
// Auth flow stays here, while copy and visual slots come from config so the
// modal can be localized or rethemed without rewriting JSX.
import * as React from 'react';

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  sendEmailOtp,
  signInWithProvider,
  verifyEmailOtp,
  type OAuthProvider,
} from '@/lib/auth/actions';
import type { AuthFailure } from '@/lib/auth/errors';
import { isValidEmail } from '@/lib/auth/validation';
import { cn } from '@/lib/utils';

import { LoginGalaxyCanvas } from './login-galaxy-canvas';
import {
  resolveLoginModalMessages,
  resolveLoginModalTheme,
  type LoginModalMessageOverrides,
  type LoginModalMessages,
  type LoginModalTheme,
} from './login-modal.config';
import { LogoMark } from './logo';
import { OtpInput } from './otp-input';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

type Step = 'email' | 'otp';
type Busy = null | 'sending' | 'verifying' | 'resending' | OAuthProvider;

export type {
  LoginModalMessageOverrides,
  LoginModalMessages,
  LoginModalTheme,
} from './login-modal.config';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.06 12.25c0-.85-.08-1.67-.22-2.45H12v4.64h6.2a5.3 5.3 0 0 1-2.3 3.48v2.9h3.72c2.18-2 3.44-4.96 3.44-8.57Z"
      />
      <path
        fill="#34A853"
        d="M12 23.5c3.11 0 5.72-1.03 7.62-2.79l-3.72-2.89c-1.03.69-2.35 1.1-3.9 1.1-3 0-5.54-2.03-6.45-4.75H1.7v2.98A11.5 11.5 0 0 0 12 23.5Z"
      />
      <path
        fill="#FBBC05"
        d="M5.55 14.17a6.9 6.9 0 0 1 0-4.34V6.85H1.7a11.5 11.5 0 0 0 0 10.3l3.85-2.98Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.08c1.69 0 3.2.58 4.4 1.72l3.3-3.3C17.72 1.63 15.1.5 12 .5A11.5 11.5 0 0 0 1.7 6.85l3.85 2.98C6.46 7.11 9 5.08 12 5.08Z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M16.36 12.72c.02 2.62 2.3 3.49 2.33 3.5-.02.07-.36 1.24-1.2 2.45-.72 1.05-1.47 2.1-2.65 2.12-1.16.02-1.53-.69-2.86-.69-1.32 0-1.74.67-2.83.71-1.14.04-2.01-1.13-2.73-2.18-1.48-2.15-2.6-6.07-1.09-8.71.75-1.32 2.1-2.15 3.56-2.17 1.11-.02 2.17.75 2.85.75.68 0 1.96-.93 3.31-.79.56.02 2.14.23 3.16 1.72-.08.05-1.88 1.1-1.85 3.29ZM14.2 4.62c.6-.73 1.01-1.75.9-2.76-.87.03-1.92.58-2.54 1.31-.56.64-1.05 1.68-.92 2.67.97.08 1.96-.49 2.56-1.22Z" />
    </svg>
  );
}

function LockIcon({ className }: { className: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function ShieldIcon({ className }: { className: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" />
    </svg>
  );
}

function CheckIcon({ className }: { className: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12l4 4 10-11" />
    </svg>
  );
}

const TRUST_ICONS = [LockIcon, ShieldIcon, CheckIcon] as const;

function messageForFailure(
  failure: AuthFailure | null,
  messages: LoginModalMessages
) {
  return failure ? messages.errors[failure.kind] : null;
}

export function LoginModal({
  open,
  onOpenChange,
  onAuthenticated,
  messages: messageOverrides,
  theme: themeOverrides,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fired once a Supabase session exists (email OTP verified). */
  onAuthenticated?: () => void;
  messages?: LoginModalMessageOverrides;
  theme?: Partial<LoginModalTheme>;
}) {
  const messages = resolveLoginModalMessages(messageOverrides);
  const theme = resolveLoginModalTheme(themeOverrides);

  const [step, setStep] = React.useState<Step>('email');
  const [email, setEmail] = React.useState('');
  const [code, setCode] = React.useState('');
  const [busy, setBusy] = React.useState<Busy>(null);
  const [failure, setFailure] = React.useState<AuthFailure | null>(null);
  const [cooldown, setCooldown] = React.useState(0);

  const emailValid = isValidEmail(email);
  const codeComplete = code.length === OTP_LENGTH;

  const verifyingRef = React.useRef(false);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(
      () => setCooldown((seconds) => seconds - 1),
      1000
    );
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  React.useEffect(() => {
    if (open) return;
    const timer = window.setTimeout(() => {
      setStep('email');
      setCode('');
      setBusy(null);
      setFailure(null);
      setCooldown(0);
      verifyingRef.current = false;
    }, 200);
    return () => window.clearTimeout(timer);
  }, [open]);

  const handleSendCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!emailValid || busy) return;

    setBusy('sending');
    setFailure(null);

    const result = await sendEmailOtp(email.trim());

    if (result.ok) {
      setBusy(null);
      setStep('otp');
      setCode('');
      setCooldown(RESEND_COOLDOWN_SECONDS);
      return;
    }

    setBusy(null);
    setFailure(result.failure);
    if (result.failure.kind === 'rate_limited') {
      setCooldown(RESEND_COOLDOWN_SECONDS);
    }
  };

  const handleVerify = React.useCallback(
    async (value: string) => {
      if (value.length !== OTP_LENGTH) return;
      if (verifyingRef.current) return;

      verifyingRef.current = true;
      setBusy('verifying');
      setFailure(null);

      const result = await verifyEmailOtp(email.trim(), value);

      verifyingRef.current = false;
      setBusy(null);

      if (result.ok) {
        onAuthenticated?.();
        return;
      }

      setFailure(result.failure);
      setCode('');
    },
    [email, onAuthenticated]
  );

  const handleResend = async () => {
    if (busy || cooldown > 0) return;

    setBusy('resending');
    setFailure(null);

    const result = await sendEmailOtp(email.trim());

    setBusy(null);
    setCode('');
    setCooldown(RESEND_COOLDOWN_SECONDS);

    if (!result.ok) setFailure(result.failure);
  };

  const handleProvider = async (provider: OAuthProvider) => {
    if (busy) return;

    setBusy(provider);
    setFailure(null);

    const result = await signInWithProvider(provider);

    if (!result.ok) {
      setBusy(null);
      setFailure(result.failure);
    }
  };

  const handleChangeEmail = () => {
    if (busy) return;
    setStep('email');
    setCode('');
    setFailure(null);
  };

  const errorMessage = messageForFailure(failure, messages);
  const description =
    step === 'email'
      ? messages.emailStep.subtitle
      : messages.otpStep.description(email.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className={theme.dialogContent}>
        <DialogClose asChild>
          <button
            type="button"
            aria-label={messages.common.closeLabel}
            className={theme.closeButton}
          >
            <svg
              width="19"
              height="19"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </DialogClose>

        <div className={theme.viewport}>
          <div aria-hidden="true" className={theme.sceneVignette} />

          <div className={theme.hero}>
            <LoginGalaxyCanvas
              className={theme.heroCanvas}
              logoDiameter={theme.logoSize}
            />

            <div className={theme.logoLockup}>
              <LogoMark
                size={theme.logoSize}
                className={theme.logoMark}
                priority
              />
              <span className={theme.brandName}>
                {messages.common.brandName}
              </span>
            </div>
          </div>

          <div className={theme.copy}>
            <DialogTitle className={theme.title}>
              {step === 'email' ? (
                <>
                  {messages.emailStep.titleBefore}
                  <strong className="font-bold">
                    {messages.emailStep.titleHighlight}
                  </strong>
                  {messages.emailStep.titleAfter}
                </>
              ) : (
                messages.otpStep.title
              )}
            </DialogTitle>

            {step === 'email' && (
              <p className={theme.eyebrow}>{messages.emailStep.eyebrow}</p>
            )}

            <DialogDescription
              className={
                step === 'email' ? theme.emailDescription : theme.otpDescription
              }
            >
              {description}
            </DialogDescription>
          </div>

          {step === 'email' ? (
            <>
              <form onSubmit={handleSendCode} className={theme.form} noValidate>
                <div className={theme.field}>
                  <input
                    id="login-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder=" "
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      if (failure) setFailure(null);
                    }}
                    aria-invalid={Boolean(failure)}
                    disabled={busy !== null}
                    className={theme.input}
                  />
                  <label htmlFor="login-email" className={theme.inputLabel}>
                    {messages.emailStep.emailLabel}
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={!emailValid || busy !== null}
                  className={cn(
                    theme.primaryButton,
                    emailValid && busy === null
                      ? theme.primaryButtonEnabled
                      : theme.primaryButtonDisabled
                  )}
                >
                  {busy === 'sending'
                    ? messages.emailStep.submittingLabel
                    : messages.emailStep.submitLabel}
                </button>

                <div className={theme.divider}>
                  <span className={theme.dividerLine} />
                  <span className={theme.dividerLabel}>
                    {messages.common.dividerLabel}
                  </span>
                  <span className={theme.dividerLine} />
                </div>

                <div className={theme.providerStack}>
                  <button
                    type="button"
                    onClick={() => void handleProvider('google')}
                    disabled={busy !== null}
                    className={theme.providerButton}
                  >
                    <GoogleIcon />
                    {busy === 'google'
                      ? messages.common.redirectingLabel
                      : messages.emailStep.googleLabel}
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleProvider('apple')}
                    disabled={busy !== null}
                    className={theme.providerButton}
                  >
                    <AppleIcon />
                    {busy === 'apple'
                      ? messages.common.redirectingLabel
                      : messages.emailStep.appleLabel}
                  </button>
                </div>

                {errorMessage && (
                  <p role="alert" className={theme.error}>
                    {errorMessage}
                  </p>
                )}
              </form>

              <div className={theme.trustList}>
                {messages.trust.items.map((item, index) => {
                  const Icon = TRUST_ICONS[index] ?? ShieldIcon;
                  return (
                    <span key={item} className={theme.trustItem}>
                      <Icon className={theme.trustIcon} />
                      <span>{item}</span>
                    </span>
                  );
                })}
              </div>

              <p className={theme.legal}>
                {messages.legal.prefix}{' '}
                <a href={messages.legal.termsHref} className={theme.legalLink}>
                  {messages.legal.termsLabel}
                </a>{' '}
                {messages.legal.conjunction}{' '}
                <a
                  href={messages.legal.privacyHref}
                  className={theme.legalLink}
                >
                  {messages.legal.privacyLabel}
                </a>
                {messages.legal.suffix}
              </p>
            </>
          ) : (
            <>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleVerify(code);
                }}
                className={theme.otpForm}
                noValidate
              >
                <OtpInput
                  value={code}
                  onChange={(next) => {
                    setCode(next);
                    if (failure) setFailure(null);
                  }}
                  onComplete={(next) => void handleVerify(next)}
                  disabled={busy === 'verifying'}
                  invalid={
                    failure?.kind === 'invalid_otp' ||
                    failure?.kind === 'expired_otp'
                  }
                  groupLabel={messages.otpInput.groupLabel}
                  getDigitLabel={messages.otpInput.digitLabel}
                  classNames={{
                    root: theme.otpRoot,
                    input: theme.otpInput,
                    inputValid: theme.otpInputValid,
                    inputInvalid: theme.otpInputInvalid,
                  }}
                />

                <button
                  type="submit"
                  disabled={!codeComplete || busy !== null}
                  className={cn(
                    theme.primaryButton,
                    codeComplete && busy === null
                      ? theme.primaryButtonEnabled
                      : theme.primaryButtonDisabled
                  )}
                >
                  {busy === 'verifying'
                    ? messages.otpStep.submittingLabel
                    : messages.otpStep.submitLabel}
                </button>

                <p
                  role="alert"
                  aria-live="polite"
                  className={cn(
                    theme.otpStatus,
                    errorMessage ? theme.otpStatusFilled : theme.otpStatusEmpty
                  )}
                >
                  {errorMessage ?? ''}
                </p>
              </form>

              <div className={theme.otpActions}>
                <button
                  type="button"
                  onClick={() => void handleResend()}
                  disabled={busy !== null || cooldown > 0}
                  className={theme.secondaryAction}
                >
                  {busy === 'resending'
                    ? messages.otpStep.resendingLabel
                    : cooldown > 0
                      ? messages.otpStep.resendInLabel(cooldown)
                      : messages.otpStep.resendLabel}
                </button>

                <button
                  type="button"
                  onClick={handleChangeEmail}
                  disabled={busy !== null}
                  className={theme.tertiaryAction}
                >
                  {messages.otpStep.changeEmailLabel}
                </button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
