'use client';

import { Check, X } from 'lucide-react';
import * as React from 'react';

import type {
  Question,
  QuestionChoice,
  RequirementPayload,
} from '@/lib/api/types';
import { useT } from '@/lib/i18n/provider';
import { cn } from '@/lib/utils';

/**
 * Per-question selected option ids. For choice questions these are choice
 * ids; for free-text questions the picked example string doubles as the id.
 */
export type AnswerSelection = Record<string, string[]>;

function choiceLabel(question: Question, optionId: string): string {
  // Falls through to the raw id for example picks (id === label).
  return question.choices?.find((c) => c.id === optionId)?.label ?? optionId;
}

/**
 * The pill options for a question: backend `choices` for choice inputs,
 * backend `examples` (verbatim) for free-text inputs.
 */
function pillOptions(question: Question): QuestionChoice[] {
  if (
    question.input_kind === 'single_choice' ||
    question.input_kind === 'multi_choice'
  ) {
    return question.choices ?? [];
  }
  return (question.examples ?? []).map((example) => ({
    id: example,
    label: example,
  }));
}

/**
 * Compose the user's picks into the plain message the contract expects.
 * The backend extracts answers from conversational text, so selections are
 * spelled out as "Label: choice" lines; free text rides along verbatim.
 */
export function composeAnswerMessage(
  questions: Question[],
  selection: AnswerSelection,
  freeText: string
): string {
  const lines: string[] = [];
  for (const question of questions) {
    const picked = selection[question.id];
    if (!picked?.length) continue;
    const labels = picked.map((id) => choiceLabel(question, id));
    lines.push(`${question.label || question.title}: ${labels.join(', ')}`);
  }
  const typed = freeText.trim();
  if (typed) lines.push(typed);
  return lines.join('\n');
}

/**
 * Compact, removable summary of the current picks — rendered above the
 * composer so the user sees exactly what will be sent before pressing send
 * (the same "Label: choice" pairs composeAnswerMessage will spell out).
 * Clicking a chip deselects that pick. Renders nothing without picks.
 */
export function SelectedAnswers({
  questions,
  selection,
  onRemove,
  className,
}: {
  questions: Question[];
  selection: AnswerSelection;
  onRemove: (question: Question, optionId: string) => void;
  className?: string;
}) {
  const t = useT();
  const picks = questions.flatMap((question) =>
    (selection[question.id] ?? []).map((optionId) => ({ question, optionId }))
  );
  if (picks.length === 0) return null;

  return (
    <div
      role="group"
      aria-label={t('chat.selectedAnswers')}
      className={cn('flex flex-wrap gap-1.5', className)}
    >
      {picks.map(({ question, optionId }) => {
        const name = question.label || question.title;
        const value = choiceLabel(question, optionId);
        return (
          <button
            key={`${question.id}:${optionId}`}
            type="button"
            onClick={() => onRemove(question, optionId)}
            aria-label={`Remove ${name}: ${value}`}
            className="group inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[rgba(232,137,46,0.4)] bg-[rgba(232,137,46,0.1)] py-1 pr-2 pl-2.5 text-[11.5px] font-medium text-[var(--vk-gold-soft)] transition-colors outline-none hover:border-[rgba(232,137,46,0.58)] hover:bg-[rgba(232,137,46,0.16)] focus-visible:border-[var(--vk-accent)] focus-visible:shadow-[0_0_0_3px_var(--vk-accent-ring)]"
          >
            <span className="text-[10px] font-bold tracking-[0.05em] text-[var(--vk-accent-hover)] uppercase">
              {name}
            </span>
            <span>{value}</span>
            <X
              size={12}
              strokeWidth={2.4}
              aria-hidden="true"
              className="text-[var(--vk-accent-hover)] transition-colors group-hover:text-[var(--vk-gold-soft)]"
            />
          </button>
        );
      })}
    </div>
  );
}

function AnswerPills({
  question,
  options,
  selected,
  disabled,
  onToggle,
}: {
  question: Question;
  options: QuestionChoice[];
  selected: string[];
  disabled: boolean;
  onToggle: (optionId: string) => void;
}) {
  const multi = question.input_kind === 'multi_choice';
  const freeText = question.input_kind === 'free_text';
  return (
    <div
      role="group"
      aria-label={question.title}
      className="mt-2.5 flex flex-wrap gap-2"
    >
      {options.map((option) => {
        const isSelected = selected.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            aria-pressed={isSelected}
            onClick={() => onToggle(option.id)}
            className={cn(
              'inline-flex min-h-[36px] cursor-pointer items-center gap-[7px] rounded-full border px-3 py-[7px] text-[12.5px] font-medium transition-colors outline-none',
              'focus-visible:border-[var(--vk-accent)] focus-visible:shadow-[0_0_0_3px_var(--vk-accent-ring)]',
              'disabled:cursor-not-allowed disabled:opacity-60',
              isSelected
                ? 'border-[rgba(232,137,46,0.46)] bg-[rgba(232,137,46,0.12)] text-[var(--vk-gold-soft)]'
                : 'border-[rgba(150,178,205,0.2)] bg-[rgba(150,178,205,0.06)] text-[var(--vk-text-subtle)] hover:border-[rgba(150,178,205,0.34)] hover:text-[var(--vk-text-strong)]'
            )}
          >
            {isSelected && (
              <Check size={13} strokeWidth={2.6} aria-hidden="true" />
            )}
            {option.label}
          </button>
        );
      })}
      {multi && (
        <span className="self-center text-[11px] text-[var(--vk-text-faint)]">
          Choose any that apply
        </span>
      )}
      {freeText && !disabled && (
        <span className="self-center text-[11px] text-[var(--vk-text-faint)]">
          Pick one or type your own below
        </span>
      )}
    </div>
  );
}

export function RequirementQuestions({
  payload,
  interactive,
  selection,
  onToggleChoice,
}: {
  payload: RequirementPayload;
  /** Only the latest question set accepts input; history renders read-only. */
  interactive: boolean;
  selection: AnswerSelection;
  onToggleChoice: (question: Question, optionId: string) => void;
}) {
  const t = useT();
  const questions = payload.questions ?? [];

  return (
    <div>
      {payload.intro && (
        <p className="m-0 text-[15px] leading-[1.6] break-words text-[var(--vk-text-subtle)]">
          {payload.intro}
        </p>
      )}

      <div className={cn('grid gap-2.5', payload.intro && 'mt-3')}>
        {questions.map((question) => {
          const knownInput =
            question.input_kind === 'free_text' ||
            question.input_kind === 'single_choice' ||
            question.input_kind === 'multi_choice';
          const options = knownInput ? pillOptions(question) : [];

          return (
            <div
              key={question.id}
              className="bg-[rgba(249, 248, 242, 0.5)] rounded-[13px] px-3 py-2.5"
            >
              {question.label && (
                <div className="flex justify-between gap-3 text-[11px] font-bold tracking-[0.07em] text-[var(--vk-text-muted)] uppercase">
                  <span>{question.label}</span>
                  {question.required && interactive && (
                    <span className="font-semibold normal-case">
                      {t('chat.required')}
                    </span>
                  )}
                </div>
              )}
              <div
                className={cn(
                  'text-sm font-semibold break-words text-[var(--vk-text-strong)]',
                  question.label && 'mt-1.5'
                )}
              >
                {question.title}
              </div>
              {question.helper && (
                <div className="mt-[3px] text-xs leading-[1.45] break-words text-[var(--vk-text-muted)]">
                  {question.helper}
                </div>
              )}

              {options.length > 0 && (
                <AnswerPills
                  question={question}
                  options={options}
                  selected={selection[question.id] ?? []}
                  disabled={!interactive}
                  onToggle={(optionId) => onToggleChoice(question, optionId)}
                />
              )}
              {((knownInput && options.length === 0) || !knownInput) &&
                interactive && (
                  // Free text without examples, or an input kind this client
                  // does not know yet — never block the flow; the composer
                  // accepts any answer.
                  <div className="mt-2 text-xs text-[var(--vk-text-muted)]">
                    Answer in your own words below.
                  </div>
                )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
