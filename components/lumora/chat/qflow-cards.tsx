'use client';

import * as React from 'react';

import type { FactorPreview } from '@/components/lumora/chat/activity-tracker';
import type { FlowQuestion, QFlowAnswer, QuestionFlow } from '@/lib/api/types';
import { useT } from '@/lib/i18n/provider';
import { useReducedMotion } from '@/lib/motion';
import { resolveWorldContext } from '@/lib/taxonomy/resolve';
import { cn } from '@/lib/utils';

const HOLD_MS = 340;
const LEAVE_MS = 240;
const GAP_MS = 110;

interface QFlowCardsProps {
  flow: QuestionFlow;
  category: string;
  /** Submit the collected answers as one structured turn. */
  onSubmit: (answers: QFlowAnswer[]) => void;

  onEditServer: (questionId: string) => void;
  /**
   * Reports the CURRENT local answer set (replace-all semantics) every time
   * it changes — answer, skip, or edit-rewind — so the screen can preview
   * those factors in Known factors before the backend echo.
   */
  onPreview?: (entries: FactorPreview[]) => void;

  flyTargetRef?: React.RefObject<HTMLDivElement | null>;
  disabled?: boolean;
}

interface LocalAnswer {
  display: string;
  answer: QFlowAnswer;
  tags: string[];
}

function tagsFor(q: FlowQuestion, labels: string[]): string[] {
  const out: string[] = [];
  for (const label of labels) {
    const opt = q.options?.find((o) => o.label === label);
    if (opt?.tags?.length) out.push(...opt.tags);
    else out.push(`${q.factor}: ${label}`);
  }
  return out;
}

export function QFlowCards({
  flow,
  category,
  onSubmit,
  onEditServer,
  onPreview,
  flyTargetRef,
  disabled,
}: QFlowCardsProps) {
  const t = useT();
  const serverAnswered = flow.answered ?? {};
  const queue = React.useMemo(
    () =>
      flow.questions.filter(
        (q) =>
          // The question an edit reopened queues even though its OLD answer
          // is still in `answered` — the backend keeps it there until the
          // new one lands, and without this the Edit click re-rendered the
          // same answered rows with no card to actually change anything on.
          (serverAnswered[q.id] === undefined || flow.editing === q.id) &&
          !(flow.skipped ?? []).includes(q.id)
      ),
    // The flow payload is immutable per message; recompute only when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flow]
  );

  const [local, setLocal] = React.useState<Record<string, LocalAnswer>>({});
  const [idx, setIdx] = React.useState(0);
  const [multiPick, setMultiPick] = React.useState<string[]>([]);
  const [text, setText] = React.useState('');
  const [submitted, setSubmitted] = React.useState(false);

  // 'hold' = the picked chip stays lit while the others dim; 'leaving' = the
  // answered card is animating out; 'gap' = the beat of empty space before
  // the next one rises. All are transient and block new input.
  const [phase, setPhase] = React.useState<'idle' | 'hold' | 'leaving' | 'gap'>(
    'idle'
  );
  const [heldChoice, setHeldChoice] = React.useState<string | null>(null);
  const reduced = useReducedMotion();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const timers = React.useRef<number[]>([]);
  /** In-flight tag clones — removed on unmount so none can outlive us. */
  const flyingRef = React.useRef<HTMLElement[]>([]);
  /** Bumped on edit-rewind: invalidates preview emissions still in flight. */
  const previewGen = React.useRef(0);
  React.useEffect(
    () => () => {
      for (const t of timers.current) window.clearTimeout(t);
      for (const node of flyingRef.current) node.remove();
      flyingRef.current = [];
    },
    []
  );

  /** Replace-all preview report, in flow-question order. */
  const emitPreview = (answers: Record<string, LocalAnswer>) => {
    onPreview?.(
      flow.questions
        .filter((q) => answers[q.id] !== undefined)
        .map((q) => ({
          id: q.id,
          factor: q.factor,
          skipped: Boolean(answers[q.id].answer.skipped),
        }))
    );
  };

  const flyTagsToFactors = (questionId: string): boolean => {
    const target = flyTargetRef?.current;
    const root = rootRef.current;
    if (!target || !root) return false;
    const targetRect = target.getBoundingClientRect();
    if (targetRect.width < 2) return false;
    const row = root.querySelector(`[data-qid="${CSS.escape(questionId)}"]`);
    if (!row) return false;
    const tags = Array.from(row.querySelectorAll('[data-qtag]'));
    let launched = false;
    tags.forEach((tag, index) => {
      const rect = tag.getBoundingClientRect();
      if (rect.width < 2) return;
      launched = true;
      const clone = tag.cloneNode(true) as HTMLElement;
      clone.classList.add('vk-qtag-fly');
      clone.setAttribute('aria-hidden', 'true');
      clone.style.left = `${rect.left}px`;
      clone.style.top = `${rect.top}px`;
      clone.style.width = `${rect.width}px`;
      document.body.appendChild(clone);
      flyingRef.current.push(clone);
      const dx =
        targetRect.left + targetRect.width / 2 - (rect.left + rect.width / 2);
      const dy = targetRect.top + 46 - rect.top;
      requestAnimationFrame(() => {
        clone.style.transform = `translate(${dx}px, ${dy}px) scale(0.82)`;
        clone.style.opacity = '0.12';
      });
      timers.current.push(
        window.setTimeout(() => {
          clone.remove();
          flyingRef.current = flyingRef.current.filter((n) => n !== clone);
          if (index === tags.length - 1) {
            target.classList.add('vk-factors-glow');
            timers.current.push(
              window.setTimeout(
                () => target.classList.remove('vk-factors-glow'),
                500
              )
            );
          }
        }, 470)
      );
    });
    return launched;
  };

  const current = queue[idx];
  const total = flow.questions.length;
  const answeredCount =
    Object.keys(serverAnswered).filter((id) => id !== flow.editing).length +
    Object.keys(local).length;

  const profileTags = [
    ...(flow.tags ?? []),
    ...Object.values(local).flatMap((a) => a.tags),
  ];

  const finish = React.useCallback(
    (all: Record<string, LocalAnswer>) => {
      if (submitted) return;
      setSubmitted(true);
      onSubmit(Object.values(all).map((a) => a.answer));
    },
    [onSubmit, submitted]
  );

  const confirm = (
    q: FlowQuestion,
    display: string,
    answer: QFlowAnswer,
    /** Single-choice picks hold the lit chip before the card leaves. */
    hold = false
  ) => {
    // Guards the beat: chips stay clickable during the exit animation, and a
    // second pick would answer the question that is already on its way out.
    if (phase !== 'idle' || submitted) return;

    const next = {
      ...local,
      [q.id]: { display, answer, tags: tagsFor(q, answer.values ?? [display]) },
    };
    const more = idx + 1 < queue.length;

    // `local`/`idx` are read from this render's closure — nothing else can
    // change them while the exit runs, because the beat blocks input.
    const land = () => {
      setLocal(next);
      setMultiPick([]);
      setText('');
      setHeldChoice(null);
      if (more) setIdx(idx + 1);
      else finish(next);
      if (reduced) {
        emitPreview(next);
        return;
      }
      // Motion order, per the design: the row lands, the tag flight leaves
      // 500ms later (by then the `.vk-q-done` settle has finished and the
      // row is stable), and only on ARRIVAL does the factor chip appear in
      // Known factors — the flight explains where the answer went. With no
      // flight to watch, the chip appears right away. An edit-rewind while
      // a flight is pending bumps the generation and voids its landing, so
      // a rewound answer can never re-surface as a stale chip.
      const gen = previewGen.current;
      const landPreview = () => {
        if (previewGen.current === gen) emitPreview(next);
      };
      timers.current.push(
        window.setTimeout(() => {
          if (flyTagsToFactors(q.id)) {
            timers.current.push(window.setTimeout(landPreview, 470));
          } else {
            landPreview();
          }
        }, 500)
      );
    };

    if (reduced) {
      land();
      return;
    }

    const leave = () => {
      setPhase('leaving');
      timers.current.push(
        window.setTimeout(() => {
          land();
          setPhase(more ? 'gap' : 'idle');
          if (more) {
            timers.current.push(
              window.setTimeout(() => setPhase('idle'), GAP_MS)
            );
          }
        }, LEAVE_MS)
      );
    };

    if (hold) {
      setPhase('hold');
      setHeldChoice(display);
      timers.current.push(window.setTimeout(leave, HOLD_MS));
    } else {
      leave();
    }
  };

  const skip = (q: FlowQuestion) => {
    confirm(q, '(skipped)', { id: q.id, skipped: true });
  };

  const editLocal = (id: string) => {
    if (submitted || phase !== 'idle') return;
    const pos = queue.findIndex((q) => q.id === id);
    if (pos < 0) return;

    const kept: Record<string, LocalAnswer> = {};
    for (const [k, v] of Object.entries(local)) {
      const kp = queue.findIndex((q) => q.id === k);
      if (kp >= 0 && kp < pos) kept[k] = v;
    }
    setLocal(kept);
    // The rewound answers leave the preview too — Known factors follows.
    // The bump voids any preview still waiting on a tag flight to land.
    previewGen.current++;
    emitPreview(kept);
    setIdx(pos);
  };

  const firstCardGroup = Object.keys(serverAnswered).length === 0;

  return (
    <div ref={rootRef} className="space-y-3.5" dir="auto">
      {firstCardGroup ? (
        <div className="border-l-2 border-[var(--vk-gold)] pl-3">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] tracking-[0.14em] text-[var(--vk-text-muted)] uppercase">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--vk-gold)] shadow-[0_0_6px_rgba(242,193,78,0.6)]"
              aria-hidden
            />
            LUMORA
          </div>
          <p className="m-0 text-[15px] leading-[1.62] text-[var(--vk-text-subtle)]">
            {/* Explicit space: the JSX transform drops the one before "for". */}
            {t('qflow.gotItCategory', { category: category.toLowerCase() })}
            {' for you. '}A few quick things and I&rsquo;ll tailor this to you.
          </p>
        </div>
      ) : null}

      {/* Answered rows — server-side first, then local. */}
      {flow.questions.map((q) => {
        // The reopened question is the active card below, not a done row —
        // both at once would show the answer as settled while asking for it.
        if (flow.editing === q.id) return null;
        const server = serverAnswered[q.id];
        const loc = local[q.id];
        const value = server ?? loc?.display;
        if (value === undefined) return null;
        const rowTags =
          loc?.tags ?? tagsFor(q, value.split(', ').filter(Boolean));
        return (
          <button
            key={q.id}
            type="button"
            data-qid={q.id}
            onClick={() =>
              server !== undefined ? onEditServer(q.id) : editLocal(q.id)
            }
            disabled={disabled}
            // Keyed by question id, so each row animates exactly once — when
            // its answer first lands, not on every re-render of the group.
            className="vk-q-done bg-[rgba(249, 248, 242, 0.32)] block w-full rounded-[11px] border border-[rgba(150,178,205,0.16)] px-[13px] py-2.5 text-left transition hover:border-[rgba(242,193,78,0.24)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] tracking-[0.08em] text-[var(--vk-text-muted)] uppercase">
                  <span className="mr-1 text-[var(--vk-gold-soft)]">✓</span>
                  {q.factor}
                </div>
                <div className="mt-1 truncate text-[14px] font-medium text-[var(--vk-text-strong)]">
                  {value}
                </div>
                {rowTags.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {rowTags.map((t) => (
                      <span
                        key={t}
                        data-qtag=""
                        className="bg-[rgba(249, 248, 242, 0.7)] inline-flex items-center gap-1.5 rounded-full border border-[rgba(242,193,78,0.22)] px-2.5 py-1 text-[11.5px] text-[#ecdcae]"
                      >
                        <span
                          className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--vk-gold)] shadow-[0_0_6px_rgba(242,193,78,0.6)]"
                          aria-hidden
                        />
                        {t}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <span className="shrink-0 text-[11.5px] text-[var(--vk-text-muted)]">
                Edit
              </span>
            </div>
          </button>
        );
      })}

      {/* The active card. Hidden entirely during the 'gap' beat, and keyed by
          question id so each new question replays the entrance animation
          instead of reusing the outgoing card's DOM node. */}
      {current && !submitted && phase !== 'gap' ? (
        <div
          key={current.id}
          className={cn(
            'bg-[rgba(249, 248, 242, 0.55)] max-w-[664px] rounded-[13px] border border-l-2 border-[rgba(150,178,205,0.14)] border-l-[var(--vk-gold)] px-4 py-3.5',
            phase === 'leaving' ? 'vk-q-card-leaving' : 'vk-q-card'
          )}
        >
          <div className="mb-2 flex items-center justify-between gap-3 text-[11px] tracking-[0.12em] uppercase">
            {/* The design's `qlabel`: the Decision World's name, resolved
                from the backend-named category — never a guessed world. */}
            <span className="font-semibold text-[var(--vk-gold-soft)]">
              {resolveWorldContext(category)?.world.name ?? 'LUMORA'}
            </span>
            <span className="text-[var(--vk-text-muted)]">
              Question {answeredCount + 1} of {total}
            </span>
          </div>
          <div
            className="text-[15.5px] leading-[1.45] font-semibold text-[var(--vk-text-strong)]"
            dir="auto"
          >
            {current.question}
          </div>
          {current.why ? (
            <div
              className="mt-1.5 text-[12.5px] leading-[1.55] text-[var(--vk-text-muted)]"
              dir="auto"
            >
              {current.why}
            </div>
          ) : null}

          {current.type === 'text' ? (
            <div className="mt-3 flex gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && text.trim()) {
                    confirm(current, text.trim(), {
                      id: current.id,
                      value: text.trim(),
                    });
                  }
                }}
                dir="auto"
                placeholder={t('chat.answerPlaceholder')}
                className="bg-[rgba(249, 248, 242, 0.6)] w-full rounded-[10px] border border-[rgba(150,178,205,0.18)] px-3.5 py-[11px] text-[14.5px] text-[var(--vk-text-strong)] transition outline-none focus:border-[rgba(242,193,78,0.35)]"
              />
              <button
                type="button"
                disabled={!text.trim() || disabled}
                onClick={() =>
                  confirm(current, text.trim(), {
                    id: current.id,
                    value: text.trim(),
                  })
                }
                className="min-h-10 rounded-[9px] bg-linear-[150deg,#348568,#28765c] px-[15px] py-[9px] text-[13px] font-semibold text-[#ffffff] transition hover:brightness-[1.04] disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {(current.options ?? []).map((o) => {
                const held = heldChoice !== null;
                const on = held
                  ? o.label === heldChoice
                  : multiPick.includes(o.label);
                return (
                  <button
                    key={o.label}
                    type="button"
                    disabled={disabled || (held && !on)}
                    aria-pressed={
                      current.type === 'multi' || held ? on : undefined
                    }
                    onClick={() => {
                      if (current.type === 'multi') {
                        setMultiPick((p) =>
                          on ? p.filter((x) => x !== o.label) : [...p, o.label]
                        );
                      } else {
                        confirm(
                          current,
                          o.label,
                          { id: current.id, value: o.label },
                          true
                        );
                      }
                    }}
                    className={cn(
                      'min-h-10 rounded-[10px] border px-[13px] py-[9px] text-[13.5px] transition-[color,background,border-color] duration-[160ms]',
                      on
                        ? 'border-transparent bg-linear-[150deg,#348568,#28765c] font-semibold text-[#ffffff]'
                        : 'border-[rgba(150,178,205,0.14)] bg-[rgba(150,178,205,0.05)] text-[var(--vk-text-muted)] hover:border-[rgba(242,193,78,0.3)] hover:bg-[rgba(242,193,78,0.05)] hover:text-[var(--vk-text)]',
                      held && !on && 'opacity-45'
                    )}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-3 flex items-center gap-2">
            {current.type === 'multi' ? (
              <button
                type="button"
                disabled={multiPick.length === 0 || disabled}
                onClick={() =>
                  confirm(current, multiPick.join(', '), {
                    id: current.id,
                    values: multiPick,
                  })
                }
                className="min-h-10 rounded-[9px] bg-linear-[150deg,#348568,#28765c] px-[15px] py-[9px] text-[13px] font-semibold text-[#ffffff] transition hover:brightness-[1.04] disabled:opacity-50"
              >
                Continue
              </button>
            ) : null}
            {!current.required ? (
              <button
                type="button"
                disabled={disabled}
                onClick={() => skip(current)}
                className="min-h-10 rounded-[9px] border border-[rgba(150,178,205,0.14)] bg-[rgba(150,178,205,0.06)] px-[15px] py-[9px] text-[13px] text-[var(--vk-text)] transition hover:brightness-[1.04]"
              >
                Skip
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {submitted ? (
        <div className="vk-q-complete bg-linear-[180deg,rgba(242,193,78,0.05),rgba(249, 248, 242, 0.2)] rounded-[12px] border border-[rgba(242,193,78,0.2)] px-3.5 py-3">
          <div className="mb-2.5 text-[14px] leading-[1.5] text-[var(--vk-gold-soft)]">
            {t('qflow.gotItFactors')}
          </div>
          {profileTags.length ? (
            <>
              <div className="mb-2 text-[10.5px] tracking-[0.14em] text-[var(--vk-text-muted)] uppercase">
                Your decision profile
              </div>
              <div className="flex flex-wrap gap-1.5">
                {profileTags.map((t, i) => (
                  <span
                    key={`${t}-${i}`}
                    className="bg-[rgba(249, 248, 242, 0.7)] inline-flex items-center gap-1.5 rounded-full border border-[rgba(242,193,78,0.22)] px-2.5 py-1 text-[11.5px] text-[#ecdcae]"
                    dir="auto"
                  >
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--vk-gold)] shadow-[0_0_6px_rgba(242,193,78,0.6)]"
                      aria-hidden
                    />
                    {t}
                  </span>
                ))}
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
