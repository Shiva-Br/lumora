const FA_STATUS: [RegExp, string | ((m: RegExpMatchArray) => string)][] = [
  [/^Understanding your request/i, 'در حال فهمیدن درخواست شما'],
  [/^Understood$/i, 'متوجه شدم'],
  [/^Reviewing what you'?ve told me/i, 'مرور آنچه گفته‌اید'],
  [/^Requirements? captured/i, 'نیازمندی‌ها ثبت شد'],
  [/^Searching live/i, 'در حال جست‌وجوی زنده'],
  [/^Scanning live listings/i, 'در حال بررسی آگهی‌های زنده'],
  [/^Found (\d+) candidate products?/i, (m) => `${m[1]} محصول مناسب پیدا شد`],
  [/^Found (\d+) live discounts?/i, (m) => `${m[1]} تخفیف زنده پیدا شد`],
  [/^No genuine discounts right now/i, 'فعلاً تخفیف واقعی موجود نیست'],
  [/^Hunting live discounts/i, 'در حال شکار تخفیف‌های زنده'],
  [/^Checking (live )?store listings/i, 'در حال بررسی فروشگاه‌ها'],
  [/^Comparing marketplace offers/i, 'در حال مقایسه پیشنهاد فروشندگان'],
  [/^Researching real-world experience/i, 'در حال بررسی تجربه واقعی کاربران'],
  [/^Building your recommendation/i, 'در حال آماده‌سازی پیشنهاد نهایی'],
  [/^Recommendation ready/i, 'پیشنهاد نهایی آماده شد'],
  [/^Writing your answer|^Responding/i, 'در حال نوشتن پاسخ'],
  [/^Preparing/i, 'در حال آماده‌سازی'],
];

/** Localize one status line for the thread language; English passes through. */
export function localizeStatus(message: string, lang?: 'fa' | 'en'): string {
  if (lang !== 'fa') return message;
  for (const [pattern, out] of FA_STATUS) {
    const m = message.match(pattern);
    if (m) return typeof out === 'function' ? out(m) : out;
  }
  return message;
}

import { MicroMark } from '@/components/lumora/chat/chat-message';
import type { StageEntry } from '@/lib/conversation/use-conversation';

/** Stages that read as the heavy pipeline → the proc-journey treatment.
 *  Light turns (understanding/requirement/response only) stay a single line. */
const PIPELINE_STAGES = new Set([
  'analysis',
  'selection',
  'discovery',
  'marketplace',
  'research',
  'recommendation',
]);

export function StageStatus({
  stages,
  expect,
  tool,
  lang,
}: {
  stages: StageEntry[];
  /** Backend pace hint: "researching" turns warn the wait will be longer. */
  expect?: string | null;
  /** In-stage tool activity line (advisory shimmer). */
  tool?: string | null;
  /** Thread language — 'fa' localizes the closed status vocabulary. */
  lang?: 'fa' | 'en';
}) {
  const running = stages.filter((s) => s.state === 'started').at(-1);
  const isPipeline = stages.some((s) => PIPELINE_STAGES.has(s.stage));

  if (!isPipeline) {
    const line = running
      ? localizeStatus(running.message, lang)
      : (stages.at(-1) && localizeStatus(stages.at(-1)!.message, lang)) ||
        (expect === 'researching' ? 'Researching products' : 'is thinking');
    return (
      <div className="mt-px text-[14px] leading-[1.5] text-[var(--vk-text-muted)]">
        <span dir="auto">{line}</span>
        <span className="vk-think-dots" aria-hidden="true" />
        {tool && (
          <div className="mt-[3px] text-[12.5px] leading-[1.45] text-[var(--vk-note-quiet)]">
            {tool}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="vk-proc" role="status">
      <div className="vk-proc-track" aria-hidden="true" />
      <div className="vk-proc-steps">
        {stages.map((entry) => {
          const state =
            entry.state === 'started'
              ? 'active'
              : entry.state === 'completed'
                ? 'done'
                : 'failed';
          return (
            <div key={entry.stage} className="vk-proc-step" data-state={state}>
              <span className="vk-proc-dot" aria-hidden="true" />
              {state === 'active' && (
                <MicroMark size={15} spinning className="vk-proc-mark" />
              )}
              <div className="vk-proc-label" dir="auto">
                {localizeStatus(entry.message, lang)}
              </div>
              {state === 'active' && tool && (
                <div className="vk-proc-detail">{tool}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
