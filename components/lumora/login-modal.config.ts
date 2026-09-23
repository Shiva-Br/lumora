import type { AuthFailureKind } from '@/lib/auth/errors';

export type DeepPartial<T> = {
  // `never[]` args: the strict-variance-safe "is a function" test — with
  // `unknown[]` a concrete signature like `(email: string) => string` fails
  // the contravariant parameter check and would be mapped as an object.
  [K in keyof T]?: T[K] extends (...args: never[]) => unknown
    ? T[K]
    : T[K] extends readonly unknown[]
      ? T[K]
      : T[K] extends object
        ? DeepPartial<T[K]>
        : T[K];
};

export type LoginModalMessages = {
  common: {
    closeLabel: string;
    brandName: string;
    dividerLabel: string;
    redirectingLabel: string;
  };
  emailStep: {
    eyebrow: string;
    titleBefore: string;
    titleHighlight: string;
    titleAfter: string;
    subtitle: string;
    emailLabel: string;
    submitLabel: string;
    submittingLabel: string;
    googleLabel: string;
    appleLabel: string;
  };
  otpStep: {
    title: string;
    description: (email: string) => string;
    submitLabel: string;
    submittingLabel: string;
    resendLabel: string;
    resendingLabel: string;
    resendInLabel: (seconds: number) => string;
    changeEmailLabel: string;
  };
  trust: {
    items: string[];
  };
  legal: {
    prefix: string;
    conjunction: string;
    termsLabel: string;
    termsHref: string;
    privacyLabel: string;
    privacyHref: string;
    suffix: string;
  };
  otpInput: {
    groupLabel: string;
    digitLabel: (index: number, length: number) => string;
  };
  errors: Record<AuthFailureKind, string>;
};

export type LoginModalMessageOverrides = DeepPartial<LoginModalMessages>;

export type LoginModalTheme = {
  dialogContent: string;
  viewport: string;
  closeButton: string;
  sceneVignette: string;
  hero: string;
  heroCanvas: string;
  logoLockup: string;
  logoMark: string;
  logoSize: number;
  brandName: string;
  copy: string;
  eyebrow: string;
  title: string;
  emailDescription: string;
  otpDescription: string;
  form: string;
  field: string;
  input: string;
  inputLabel: string;
  primaryButton: string;
  primaryButtonEnabled: string;
  primaryButtonDisabled: string;
  divider: string;
  dividerLine: string;
  dividerLabel: string;
  providerStack: string;
  providerButton: string;
  error: string;
  otpForm: string;
  otpStatus: string;
  otpStatusFilled: string;
  otpStatusEmpty: string;
  otpActions: string;
  secondaryAction: string;
  tertiaryAction: string;
  trustList: string;
  trustItem: string;
  trustIcon: string;
  legal: string;
  legalLink: string;
  otpRoot: string;
  otpInput: string;
  otpInputValid: string;
  otpInputInvalid: string;
};

export const DEFAULT_LOGIN_MODAL_MESSAGES: LoginModalMessages = {
  common: {
    closeLabel: 'Close',
    brandName: 'LUMORA',
    dividerLabel: 'OR',
    redirectingLabel: 'Redirecting…',
  },
  emailStep: {
    eyebrow: 'Beyond Artificial Intelligence',
    titleBefore: 'Welcome to ',
    titleHighlight: 'Lumora',
    titleAfter: '',
    subtitle: 'Welcome to Decision Intelligence.',
    emailLabel: 'Enter your email',
    submitLabel: 'Continue with Email',
    submittingLabel: 'Sending…',
    googleLabel: 'Continue with Google',
    appleLabel: 'Continue with Apple',
  },
  otpStep: {
    title: 'Check your email',
    description: (email) => `Enter the 6-digit code we sent to ${email}.`,
    submitLabel: 'Confirm',
    submittingLabel: 'Verifying…',
    resendLabel: 'Resend code',
    resendingLabel: 'Sending…',
    resendInLabel: (seconds) => `Resend code in ${seconds}s`,
    changeEmailLabel: 'Change email',
  },
  trust: {
    items: [
      'Your conversations stay private.',
      'Your decisions belong to you.',
      'Secure authentication.',
    ],
  },
  legal: {
    prefix: 'By continuing you agree to our',
    conjunction: 'and',
    termsLabel: 'Terms of Service',
    termsHref: '#',
    privacyLabel: 'Privacy Policy',
    privacyHref: '#',
    suffix: '.',
  },
  otpInput: {
    groupLabel: 'Six-digit verification code',
    digitLabel: (index, length) => `Digit ${index} of ${length}`,
  },
  errors: {
    invalid_otp: 'That code is not correct. Check the digits and try again.',
    expired_otp: 'That code has expired. Request a new one to continue.',
    rate_limited: 'Too many attempts. Wait a moment before trying again.',
    provider_unavailable:
      'That sign-in method is not available right now. Continue with email instead.',
    offline: 'You appear to be offline. Check your connection and try again.',
    network: 'We could not reach the server. Check your connection and retry.',
    unknown: 'Something went wrong. Please try again.',
  },
};

export const DEFAULT_LOGIN_MODAL_THEME: LoginModalTheme = {
  dialogContent:
    'data-open:zoom-in-[0.98] data-open:slide-in-from-bottom-4 data-closed:zoom-out-[0.98] data-closed:slide-out-to-bottom-2 fixed !inset-0 z-50 grid h-screen max-h-screen w-screen !max-w-none !translate-x-0 !translate-y-0 gap-0 overflow-y-auto rounded-none bg-[image:var(--vk-auth-backdrop)] p-0 ring-0 duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] data-closed:duration-200 sm:!max-w-none',
  viewport:
    'relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden px-6 pt-8 pb-10 text-center sm:px-10',
  closeButton:
    'absolute top-6 right-6 z-20 inline-flex h-[38px] w-[38px] items-center justify-center rounded-[10px] text-[var(--vk-text-muted)] transition-colors hover:bg-[var(--vk-hover)] hover:text-[var(--vk-text)] focus-visible:outline-2 focus-visible:outline-[var(--vk-accent-ring)] sm:top-8 sm:right-8',
  sceneVignette:
    'pointer-events-none absolute inset-0 z-[1] bg-[image:var(--vk-auth-vignette)]',
  hero: 'relative z-[2] flex h-[clamp(245px,32vh,340px)] w-full max-w-[1180px] flex-none items-center justify-center overflow-visible max-[850px]:h-[245px] max-[720px]:h-[205px] max-[520px]:h-[230px]',
  heroCanvas: 'absolute inset-0 h-full w-full',
  logoLockup:
    'relative z-[2] flex flex-col items-center gap-[5px] transition-[filter,transform] duration-700 ease-[cubic-bezier(.2,.9,.2,1)]',
  logoMark:
    'drop-shadow-[0_0_34px_rgba(242,193,78,0.30)] motion-safe:[animation:vk-auth-mark-breath_7s_ease-in-out_infinite]',
  logoSize: 175,
  brandName:
    'ps-[0.32em] text-[clamp(20px,2vw,28px)] font-extrabold tracking-[0.32em] text-[#F6FAFD] max-[850px]:text-[21px] max-[720px]:text-[18px]',
  copy: 'mt-[2px] flex max-w-[520px] flex-col items-center opacity-0 [animation:vk-auth-rise_1.4s_.3s_forwards]',
  eyebrow:
    'mt-[9px] text-[12px] font-bold tracking-[0.06em] text-[#6E90AC] uppercase max-[720px]:mt-[6px] max-[720px]:text-[10.5px]',
  title:
    'text-balance text-[clamp(27px,3vw,38px)] leading-[1.05] font-light tracking-[-0.02em] text-[var(--vk-text-strong)]',
  emailDescription:
    'mt-1 text-[13.5px] leading-[1.2] font-semibold text-[var(--vk-gold-soft)] max-[720px]:mt-[3px] max-[720px]:text-[12px]',
  otpDescription:
    'mt-5 max-w-[46ch] text-[14.5px] leading-[1.65] text-[var(--vk-text-muted)]',
  form: 'mt-[18px] flex w-full max-w-[min(360px,92%)] flex-col gap-2 opacity-0 [animation:vk-auth-rise_1.6s_.7s_forwards] max-[720px]:mt-[10px]',
  field: 'relative',
  input:
    'peer h-[46px] w-full rounded-[13px] border border-[var(--vk-border)] bg-[image:var(--vk-glass-soft)] px-4 pt-[15px] pb-[5px] text-start text-[14.5px] text-[#EAF2F8] outline-none transition-[border-color,box-shadow] duration-[var(--vk-duration-fast)] ease-[var(--vk-ease-standard)] placeholder:text-transparent focus-visible:border-[rgba(var(--vk-accent-rgb),0.45)] focus-visible:shadow-[0_0_0_4px_rgba(var(--vk-accent-rgb),0.08)] disabled:cursor-not-allowed disabled:opacity-60',
  inputLabel:
    'pointer-events-none absolute top-[14px] left-4 right-4 text-start text-[14px] text-[var(--vk-placeholder)] transition-all duration-200 ease-[var(--vk-ease-standard)] [transform-origin:left_top] peer-focus:translate-y-[-11px] peer-focus:scale-[0.72] peer-focus:text-[var(--vk-gold-soft)] peer-[:not(:placeholder-shown)]:translate-y-[-11px] peer-[:not(:placeholder-shown)]:scale-[0.72] peer-[:not(:placeholder-shown)]:text-[var(--vk-gold-soft)]',
  primaryButton:
    'inline-flex h-11 w-full items-center justify-center rounded-[13px] text-[13.5px] font-bold tracking-[0.01em] transition-[transform,box-shadow,background] duration-[var(--vk-duration-fast)] ease-[var(--vk-ease-standard)] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[var(--vk-accent)]',
  primaryButtonEnabled:
    'cursor-pointer bg-[linear-gradient(150deg,var(--vk-accent-top),var(--vk-accent))] text-[var(--vk-accent-text)] shadow-[var(--vk-shadow-accent)] hover:-translate-y-px hover:shadow-[var(--vk-shadow-accent-hover)] active:translate-y-0 active:shadow-[var(--vk-shadow-accent)]',
  primaryButtonDisabled:
    'cursor-not-allowed bg-[var(--vk-surface-3)] text-[var(--vk-placeholder)] shadow-none',
  divider: 'my-[2px] flex items-center gap-3',
  dividerLine:
    'h-px flex-1 bg-[linear-gradient(90deg,transparent,rgba(var(--vk-border-rgb),0.18),transparent)]',
  dividerLabel:
    'text-[10px] font-bold tracking-[0.28em] text-[var(--vk-note-quiet)] uppercase',
  providerStack: 'flex flex-col gap-2',
  providerButton:
    'inline-flex h-11 w-full items-center justify-center gap-[11px] rounded-[13px] border border-[var(--vk-border)] bg-[rgba(255,255,255,0.03)] px-4 text-[14px] font-medium text-[#E7EFF6] transition-[transform,border-color,background-color,color] duration-[var(--vk-duration-fast)] ease-[var(--vk-ease-standard)] hover:bg-[rgba(255,255,255,0.06)] hover:border-[rgba(var(--vk-border-rgb),0.28)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--vk-accent-ring)] disabled:cursor-not-allowed disabled:opacity-60',
  error: 'text-center text-[13px] text-[var(--vk-danger)]',
  otpForm:
    'mt-[18px] flex w-full max-w-[min(360px,92%)] flex-col gap-4 opacity-0 [animation:vk-auth-rise_1.6s_.5s_forwards]',
  otpStatus: 'min-h-[18px] text-center text-[13px]',
  otpStatusFilled: 'text-[var(--vk-danger)]',
  otpStatusEmpty: 'text-transparent',
  otpActions: 'mt-2 flex flex-col items-center gap-3',
  secondaryAction:
    'cursor-pointer text-[13px] text-[var(--vk-text-muted)] underline decoration-[rgba(var(--vk-border-rgb),0.26)] underline-offset-2 transition-colors hover:text-[var(--vk-text)] disabled:cursor-not-allowed disabled:no-underline disabled:opacity-60',
  tertiaryAction:
    'cursor-pointer text-[13px] text-[var(--vk-text-muted)] transition-colors hover:text-[var(--vk-text)] disabled:cursor-not-allowed disabled:opacity-60',
  trustList:
    'mt-4 flex flex-wrap items-center justify-center gap-x-[14px] gap-y-3 opacity-0 [animation:vk-auth-rise_1.8s_1.05s_forwards]',
  trustItem: 'inline-flex items-center gap-[7px] text-[11px] text-[#6D8496]',
  trustIcon: 'h-[13px] w-[13px] text-[#6E90AC]',
  legal:
    'mt-[10px] text-center text-[10.5px] leading-[1.4] text-[#556D80] opacity-0 [animation:vk-auth-rise_1.9s_1.3s_forwards]',
  legalLink:
    'border-b border-[rgba(140,170,200,0.25)] text-[#7F95A8] transition-colors hover:text-[#C7D6E2]',
  otpRoot: 'flex items-center justify-center gap-2',
  otpInput:
    'h-[52px] w-[46px] rounded-[12px] border bg-[image:var(--vk-glass-strong)] text-center text-[19px] font-medium text-[var(--vk-text)] outline-none transition-[border-color,box-shadow] duration-[var(--vk-duration-fast)] ease-[var(--vk-ease-standard)] focus-visible:border-[rgba(var(--vk-accent-rgb),0.46)] focus-visible:shadow-[0_0_0_4px_rgba(var(--vk-accent-rgb),0.08)] disabled:cursor-not-allowed disabled:opacity-60',
  otpInputValid: 'border-[rgba(var(--vk-border-rgb),0.2)]',
  otpInputInvalid: 'border-[var(--vk-danger)]',
};

export function resolveLoginModalMessages(
  overrides?: LoginModalMessageOverrides
): LoginModalMessages {
  return {
    common: { ...DEFAULT_LOGIN_MODAL_MESSAGES.common, ...overrides?.common },
    emailStep: {
      ...DEFAULT_LOGIN_MODAL_MESSAGES.emailStep,
      ...overrides?.emailStep,
    },
    otpStep: {
      ...DEFAULT_LOGIN_MODAL_MESSAGES.otpStep,
      ...overrides?.otpStep,
    },
    trust: {
      items:
        overrides?.trust?.items ?? DEFAULT_LOGIN_MODAL_MESSAGES.trust.items,
    },
    legal: { ...DEFAULT_LOGIN_MODAL_MESSAGES.legal, ...overrides?.legal },
    otpInput: {
      ...DEFAULT_LOGIN_MODAL_MESSAGES.otpInput,
      ...overrides?.otpInput,
    },
    errors: { ...DEFAULT_LOGIN_MODAL_MESSAGES.errors, ...overrides?.errors },
  };
}

export function resolveLoginModalTheme(
  overrides?: Partial<LoginModalTheme>
): LoginModalTheme {
  return { ...DEFAULT_LOGIN_MODAL_THEME, ...overrides };
}
