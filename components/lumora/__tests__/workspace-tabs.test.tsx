import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  AnalysisCompareTab,
  AnalysisDecisionTab,
  AnalysisMarketTab,
} from '@/components/lumora/chat/workspace-analysis';
import type { AnalysisPayload, Recommendation } from '@/lib/api/types';
import { LocaleProvider } from '@/lib/i18n/provider';

const ANALYSIS = {
  type: 'analysis',
  category_id: 'VK-02',
  category: 'PC & Computing',
  goal: 'A laptop for everyday work — portability and budget lead',
  rec: {
    summary: 'The Ultraportable is the only finalist that survives both.',
    optimized: [
      { emoji: '🎒', title: 'Portability', line: 'Weighted critical.' },
      { emoji: '💰', title: 'Budget', line: 'Weighted critical.' },
    ],
    avoided: [
      { title: 'Loud cooling', reason: 'Loud cooling — eliminated on noise.' },
    ],
    reasoning: [
      'Portability and budget lead — both non-negotiable.',
      'Anything failing either cannot win.',
      'Every rival breaks one of the two.',
    ],
    best: {
      product_id: 'p1',
      name: '14″ Windows Ultraportable',
      brand: 'Contoso',
      price: '$1,450',
      why: ['Light enough to carry daily', 'Inside the budget you set'],
      why_not: ['If the budget rose meaningfully'],
      tradeoffs: ['Unused GPU headroom'],
    },
    why_won: [
      { priority: 'Portability', performance: 'Weight rated 9/10', ok: 'yes' },
      { priority: 'Budget', performance: 'Price rated 8/10', ok: 'yes' },
      { priority: 'Battery', performance: 'Battery rated 6/10', ok: 'ok' },
      { priority: 'Performance', performance: 'CPU rated 4/10', ok: 'no' },
    ],
    fit: [
      { label: 'Portability', score: 96 },
      { label: 'Budget', score: 94 },
      { label: 'Battery', score: 76 },
      { label: 'Performance', score: 34 },
    ],
    signature: 'I would take the Ultraportable.',
    scores: { lumora: 8.9, personal: 9.2, match: 94 },
  },
  compare: {
    finalists: [
      {
        product_id: 'p1',
        name: '14″ Windows Ultraportable',
        brand: 'Contoso',
        match: 96,
        price: '$1,450',
        why_finalist: 'Closest fit to your exact priorities.',
        for_who: 'Everyday carry',
        best: true,
      },
      {
        product_id: 'p2',
        name: 'Premium Creator',
        brand: 'Fabrikam',
        match: 78,
        price: '$2,100',
        why_finalist: 'The power ceiling.',
        for_who: 'Creators needing raw power',
      },
    ],
    table: [
      {
        label: 'Your budget rule',
        rows: [
          {
            factor: 'Budget fit',
            priority: true,
            cells: [
              { value: '$1,450', score: 74 },
              { value: '$2,100', score: 20 },
            ],
          },
        ],
      },
      {
        label: 'Mobility',
        rows: [
          {
            factor: 'Weight / portability',
            priority: true,
            cells: [
              { value: '1.19 kg', score: 100 },
              { value: '1.9 kg', score: 40 },
            ],
          },
          {
            factor: 'CPU / everyday speed',
            priority: false,
            cells: [
              { value: 'Efficient 8-core', score: 66 },
              { value: 'High 12-core', score: 100 },
            ],
          },
          {
            factor: 'GPU / heavy work',
            priority: false,
            cells: [
              { value: 'Integrated', score: 55 },
              { value: 'Discrete RTX', score: 100 },
            ],
          },
        ],
      },
    ],
    wins: 'It wins because portability and budget were the two you refused to trade.',
  },
  market: {
    summary: [{ k: 'Offers analysed', v: 2 }],
    items: [
      {
        product_id: 'p1',
        product: '14″ Windows Ultraportable',
        offers: [
          {
            seller: 'TechDirect',
            authority: 'Official store',
            price: 1450,
            currency: 'USD',
            url: 'https://example.com/techdirect',
            delivery: '2 days',
            warranty: '2 years',
            returns: '30 days',
            stock: 'In stock',
            trust: 95,
            buy_score: 92,
            risk_score: 8,
            risk_band: 'Very low',
            badge: 'Victor Choice',
            badge_why: 'Highest buying score.',
            derived: true,
          },
          {
            seller: 'GreyImports',
            authority: 'Third-party seller',
            price: 1389,
            currency: 'USD',
            url: 'https://example.com/grey',
            delivery: '9 days',
            trust: 45,
            buy_score: 51,
            risk_score: 69,
            risk_band: 'High',
            badge: 'Highest Risk',
            badge_why: 'Unverified seller.',
            derived: true,
          },
        ],
      },
    ],
    note: 'Buying, trust and risk scores are derived by Lumora.',
  },
  dna: [{ factor: 'Use', value: 'Everyday work' }],
  confidence: { pct: 94, word: 'Strong', unresolved: ['Exact RAM ceiling'] },
  generated_at: '2026-08-21T10:00:00Z',
} as unknown as AnalysisPayload;

const analysis_wins = ANALYSIS.compare.wins as string;

function renderTab(node: React.ReactNode) {
  return render(<LocaleProvider initialLocale="en">{node}</LocaleProvider>);
}

/** Section presence, insensitive to the surrounding markup. */
function has(container: HTMLElement, needle: string): boolean {
  return (container.textContent ?? '').includes(needle);
}

describe('Tab 1 · My Best Choice (Decision)', () => {
  const sections = [
    'LUMORA · Why this page',
    'My best choice · LUMORA’s decision',
    'Why this holds — at a glance',
    'What LUMORA understood',
    'How LUMORA decided',
    'The trade-off',
    'Why you can trust it',
    'The boundary of this decision',
    'LUMORA’s personal call',
  ];

  it.each(sections)('renders the workspace block: %s', (section) => {
    const { container } = renderTab(
      <AnalysisDecisionTab analysis={ANALYSIS} />
    );
    expect(has(container, section)).toBe(true);
  });

  it('titles the confidence block with the confidence word', () => {
    renderTab(<AnalysisDecisionTab analysis={ANALYSIS} />);
    expect(screen.getByText(/Strong confidence — here’s why/)).toBeVisible();
  });

  it('closes with the workspace personal-call title', () => {
    renderTab(<AnalysisDecisionTab analysis={ANALYSIS} />);
    expect(screen.getByText('After weighing all of it')).toBeVisible();
  });

  describe('the boundary block', () => {
    /** A real `what_would_change` line: one sentence carrying both halves. */
    const SENTENCE =
      'If daily travel or thin portability were required, a 15-inch gaming chassis would replace an 18-inch model.';

    function withWhatWouldChange() {
      return renderTab(
        <AnalysisDecisionTab
          analysis={ANALYSIS}
          recommendation={
            {
              confidence_detail: { what_would_change: [SENTENCE] },
            } as unknown as Recommendation
          }
        />
      );
    }

    it('prints the backend sentence whole, with nothing invented beside it', () => {
      const { container } = withWhatWouldChange();
      expect(has(container, SENTENCE)).toBe(true);
      // The old code jammed the sentence into the condition slot and appended
      // a generic tail so the second column had something in it. Nothing in
      // the payload ever said this.
      expect(has(container, 'the ranking would need another pass')).toBe(false);
    });

    it('renders it as one row, not a lopsided pair', () => {
      const { container } = withWhatWouldChange();
      const node = container.querySelector('.gm-bnode');
      expect(node).not.toBeNull();
      // No condition label means no two-column split to squeeze against.
      expect(node).toHaveClass('solo');
      expect(node?.querySelectorAll('.gm-bif')).toHaveLength(0);
    });

    it('keeps the label + continuation shape when the data really is a pair', () => {
      const { container } = renderTab(
        <AnalysisDecisionTab
          analysis={ANALYSIS}
          recommendation={
            {
              conditional: [
                {
                  if: 'you edit 4K or render',
                  then_product: 'Premium Creator',
                  why: 'the discrete GPU earns its price',
                },
              ],
            } as unknown as Recommendation
          }
        />
      );
      const node = container.querySelector('.gm-bnode');
      expect(node).not.toHaveClass('solo');
      expect(node?.querySelector('.gm-bif')?.textContent).toBe(
        'you edit 4K or render'
      );
      expect(has(container, 'Premium Creator')).toBe(true);
    });

    it('never repurposes why the other finalists lost', () => {
      // `why_not` answers a different question, so with neither real source
      // the block carries only what IS honest here — the unresolved list —
      // and invents no rows. Printing `why_not` under "What would change my
      // mind" made the section claim something the backend never said.
      const { container } = renderTab(
        <AnalysisDecisionTab analysis={ANALYSIS} />
      );
      expect(container.querySelectorAll('.gm-bnode')).toHaveLength(0);
      expect(has(container, 'another finalist may become the better fit')).toBe(
        false
      );
      // The winner's `why_not` entry must not have leaked in as a row.
      expect(has(container, 'p2 — hotter')).toBe(false);
      // What remains is true: the open consideration.
      expect(has(container, 'Exact RAM ceiling')).toBe(true);
    });

    it('renders nothing at all when there is no boundary to state', () => {
      const bare = structuredClone(ANALYSIS) as AnalysisPayload;
      bare.confidence.unresolved = [];
      const { container } = renderTab(<AnalysisDecisionTab analysis={bare} />);
      expect(has(container, 'What would change my mind')).toBe(false);
    });
  });

  it('shows all three glance pills, including a zero count', () => {
    // "0 deal-breakers hit" is the reassurance; a filtered-out zero deletes it.
    const { container } = renderTab(
      <AnalysisDecisionTab analysis={ANALYSIS} />
    );
    for (const label of [
      'Non-negotiables protected',
      'Deal-breakers hit',
      'Acceptable sacrifice',
    ]) {
      expect(has(container, label)).toBe(true);
    }
  });
});

describe('Tab 2 · Why It Wins (Proof)', () => {
  const sections = [
    'LUMORA · Why this page',
    'finalists',
    'Your decision focus',
    '-factor comparison',
    'Read honestly',
    'Decision evidence summary',
    'The decisive difference',
    'No universal best',
    'LUMORA’s personal call',
  ];

  it.each(sections)('renders the workspace block: %s', (section) => {
    const { container } = renderTab(
      <AnalysisCompareTab
        analysis={ANALYSIS}
        selectedIndex={0}
        onSelect={() => {}}
      />
    );
    expect(has(container, section)).toBe(true);
  });

  it('calls a split board a split board, never a lead', () => {
    // Premium Creator wins CPU and GPU; the Ultraportable wins budget and
    // weight. A 2:2 tie has no leader, and naming one would be the exact
    // dishonesty this paragraph exists to prevent.
    const { container } = renderTab(
      <AnalysisCompareTab
        analysis={ANALYSIS}
        selectedIndex={0}
        onSelect={() => {}}
      />
    );
    expect(has(container, 'the board is split')).toBe(true);
    expect(has(container, 'more than any other finalist')).toBe(false);
  });

  it('names the row leader when one finalist really leads', () => {
    const leaning = structuredClone(ANALYSIS) as AnalysisPayload;
    // Give Premium Creator a third row win, breaking the tie.
    (
      leaning.compare.table as {
        rows: { cells: { value: string; score: number }[] }[];
      }[]
    )[1].rows[0].cells = [
      { value: '1.19 kg', score: 40 },
      { value: '1.9 kg', score: 100 },
    ];
    const { container } = renderTab(
      <AnalysisCompareTab
        analysis={leaning}
        selectedIndex={0}
        onSelect={() => {}}
      />
    );
    expect(has(container, 'Premium Creator wins 3 of the 4 rows')).toBe(true);
    // …and the pick still stands, on the factors that were weighted highest.
    expect(
      has(container, 'loses none of the factors you weighted highest')
    ).toBe(true);
  });

  it('renders the decisive box once, and never mislabels it', () => {
    // `gmDecisiveHTML`: one box, its header carrying the eyebrow and — only
    // when the backend supplies one — the per-category decisive title. The
    // reference categories each have their OWN ("Why fewer wins still wins",
    // "Why the top GPU doesn't win", …), so a frontend constant would be wrong
    // for ten of the eleven.
    const { container } = renderTab(
      <AnalysisCompareTab
        analysis={ANALYSIS}
        selectedIndex={0}
        onSelect={() => {}}
      />
    );
    expect(screen.getAllByText('The decisive difference')).toHaveLength(1);
    expect(has(container, 'Why fewer wins still wins')).toBe(false);
    expect(has(container, analysis_wins)).toBe(true);
  });

  it('carries no page title of its own — the tab bar is the title', () => {
    const { container } = renderTab(
      <AnalysisCompareTab
        analysis={ANALYSIS}
        selectedIndex={0}
        onSelect={() => {}}
      />
    );
    expect(has(container, 'The evidence behind the pick')).toBe(false);
  });

  it('is ONE board, so a finalist keeps the same column throughout', () => {
    // Rendering a table per group let each group size its own columns, and the
    // same finalist landed at a different x-position in every block.
    const { container } = renderTab(
      <AnalysisCompareTab
        analysis={ANALYSIS}
        selectedIndex={0}
        onSelect={() => {}}
      />
    );
    expect(container.querySelectorAll('table.cx-tbl')).toHaveLength(1);
    // …with the two groups as separator rows inside it.
    expect(container.querySelectorAll('tr.cx-grp')).toHaveLength(2);
  });

  it('marks a priority row the winner takes with the word "Best"', () => {
    const { container } = renderTab(
      <AnalysisCompareTab
        analysis={ANALYSIS}
        selectedIndex={0}
        onSelect={() => {}}
      />
    );
    // "Weight / portability" is a priority row and the Ultraportable wins it.
    expect(has(container, 'Best')).toBe(true);
    expect(container.querySelector('.sem-tag.t-win')).not.toBeNull();
  });

  it('tags a weak PRIORITY cell, and leaves non-priority rows unlabelled', () => {
    const weak = structuredClone(ANALYSIS) as AnalysisPayload;
    const groups = weak.compare.table as {
      rows: {
        priority: boolean;
        cells: { value: string; score: number }[];
      }[];
    }[];
    // Budget fit is a priority row; drop the runner-up below the weak cutoff.
    groups[0].rows[0].cells[1].score = 12;
    const { container } = renderTab(
      <AnalysisCompareTab
        analysis={weak}
        selectedIndex={0}
        onSelect={() => {}}
      />
    );
    expect(container.querySelector('.sem-tag.t-bad')?.textContent).toBe('Weak');
    // The CPU row scores 66 vs 100 but is NOT a priority — no tag on it, or the
    // label would fire on factors the person ranked last and stop meaning
    // anything.
    const cpuRow = Array.from(container.querySelectorAll('tr')).find((tr) =>
      tr.textContent?.includes('CPU / everyday speed')
    );
    expect(cpuRow?.querySelectorAll('.sem-tag.t-bad')).toHaveLength(0);
    expect(cpuRow?.querySelectorAll('.sem-tag.t-warn')).toHaveLength(0);
  });

  it('badges the recommended column, not simply the first one', () => {
    const { container } = renderTab(
      <AnalysisCompareTab
        analysis={ANALYSIS}
        selectedIndex={0}
        onSelect={() => {}}
      />
    );
    const picked = container.querySelector('th.cx-col0');
    expect(picked?.textContent).toContain('14″ Windows Ultraportable');
    expect(picked?.textContent).toContain('LUMORA pick');
  });
});

describe('Tab 3 · Best Place to Buy (Action)', () => {
  const sections = [
    'LUMORA · Why this page',
    'Best place to buy · recommended destination',
    '#1 vs #2',
    'Where to buy',
    'The buying risk to avoid',
    'Why you can buy with confidence',
    'Timing',
    'LUMORA’s personal call',
  ];

  it.each(sections)('renders the workspace block: %s', (section) => {
    const { container } = renderTab(
      <AnalysisMarketTab analysis={ANALYSIS} selectedIndex={0} />
    );
    expect(has(container, section)).toBe(true);
  });

  it('carries no page title of its own — the tab bar is the title', () => {
    const { container } = renderTab(
      <AnalysisMarketTab analysis={ANALYSIS} selectedIndex={0} />
    );
    expect(has(container, 'Where to buy it safely')).toBe(false);
  });

  it('points the badge at the cell that earns it', () => {
    // The frozen board green-tags the ONE cell that is this seller's reason
    // for being listed — repeating the badge in a corner tells the reader
    // nothing about which number to look at.
    const { container } = renderTab(
      <AnalysisMarketTab analysis={ANALYSIS} selectedIndex={0} />
    );
    const grey = Array.from(container.querySelectorAll('tr')).find((tr) =>
      tr.textContent?.includes('GreyImports')
    );
    // "Highest Risk" names no column, so nothing is highlighted for it.
    expect(grey?.querySelectorAll('.sem-tag.t-win')).toHaveLength(0);

    const official = Array.from(container.querySelectorAll('tr')).find((tr) =>
      tr.textContent?.includes('TechDirect')
    );
    // "Victor Choice" likewise names no single column — no false highlight.
    expect(official?.querySelectorAll('.sem-tag.t-win')).toHaveLength(0);
  });

  it('highlights the price cell for a price badge', () => {
    const priced = structuredClone(ANALYSIS) as AnalysisPayload;
    priced.market.items[0].offers[1].badge = 'Best Price';
    const { container } = renderTab(
      <AnalysisMarketTab analysis={priced} selectedIndex={0} />
    );
    const row = Array.from(container.querySelectorAll('tr')).find((tr) =>
      tr.textContent?.includes('GreyImports')
    );
    const tagged = row?.querySelectorAll('.sem-tag.t-win');
    expect(tagged).toHaveLength(1);
    // …and it sits in the price cell, not somewhere else on the row.
    expect(tagged?.[0].closest('td')?.textContent).toContain('1,389');
  });

  it('prints the seller authority as its own column', () => {
    const { container } = renderTab(
      <AnalysisMarketTab analysis={ANALYSIS} selectedIndex={0} />
    );
    expect(has(container, 'Authentic')).toBe(true);
    expect(has(container, 'Official store')).toBe(true);
    expect(has(container, 'Third-party seller')).toBe(true);
  });

  it('closes the seller board with a counted, verified-only footer', () => {
    const { container } = renderTab(
      <AnalysisMarketTab analysis={ANALYSIS} selectedIndex={0} />
    );
    // One of the two offers is verified, and the lowest VERIFIED price is the
    // official $1,450 — not the cheaper unverified grey import.
    expect(has(container, 'Verified or official sellers: 1 of 2 offers')).toBe(
      true
    );
    expect(has(container, 'Lowest verified price')).toBe(true);
    expect(has(container, '1,389')).toBe(true); // still listed in the table…
    expect(has(container, 'Lowest verified price: USD 1,450')).toBe(true); // …but not quoted as the floor
  });

  it('formats the verification date instead of printing raw ISO', () => {
    const { container } = renderTab(
      <AnalysisMarketTab analysis={ANALYSIS} selectedIndex={0} />
    );
    expect(has(container, '2026-08-21T10:00:00Z')).toBe(false);
    expect(has(container, 'Buy now or wait?')).toBe(true);
  });
});

describe('the tabs survive an empty payload', () => {
  // A stage that has not run yet must still produce a surface. Rendering
  // nothing is what made the workspace look broken in the first place.
  const EMPTY = {
    type: 'analysis',
    category_id: '',
    category: '',
    rec: { best: { name: '' }, scores: { lumora: 0, personal: 0, match: 0 } },
    compare: { finalists: [] },
    market: { items: [] },
    confidence: { pct: 0, word: '' },
  } as unknown as AnalysisPayload;

  const cases: [string, () => HTMLElement][] = [
    [
      'decision',
      () => renderTab(<AnalysisDecisionTab analysis={EMPTY} />).container,
    ],
    [
      'proof',
      () =>
        renderTab(
          <AnalysisCompareTab
            analysis={EMPTY}
            selectedIndex={0}
            onSelect={() => {}}
          />
        ).container,
    ],
    [
      'action',
      () =>
        renderTab(<AnalysisMarketTab analysis={EMPTY} selectedIndex={0} />)
          .container,
    ],
  ];

  it.each(cases)('%s tab says the step has not run', (_name, mount) => {
    const container = mount();
    expect(has(container, 'This step has not run yet')).toBe(true);
  });

  it('prints no empty decision card, and no 0/0/0 glance pills', () => {
    const { container } = renderTab(<AnalysisDecisionTab analysis={EMPTY} />);
    expect(has(container, 'LUMORA recommends')).toBe(false);
    expect(has(container, 'Non-negotiables protected')).toBe(false);
  });

  it('never doubles the word "confidence" in the trust title', () => {
    // `{word} confidence` with an empty word produced "My confidence
    // confidence — here’s why".
    const { container } = renderTab(<AnalysisDecisionTab analysis={EMPTY} />);
    expect(has(container, 'confidence confidence')).toBe(false);
  });

  it('prints no finalist head when there are no finalists', () => {
    const { container } = renderTab(
      <AnalysisCompareTab
        analysis={EMPTY}
        selectedIndex={0}
        onSelect={() => {}}
      />
    );
    expect(has(container, 'The 0 finalists')).toBe(false);
  });
});
