'use client';

import { ActivityCollapseButton } from '@/components/lumora/shell/app-frame';
import { useT } from '@/lib/i18n/provider';

export function ActivityRegion({
  status = 'Ready when you are.',
  children,
}: {
  /** The one-line status under the title. */
  status?: string;

  children?: React.ReactNode;
}) {
  const t = useT();
  return (
    <>
      <div className="vk-act-head">
        <ActivityCollapseButton />
        <div className="vk-act-title-wrap">
          <span className="vk-act-live" aria-hidden="true" />
          <div className="vk-act-titles">
            <div className="vk-act-title">{t('activity.title')}</div>
            <div className="vk-act-status" aria-live="polite">
              {status}
            </div>
          </div>
        </div>
      </div>
      {children}
    </>
  );
}
