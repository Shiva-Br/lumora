'use client';

// Six-box numeric OTP input, matching the "Check your email" design.
//
// Keyboard/a11y behavior: each box is a real input with its own label, so
// screen readers announce position ("Digit 3 of 6"). Typing advances, Backspace
// on an empty box steps back, arrows move, and pasting a 6-digit code fills the
// whole row. `autoComplete="one-time-code"` lets iOS/Safari offer the code from
// the email automatically.
import * as React from 'react';

import { cn } from '@/lib/utils';

const LENGTH = 6;

export type OtpInputClassNames = {
  root: string;
  input: string;
  inputValid: string;
  inputInvalid: string;
};

export function OtpInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  invalid = false,
  groupLabel,
  getDigitLabel,
  classNames,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Fired when the sixth digit lands (typed or pasted). */
  onComplete?: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  groupLabel: string;
  getDigitLabel: (index: number, length: number) => string;
  classNames: OtpInputClassNames;
}) {
  const inputsRef = React.useRef<Array<HTMLInputElement | null>>([]);

  const digits = React.useMemo(
    () => Array.from({ length: LENGTH }, (_, i) => value[i] ?? ''),
    [value]
  );

  const focusBox = (index: number) => {
    const clamped = Math.max(0, Math.min(LENGTH - 1, index));
    inputsRef.current[clamped]?.focus();
    inputsRef.current[clamped]?.select();
  };

  const commit = (next: string) => {
    onChange(next);
    if (next.length === LENGTH) onComplete?.(next);
  };

  const handleChange = (index: number, raw: string) => {
    const typed = raw.replace(/\D/g, '');
    if (!typed) return;

    // Typing into a box replaces that box; a multi-character value (autofill or
    // a fast paste landing in one box) fills forward from here.
    const next = (
      value.slice(0, index) +
      typed +
      value.slice(index + typed.length)
    ).slice(0, LENGTH);

    commit(next);
    focusBox(index + typed.length);
  };

  const handleKeyDown = (
    index: number,
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      if (digits[index]) {
        commit(value.slice(0, index) + value.slice(index + 1));
        return;
      }
      // Empty box — clear the previous one and step back.
      if (index > 0) {
        commit(value.slice(0, index - 1) + value.slice(index));
        focusBox(index - 1);
      }
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusBox(index - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusBox(index + 1);
    }
  };

  const handlePaste = (
    index: number,
    event: React.ClipboardEvent<HTMLInputElement>
  ) => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '');
    if (!pasted) return;
    event.preventDefault();

    const next = (value.slice(0, index) + pasted).slice(0, LENGTH);
    commit(next);
    focusBox(next.length);
  };

  return (
    <div className={classNames.root} role="group" aria-label={groupLabel}>
      {digits.map((digit, index) => (
        <React.Fragment key={index}>
          <label htmlFor={`otp-${index}`} className="sr-only">
            {getDigitLabel(index + 1, LENGTH)}
          </label>
          <input
            id={`otp-${index}`}
            ref={(element) => {
              inputsRef.current[index] = element;
            }}
            type="text"
            inputMode="numeric"
            // Only the first box advertises one-time-code, or browsers offer
            // the autofill chip six times over.
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            // Not maxLength=1: autofill and paste need to deliver 6 characters.
            value={digit}
            onChange={(event) => handleChange(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={(event) => handlePaste(index, event)}
            onFocus={(event) => event.target.select()}
            disabled={disabled}
            aria-invalid={invalid}
            autoFocus={index === 0}
            className={cn(
              classNames.input,
              invalid ? classNames.inputInvalid : classNames.inputValid
            )}
          />
        </React.Fragment>
      ))}
    </div>
  );
}
