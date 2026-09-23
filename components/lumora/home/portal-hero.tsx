'use client';

import { LogoMark } from '@/components/lumora/logo';
import { useT } from '@/lib/i18n/provider';

export function PortalHero() {
  const t = useT();
  return (
    <section className="vk-hero">
      <div className="lumora-intro">
        <div className="lumora-intro-mark" aria-hidden="true">
          <LogoMark size={44} style={{ width: '100%', height: '100%' }} />
        </div>
        <span className="lumora-intro-label">{t('brand.name')}</span>
        <h1>{t('hero.k')}</h1>
        <p>{t('hero.k2')}</p>
      </div>
    </section>
  );
}
