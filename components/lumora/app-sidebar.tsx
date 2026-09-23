'use client';

import { Ellipsis, Pencil, Trash2 } from 'lucide-react';
import * as React from 'react';
import { createPortal } from 'react-dom';

import { SettingsDialog } from '@/components/lumora/settings-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { getClientConfig } from '@/lib/api/client-config';
import type { Account, Conversation } from '@/lib/chat';
import { useLocale, useT } from '@/lib/i18n/provider';
import {
  setSidebarCollapsed,
  toggleAtlasNode,
  toggleSidebarSection,
} from '@/lib/shell/shell-store';
import { useShell } from '@/lib/shell/use-shell';
import { useYourLumora } from '@/lib/sidebar/use-your-lumora';
import {
  addCollection,
  movePin,
  pinKey,
  renamePin,
  togglePin,
  type PinnedItem,
} from '@/lib/sidebar/your-lumora-store';
import { categoriesOf, officialCrumb } from '@/lib/taxonomy/atlas';
import {
  EMPTY_COVERAGE,
  specializedNodeIds,
  type Coverage,
} from '@/lib/taxonomy/coverage';
import { treeKeyAction, type TreeNode } from '@/lib/taxonomy/tree-nav';
import {
  DECISION_WORLDS,
  TOTAL_AREAS,
  TOTAL_CATEGORIES,
  TOTAL_WORLDS,
  type DecisionWorld,
} from '@/lib/taxonomy/worlds';
import { cn } from '@/lib/utils';

import { LogoMark } from './logo';

/** How many pinned shortcuts show before "Show more". */
const PINNED_PREVIEW = 5;

type SidebarProps = {
  history: Conversation[];
  /**
   * History has not loaded yet — show placeholder rows instead of the
   * "no decisions" empty state.
   */
  historyLoading?: boolean;
  /** The signed-in user, or the guest placeholder when signed out. */
  account: Account;
  authenticated: boolean;
  /** Currently open conversation, or null on a fresh Home screen. */
  activeId: string | null;
  onSelectConversation: (id: string) => void;
  /** Delete a conversation (already confirmed in the row UI). */
  onDeleteConversation?: (id: string) => void;
  /** Rename a conversation (title collected in the row UI's dialog). */
  onRenameConversation?: (id: string, title: string) => void;
  onNewChat: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  /**
   * Let the App Frame own the sidebar's width, border and background — the
   * frame's left track is the sizing authority for screens rendered inside
   * it. Standalone screens omit this and keep the self-sizing default.
   */
  fill?: boolean;
};

type IconProps = { className?: string };

const icon = (path: React.ReactNode, strokeWidth = 1.7) =>
  function Icon({ className }: IconProps) {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        aria-hidden="true"
      >
        {path}
      </svg>
    );
  };

const PlusIcon = icon(<path d="M12 5v14M5 12h14" strokeLinecap="round" />, 2.2);
const CaretIcon = icon(
  <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />,
  2.2
);
const ChevronUpIcon = icon(
  <path d="M6 15l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />,
  1.9
);
const ChevronLeftIcon = icon(
  <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />,
  2
);
const LanguageIcon = icon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path
      d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"
      strokeLinecap="round"
    />
  </>
);
const SettingsIcon = icon(
  <>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
  </>
);
const HelpIcon = icon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path
      d="M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1.4.9-1.4 1.7v.5"
      strokeLinecap="round"
    />
    <circle cx="12" cy="17" r=".6" fill="currentColor" />
  </>
);
const ProfileIcon = icon(
  <>
    <circle cx="12" cy="8" r="3.4" />
    <path d="M5 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5" />
  </>
);
const PlanIcon = icon(<path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" />);
const UsageIcon = icon(
  <path d="M4 19h16M7 16v-5M12 16V7M17 16v-8" strokeLinecap="round" />
);
const PersonalizationIcon = icon(
  <>
    <path d="M12 3v3M12 18v3M5 12H2M22 12h-3M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2" />
    <circle cx="12" cy="12" r="3" />
  </>
);
const SignOutIcon = icon(
  <path d="M15 12H5m0 0l4-4m-4 4l4 4M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4" />
);
const SignInIcon = icon(
  <path d="M9 12h10m0 0l-4-4m4 4l-4 4M10 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4" />
);

/* ---------------------------------------------------------------------
   Building blocks
   ------------------------------------------------------------------- */

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <div className="vk-side-group">{children}</div>;
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return <div className="vk-sub-label">{children}</div>;
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <div className="vk-mini-empty">{children}</div>;
}

/**
 * A collapsible sidebar section. Open state lives in the shell store, so it
 * survives navigation between Home and a conversation.
 */
function Section({
  id,
  title,
  badge,
  open,
  children,
}: {
  id: string;
  title: string;
  badge?: string;
  open: boolean;
  children: React.ReactNode;
}) {
  const bodyId = `vk-acc-${id}`;
  return (
    <div className="vk-acc" data-open={open ? '' : undefined}>
      <button
        type="button"
        className="vk-acc-head"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => toggleSidebarSection(id)}
      >
        <CaretIcon className="vk-cv" />
        <span className="vk-lbl">{title}</span>
        {badge ? <span className="vk-badge">{badge}</span> : null}
      </button>
      <div className="vk-acc-body" id={bodyId} role="region">
        <div className="vk-inner">{children}</div>
      </div>
    </div>
  );
}

/** A navigable row. */
function NavRow({
  label,
  onClick,
  active,
  trailing,
  leading,
  title,
  className,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  trailing?: React.ReactNode;
  leading?: React.ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cn('vk-nrow', className)}
      data-active={active ? '' : undefined}
      onClick={onClick}
      title={title ?? label}
    >
      {leading}
      <span className="vk-nm">{label}</span>
      {trailing}
    </button>
  );
}

/**
 * A My Decisions row: a NavRow that grows the three-dot Rename/Delete menu
 * when the screen provides those handlers. The trigger fades in over the
 * row's time stamp on hover; the destructive click itself lives in the
 * sidebar-level dialogs, so it survives this menu closing.
 */
function DecisionRow({
  title,
  time,
  active,
  onSelect,
  onDelete,
  onRename,
}: {
  title: string;
  time?: string;
  active: boolean;
  onSelect: () => void;
  /** When set, the row grows a "…" menu whose Delete item asks via a dialog. */
  onDelete?: () => void;
  /** When set, the "…" menu also offers Rename (centered dialog, like Delete). */
  onRename?: () => void;
}) {
  const t = useT();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const hasMenu = Boolean(onDelete || onRename);

  return (
    <div className="group/decision relative">
      <button
        type="button"
        className="vk-nrow"
        data-active={active ? '' : undefined}
        onClick={onSelect}
        title={title}
      >
        <span className="vk-nm">{title}</span>
        {time && (
          <span
            className={cn(
              'vk-rc',
              hasMenu &&
                'transition-opacity group-focus-within/decision:opacity-0 group-hover/decision:opacity-0'
            )}
          >
            {time}
          </span>
        )}
      </button>
      {hasMenu && (
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t('sidebar.decisionOptions')}
              onClick={(event) => event.stopPropagation()}
              className={cn(
                'absolute top-1/2 right-1 z-[1] inline-flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg transition-all focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--vk-accent-ring)]',
                menuOpen
                  ? 'bg-[rgba(150,178,205,0.12)] text-[var(--vk-text)] opacity-100'
                  : 'text-[var(--vk-text-muted)] opacity-0 group-focus-within/decision:opacity-100 group-hover/decision:opacity-100 hover:bg-[rgba(150,178,205,0.12)] hover:text-[var(--vk-text)]'
              )}
            >
              <Ellipsis size={15} strokeWidth={2} aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={4}
            className="shadow-[0_12px_32px_rgba(249, 248, 242, 0.45)] min-w-[150px] rounded-xl border-[var(--vk-border)] bg-[var(--vk-surface-2)] p-1.5"
          >
            {onRename && (
              <DropdownMenuItem
                onSelect={onRename}
                className="cursor-pointer gap-2 rounded-lg text-[13px] font-medium"
              >
                <Pencil size={14} strokeWidth={2} aria-hidden="true" />
                Rename
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem
                variant="destructive"
                onSelect={onDelete}
                className="cursor-pointer gap-2 rounded-lg text-[13px] font-medium"
              >
                <Trash2 size={14} strokeWidth={2} aria-hidden="true" />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

/**
 * A row that shows real content but has nowhere to go yet — the Atlas
 * overlay and the subcategory workspaces are later phases. Rendered as a
 * plain element rather than a disabled button: a control that silently
 * does nothing is worse than one that never looked pressable.
 */
/**
 * The Decision Worlds tree's focus model.
 *
 * A WAI-ARIA tree has exactly one tab stop and moves with the arrow keys; the
 * context carries which row owns that stop and whether focus should actually be
 * pulled to it. `shouldPullFocus` matters: on first render nothing should steal
 * focus from the page, only a keypress inside the tree should move it.
 */
type TreeCtx = {
  focusedId: string | null;
  shouldPullFocus: boolean;
  onFocusRow: (id: string) => void;
  /** Row ids with a full specialized flow behind them, from the backend. */
  deep: Set<string>;
};

const TreeContext = React.createContext<TreeCtx>({
  focusedId: null,
  shouldPullFocus: false,
  onFocusRow: () => {},
  deep: new Set(),
});

function useTree() {
  return React.useContext(TreeContext);
}

function StaticRow({
  label,
  trailing,
  leading,
  title,
  className,
  /** Set when this row is a LEAF of the Decision Worlds tree. */
  treeNode,
}: {
  label: string;
  trailing?: React.ReactNode;
  leading?: React.ReactNode;
  title?: string;
  className?: string;
  treeNode?: { id: string; level: number };
}) {
  const t = useT();
  const tree = useTree();
  const ref = React.useRef<HTMLDivElement>(null);
  const focused = !!treeNode && tree.focusedId === treeNode.id;

  React.useEffect(() => {
    if (focused && tree.shouldPullFocus) ref.current?.focus();
  }, [focused, tree.shouldPullFocus]);

  if (!treeNode) {
    return (
      <div className={cn('vk-nrow', className)} title={title ?? label}>
        {leading}
        <span className="vk-nm">{label}</span>
        {trailing}
      </div>
    );
  }

  // The honest depth marker. Browsing all 5,742 areas is a real feature, but a
  // specialized flow exists for a handful — and a person deciding where to
  // spend a five-question flow deserves to know which before they start, not
  // after.
  const deep = tree.deep.has(treeNode.id);

  return (
    <div
      ref={ref}
      role="treeitem"
      aria-level={treeNode.level}
      aria-selected={focused}
      tabIndex={focused ? 0 : -1}
      className={cn('vk-nrow', className)}
      title={deep ? t('atlas.deepSearchTitle') : (title ?? label)}
      onFocus={() => tree.onFocusRow(treeNode.id)}
    >
      {leading}
      <span className="vk-nm">{label}</span>
      {deep && <span className="vk-deepbadge">{t('atlas.deepSearch')}</span>}
      {trailing}
    </div>
  );
}

/**
 * An expandable node of the Decision Worlds tree. A div with button
 * semantics rather than a <button>, because category rows nest a real
 * pin <button> inside and buttons cannot contain buttons.
 */
function TreeRow({
  id,
  level,
  open,
  onToggle,
  label,
  title,
  leading,
  trailing,
  className,
}: {
  /** Stable node id — the same key the expansion state is stored under. */
  id: string;
  /** 1-based depth, for aria-level. */
  level: number;
  open: boolean;
  onToggle: () => void;
  label: string;
  title?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
}) {
  const tree = useTree();
  const focused = tree.focusedId === id;
  const ref = React.useRef<HTMLDivElement>(null);

  // Roving tabindex: exactly ONE row is in the tab order. Before this every one
  // of the 5,742 rows carried tabIndex={0}, so tabbing past the sidebar meant
  // pressing Tab thousands of times.
  React.useEffect(() => {
    if (focused && tree.shouldPullFocus) ref.current?.focus();
  }, [focused, tree.shouldPullFocus]);

  return (
    <div
      ref={ref}
      role="treeitem"
      aria-expanded={open}
      aria-level={level}
      aria-selected={focused}
      tabIndex={focused ? 0 : -1}
      className={cn('vk-nrow', className)}
      data-open={open ? '' : undefined}
      title={title ?? label}
      onFocus={() => tree.onFocusRow(id)}
      onClick={onToggle}
    >
      <CaretIcon className="vk-tw" />
      {leading}
      <span className="vk-nm">{label}</span>
      {trailing}
    </div>
  );
}

/** The pin toggle that lives at the end of taxonomy and pinned rows. */
function PinButton({
  on,
  label,
  onToggle,
}: {
  on: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="vk-pin"
      data-on={on ? '' : undefined}
      aria-pressed={on}
      aria-label={on ? `Unpin ${label}` : `Pin ${label}`}
      onClick={(event) => {
        // The row underneath toggles the tree — a pin click is not that.
        event.stopPropagation();
        onToggle();
      }}
    >
      <svg
        viewBox="0 0 24 24"
        fill={on ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={1.6}
        aria-hidden="true"
      >
        <path
          d="M12 17v5M7 4h10l-1 7 3 3H5l3-3-1-7z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

/* ---------------------------------------------------------------------
   Decision Worlds tree
   ------------------------------------------------------------------- */

function WorldNode({
  world,
  atlasOpen,
  pinnedKeys,
}: {
  world: DecisionWorld;
  atlasOpen: Record<string, boolean>;
  pinnedKeys: Set<string>;
}) {
  const t = useT();
  const open = !!atlasOpen[world.id];
  const categories = categoriesOf(world.id);
  return (
    <>
      <TreeRow
        id={world.id}
        level={1}
        open={open}
        onToggle={() => toggleAtlasNode(world.id)}
        label={world.display}
        title={world.name}
        leading={
          <span
            className="vk-tone"
            style={{ background: world.tone }}
            aria-hidden="true"
          />
        }
        trailing={<span className="vk-rc">{categories.length}</span>}
      />
      {open && (
        <div className="vk-tchildren" role="group">
          {categories.map((category) => {
            const catOpen = !!atlasOpen[`${world.id}|${category.id}`];
            const pin: PinnedItem = {
              kind: 'category',
              worldId: world.id,
              catId: category.id,
              label: category.name,
            };
            return (
              <React.Fragment key={category.id}>
                <TreeRow
                  id={`${world.id}|${category.id}`}
                  level={2}
                  open={catOpen}
                  onToggle={() => toggleAtlasNode(`${world.id}|${category.id}`)}
                  label={category.name}
                  trailing={
                    <>
                      {category.expert && (
                        <span className="vk-expbadge">
                          {t('sidebar.expert')}
                        </span>
                      )}
                      <span className="vk-rc">{category.subs.length}</span>
                      <PinButton
                        on={pinnedKeys.has(pinKey(pin))}
                        label={category.name}
                        onToggle={() => togglePin(pin)}
                      />
                    </>
                  }
                />
                {catOpen && (
                  <div className="vk-tchildren" role="group">
                    {category.subs.map((sub) => {
                      const subPin: PinnedItem = {
                        kind: 'subcategory',
                        worldId: world.id,
                        catId: category.id,
                        sub,
                        label: sub,
                      };
                      return (
                        <StaticRow
                          key={sub}
                          treeNode={{
                            id: `${world.id}|${category.id}|${sub}`,
                            level: 3,
                          }}
                          className="vk-tleaf"
                          label={sub}
                          title={officialCrumb(world.id, category.id, sub)}
                          trailing={
                            <PinButton
                              on={pinnedKeys.has(pinKey(subPin))}
                              label={sub}
                              onToggle={() => togglePin(subPin)}
                            />
                          }
                        />
                      );
                    })}
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ---------------------------------------------------------------------
   Account menu
   ------------------------------------------------------------------- */

type MenuPosition = { left: number; bottom: number };

function AccountMenu({
  account,
  authenticated,
  position,
  onClose,
  onSignIn,
  onSignOut,
}: {
  account: Account;
  authenticated: boolean;
  position: MenuPosition;
  onClose: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
}) {
  const t = useT();
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!ref.current?.contains(target)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    // Deferred: the click that opened the menu is still propagating.
    const id = setTimeout(() => {
      document.addEventListener('pointerdown', onPointerDown);
    }, 0);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      clearTimeout(id);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  const soon = t('soon.account');

  const item = (
    key: string,
    label: string,
    Icon: (props: IconProps) => React.JSX.Element
  ) => (
    <button
      key={key}
      type="button"
      role="menuitem"
      className="vk-pop-i"
      disabled
      aria-disabled="true"
      title={soon}
    >
      <span className="vk-pop-ic">
        <Icon />
      </span>
      {label}
    </button>
  );

  return createPortal(
    <div
      ref={ref}
      className="vk-pop"
      role="menu"
      aria-label={t('sidebar.account')}
      style={{ left: position.left, bottom: position.bottom }}
    >
      <div className="vk-pop-head">
        <span className="vk-avatar" aria-hidden="true">
          {account.initial}
        </span>
        <div className="vk-pop-id">
          <div className="vk-pop-name">{account.name ?? account.email}</div>
          <div className="vk-pop-mail">
            {authenticated ? account.email : t('sidebar.notSignedIn')}
          </div>
        </div>
      </div>

      <div className="vk-pop-grp">{t('sidebar.account')}</div>
      {item('profile', t('pop.myProfile'), ProfileIcon)}
      {item('plan', t('pop.myPlan'), PlanIcon)}
      {item('usage', 'Usage', UsageIcon)}

      <div className="vk-pop-grp">{t('pop.personalization')}</div>
      {item('personalization', 'Personalization', PersonalizationIcon)}
      {item('language', 'Language', LanguageIcon)}
      {item('settings', 'Settings', SettingsIcon)}

      <div className="vk-pop-grp">{t('pop.support')}</div>
      {item('help', 'Help & Support', HelpIcon)}

      <div className="vk-pop-sep" />
      {authenticated ? (
        <button
          type="button"
          role="menuitem"
          className="vk-pop-i vk-pop-i-danger"
          onClick={() => {
            onClose();
            onSignOut();
          }}
        >
          <span className="vk-pop-ic">
            <SignOutIcon />
          </span>
          Sign Out
        </button>
      ) : (
        <button
          type="button"
          role="menuitem"
          className="vk-pop-i"
          onClick={() => {
            onClose();
            onSignIn();
          }}
        >
          <span className="vk-pop-ic">
            <SignInIcon />
          </span>
          Sign in
        </button>
      )}
    </div>,
    document.body
  );
}

/* ---------------------------------------------------------------------
   Sidebar
   ------------------------------------------------------------------- */

/**
 * The Decision Worlds tree — the WAI-ARIA `tree` pattern over the full
 * 10 / 198 / 5,742 taxonomy.
 *
 * Before this the rows were a flat stack of `role="button"` divs each carrying
 * `tabIndex={0}`, which meant a keyboard user tabbing past the sidebar had to
 * press Tab once per visible row. The tree gives it one tab stop and the arrow
 * keys screen-reader users already expect.
 */
function DecisionWorldsTree({
  atlasOpen,
  pinnedKeys,
}: {
  atlasOpen: Record<string, boolean>;
  pinnedKeys: Set<string>;
}) {
  const t = useT();
  const { dir } = useLocale();
  const [focusedId, setFocusedId] = React.useState<string | null>(null);
  const [shouldPullFocus, setShouldPullFocus] = React.useState(false);
  const [coverage, setCoverage] = React.useState<Coverage>(EMPTY_COVERAGE);

  // Which areas carry a specialized flow is the BACKEND's answer, read once.
  // Starting from empty means the tree renders immediately and understates
  // depth until the truth arrives — never the other way round.
  React.useEffect(() => {
    let cancelled = false;
    void getClientConfig().then((cfg) => {
      if (!cancelled) setCoverage(cfg.coverage);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const deep = React.useMemo(() => specializedNodeIds(coverage), [coverage]);

  // The flattened VISIBLE rows, in screen order. A collapsed subtree's children
  // are absent, which is what makes ArrowDown land on the next visible row
  // rather than inside hidden content.
  const nodes = React.useMemo<TreeNode[]>(() => {
    const out: TreeNode[] = [];
    for (const world of DECISION_WORLDS) {
      const worldOpen = !!atlasOpen[world.id];
      out.push({ id: world.id, level: 1, expanded: worldOpen });
      if (!worldOpen) continue;
      for (const category of categoriesOf(world.id)) {
        const catId = `${world.id}|${category.id}`;
        const catOpen = !!atlasOpen[catId];
        out.push({
          id: catId,
          level: 2,
          expanded: catOpen,
          parentId: world.id,
        });
        if (!catOpen) continue;
        for (const sub of category.subs) {
          out.push({ id: `${catId}|${sub}`, level: 3, parentId: catId });
        }
      }
    }
    return out;
  }, [atlasOpen]);

  const current = focusedId ?? nodes[0]?.id ?? null;

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!current) return;
    const action = treeKeyAction(event.key, current, nodes, dir);
    if (action.type === 'none') return;
    event.preventDefault();
    setShouldPullFocus(true);
    switch (action.type) {
      case 'focus':
        setFocusedId(action.id);
        break;
      case 'expand':
      case 'collapse':
      case 'activate':
        toggleAtlasNode(action.id);
        setFocusedId(action.id);
        break;
    }
  };

  const ctx = React.useMemo<TreeCtx>(
    () => ({
      focusedId: current,
      shouldPullFocus,
      onFocusRow: (id: string) => {
        setShouldPullFocus(false);
        setFocusedId(id);
      },
      deep,
    }),
    [current, shouldPullFocus, deep]
  );

  return (
    <TreeContext.Provider value={ctx}>
      <div role="tree" aria-label={t('atlas.tree')} onKeyDown={onKeyDown}>
        {DECISION_WORLDS.map((world) => (
          <WorldNode
            key={world.id}
            world={world}
            atlasOpen={atlasOpen}
            pinnedKeys={pinnedKeys}
          />
        ))}
      </div>
    </TreeContext.Provider>
  );
}

export function AppSidebar({
  history,
  historyLoading = false,
  account,
  authenticated,
  activeId,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
  onNewChat,
  onSignIn,
  onSignOut,
  fill = false,
}: SidebarProps) {
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const { locale } = useLocale();
  const t = useT();
  const { sidebarCollapsed, sidebarSections, atlasOpen } = useShell();
  const { pinned, collections } = useYourLumora();
  const [pinsExpanded, setPinsExpanded] = React.useState(false);

  const [deleteTarget, setDeleteTarget] = React.useState<{
    id: string;
    title: string;
  } | null>(null);
  const [renameTarget, setRenameTarget] = React.useState<{
    id: string;
    title: string;
  } | null>(null);
  const [renameDraft, setRenameDraft] = React.useState('');
  const [menu, setMenu] = React.useState<MenuPosition | null>(null);
  const accountRef = React.useRef<HTMLButtonElement>(null);
  // The index a pinned-row drag started from — shared across rows.
  const dragFrom = React.useRef<number | null>(null);

  const open = (id: string) => sidebarSections[id] ?? false;

  const pinnedKeys = new Set(pinned.map(pinKey));
  const visiblePins = pinsExpanded ? pinned : pinned.slice(0, PINNED_PREVIEW);

  // The region clips its overflow and the menu opens upward past the top of
  // the account row, so it is portalled and positioned against the trigger.
  const toggleMenu = () => {
    if (menu) {
      setMenu(null);
      return;
    }
    const rect = accountRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMenu({ left: rect.left, bottom: window.innerHeight - rect.top + 8 });
  };

  const closeMenu = () => {
    setMenu(null);
    accountRef.current?.focus({ preventScroll: true });
  };

  return (
    <aside
      // Standalone: explicit width, not flex-basis — the sidebar must measure
      // the same regardless of content and of whether its parent is a flex
      // container. In the App Frame the track sizes it, and the frame region
      // already draws the divider and gradient.
      className={cn(
        'vk-side flex h-full flex-none flex-col overflow-hidden',
        fill
          ? 'w-full'
          : 'border-r border-[rgba(150,178,205,0.10)] bg-[var(--vk-surface)] transition-[width] duration-[280ms] ease-[var(--vk-ease-standard)] motion-reduce:transition-none'
      )}
      data-collapsed={sidebarCollapsed ? '' : undefined}
      style={fill ? undefined : { width: sidebarCollapsed ? 72 : 232 }}
    >
      <div className="vk-side-top">
        <div className="vk-brand">
          <LogoMark size={28} style={{ objectFit: 'contain' }} />
          <span className="vk-wm">LUMORA</span>
        </div>

        <button type="button" className="vk-newdec" onClick={onNewChat}>
          <PlusIcon />
          <span>{t('nav.newDecision')}</span>
        </button>

        <button
          type="button"
          className="vk-shell-collapse vk-side-collapse"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          aria-expanded={!sidebarCollapsed}
          aria-label={
            sidebarCollapsed ? t('sidebar.expand') : t('sidebar.collapse')
          }
          title={sidebarCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}
        >
          <ChevronLeftIcon />
        </button>
      </div>

      <nav className="vk-sidenav" aria-label={t('sidebar.decisions')}>
        <GroupLabel>{t('sidebar.explore')}</GroupLabel>
        <Section
          id="atlas"
          title={t('sidebar.decisionWorlds')}
          badge={String(TOTAL_WORLDS)}
          open={open('atlas')}
        >
          <div className="vk-atlas-mini">
            <div className="vk-atlas-counts">
              {t('atlas.counts', {
                worlds: TOTAL_WORLDS,
                categories: TOTAL_CATEGORIES,
                areas: TOTAL_AREAS.toLocaleString(
                  locale === 'en' ? 'en-US' : locale
                ),
              })}
            </div>
            <StaticRow
              className="vk-nrow-atlas"
              label={t('atlas.exploreAll')}
              trailing={<span className="vk-rc">⤢</span>}
            />
          </div>
          <DecisionWorldsTree atlasOpen={atlasOpen} pinnedKeys={pinnedKeys} />
        </Section>

        <GroupLabel>{t('sidebar.yourLumora')}</GroupLabel>
        <Section
          id="pinned"
          title={t('sidebar.pinned')}
          badge={pinned.length ? String(pinned.length) : undefined}
          open={open('pinned')}
        >
          {pinned.length === 0 ? (
            <EmptyRow>
              Pin any World, category, subcategory or decision to keep it here.
            </EmptyRow>
          ) : (
            <>
              {visiblePins.map((item, index) => (
                <div
                  key={pinKey(item)}
                  className="vk-nrow vk-pinrow"
                  title={officialCrumb(item.worldId, item.catId, item.sub)}
                  draggable
                  onDragStart={(event) => {
                    dragFrom.current = index;
                    event.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(event) => {
                    if (dragFrom.current !== null) event.preventDefault();
                  }}
                  onDrop={(event) => {
                    if (dragFrom.current === null) return;
                    event.preventDefault();
                    movePin(dragFrom.current, index);
                    dragFrom.current = null;
                  }}
                  onDoubleClick={() => {
                    const alias = window.prompt(
                      t('sidebar.renameShortcut'),
                      item.alias ?? item.label
                    );
                    if (alias !== null) renamePin(index, alias);
                  }}
                >
                  <span className="vk-nm">{item.alias ?? item.label}</span>
                  <PinButton
                    on
                    label={item.alias ?? item.label}
                    onToggle={() => togglePin(item)}
                  />
                </div>
              ))}
              {pinned.length > PINNED_PREVIEW && (
                <NavRow
                  className="vk-nrow-viewall"
                  label={
                    pinsExpanded
                      ? t('sidebar.showLess')
                      : `Show more (${pinned.length - PINNED_PREVIEW})`
                  }
                  onClick={() => setPinsExpanded(!pinsExpanded)}
                />
              )}
            </>
          )}
        </Section>

        <Section
          id="mydecisions"
          title={t('sidebar.myDecisions')}
          badge={history.length ? String(history.length) : undefined}
          open={open('mydecisions')}
        >
          {historyLoading ? (
            <div className="flex flex-col gap-1 px-2.5 py-1">
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : history.length === 0 ? (
            <EmptyRow>
              {authenticated
                ? 'Decisions you start appear here by status.'
                : 'Sign in to see your decisions.'}
            </EmptyRow>
          ) : (
            <>
              <SubLabel>{t('sidebar.inProgress')}</SubLabel>
              {history.map((conversation) => (
                <DecisionRow
                  key={conversation.id}
                  title={conversation.title}
                  time={conversation.time}
                  active={conversation.id === activeId}
                  onSelect={() => onSelectConversation(conversation.id)}
                  onDelete={
                    onDeleteConversation
                      ? () =>
                          setDeleteTarget({
                            id: conversation.id,
                            title: conversation.title,
                          })
                      : undefined
                  }
                  onRename={
                    onRenameConversation
                      ? () => {
                          setRenameTarget({
                            id: conversation.id,
                            title: conversation.title,
                          });
                          setRenameDraft(conversation.title);
                        }
                      : undefined
                  }
                />
              ))}
            </>
          )}
        </Section>

        <Section
          id="collections"
          title={t('sidebar.collections')}
          badge={collections.length ? String(collections.length) : undefined}
          open={open('collections')}
        >
          {collections.length === 0 ? (
            <EmptyRow>No collections yet.</EmptyRow>
          ) : (
            collections.map((collection, index) => (
              <StaticRow
                key={`${collection.name}-${index}`}
                label={collection.name}
                trailing={
                  <span className="vk-rc">{collection.items.length}</span>
                }
              />
            ))
          )}
          <NavRow
            className="vk-nrow-viewall"
            label="+ New collection"
            onClick={() => {
              const name = window.prompt(t('sidebar.nameCollection'));
              if (name) addCollection(name);
            }}
          />
        </Section>

        <Section id="recent" title={t('sidebar.recent')} open={open('recent')}>
          <EmptyRow>{t('sidebar.recentEmpty')}</EmptyRow>
        </Section>
      </nav>

      <div className="vk-side-bottom">
        <button
          ref={accountRef}
          type="button"
          className="vk-sb-row vk-sb-user"
          onClick={toggleMenu}
          aria-haspopup="menu"
          aria-expanded={menu !== null}
          title={authenticated ? account.email : 'Guest'}
        >
          <span className="vk-avatar" aria-hidden="true">
            {account.initial}
          </span>
          <span className="vk-sb-user-txt">
            <span className="vk-sb-name">{account.name ?? account.email}</span>
            <span className="vk-sb-plan">
              {authenticated ? t('plan.free') : t('sidebar.notSignedIn')}
            </span>
          </span>
          <ChevronUpIcon className="vk-sb-chev" />
        </button>

        {/* Language and Settings are the same surface: language IS a setting,
            and two entry points to one dialog is the honest shape. Help remains
            disabled because it genuinely does not exist yet. */}
        <button
          type="button"
          className="vk-sb-row"
          onClick={() => setSettingsOpen(true)}
        >
          <LanguageIcon />
          <span className="vk-sb-label">{t('sidebar.language')}</span>
        </button>
        <button
          type="button"
          className="vk-sb-row"
          onClick={() => setSettingsOpen(true)}
        >
          <SettingsIcon />
          <span className="vk-sb-label">{t('sidebar.settings')}</span>
        </button>
        <button
          type="button"
          className="vk-sb-row"
          disabled
          title={t('soon.help')}
        >
          <HelpIcon />
          <span className="vk-sb-label">{t('sidebar.help')}</span>
        </button>

        <button
          type="button"
          className="vk-sb-row vk-sb-collapse"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          aria-expanded={!sidebarCollapsed}
        >
          <ChevronLeftIcon />
          <span className="vk-sb-label">{t('sidebar.collapse')}</span>
        </button>
      </div>

      {menu && (
        <AccountMenu
          account={account}
          authenticated={authenticated}
          position={menu}
          onClose={closeMenu}
          onSignIn={onSignIn}
          onSignOut={onSignOut}
        />
      )}

      {/* Delete confirmation — centered, dismissible, the destructive click
          lives HERE and nowhere else. Rendered from the sidebar (not the row)
          so it survives the row's menu closing. */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(next) => {
          if (!next) setDeleteTarget(null);
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="shadow-[0_24px_64px_rgba(249, 248, 242, 0.55)] max-w-[440px] gap-0 rounded-2xl border-[var(--vk-border)] bg-[var(--vk-surface-2)] p-6"
        >
          <DialogTitle className="text-[17px] font-semibold text-[var(--vk-text-strong)]">
            Delete chat?
          </DialogTitle>
          <DialogDescription className="mt-2 text-[13.5px] leading-[1.55] text-[var(--vk-text-subtle)]">
            This will delete{' '}
            <span className="font-semibold text-[var(--vk-text-strong)]">
              {deleteTarget?.title || 'this conversation'}
            </span>
            . You can&rsquo;t undo this.
          </DialogDescription>
          <div className="mt-5 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="cursor-pointer rounded-full border border-[rgba(150,178,205,0.28)] px-4 py-2 text-[13px] font-medium text-[var(--vk-text)] transition-colors hover:bg-[rgba(150,178,205,0.1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--vk-accent-ring)]"
            >
              Cancel
            </button>
            <button
              type="button"
              autoFocus
              onClick={() => {
                const target = deleteTarget;
                setDeleteTarget(null);
                if (target) onDeleteConversation?.(target.id);
              }}
              className="cursor-pointer rounded-full bg-[#C2625A] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#CE6C63] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8A79E]"
            >
              Delete
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename — centered, like Delete (stress finding #10). */}
      <Dialog
        open={renameTarget !== null}
        onOpenChange={(next) => {
          if (!next) setRenameTarget(null);
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="shadow-[0_24px_64px_rgba(249, 248, 242, 0.55)] max-w-[440px] gap-0 rounded-2xl border-[var(--vk-border)] bg-[var(--vk-surface-2)] p-6"
        >
          <DialogTitle className="text-[17px] font-semibold text-[var(--vk-text-strong)]">
            Rename chat
          </DialogTitle>
          <DialogDescription className="mt-2 text-[13.5px] leading-[1.55] text-[var(--vk-text-subtle)]">
            A name you set here is permanent — Lumora never auto-renames it.
          </DialogDescription>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const target = renameTarget;
              const title = renameDraft.trim();
              setRenameTarget(null);
              if (target && title && title !== target.title) {
                onRenameConversation?.(target.id, title);
              }
            }}
          >
            <input
              autoFocus
              value={renameDraft}
              onChange={(event) => setRenameDraft(event.target.value)}
              maxLength={200}
              dir="auto"
              aria-label={t('sidebar.conversationName')}
              className="bg-[rgba(249, 248, 242, 0.6)] mt-4 w-full rounded-[11px] border border-[var(--vk-border)] px-3.5 py-2.5 text-[14px] text-[var(--vk-text-strong)] outline-none focus-visible:border-[var(--vk-accent)] focus-visible:shadow-[0_0_0_3px_var(--vk-accent-ring)]"
            />
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                className="cursor-pointer rounded-full border border-[rgba(150,178,205,0.28)] px-4 py-2 text-[13px] font-medium text-[var(--vk-text)] transition-colors hover:bg-[rgba(150,178,205,0.1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--vk-accent-ring)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!renameDraft.trim()}
                className="cursor-pointer rounded-full bg-linear-[150deg,#348568,#28765c] px-4 py-2 text-[13px] font-semibold text-[var(--vk-on-accent)] transition-colors hover:bg-linear-[150deg,#F6BC5C,#F09A3B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--vk-accent-ring)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Rename
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      {settingsOpen && (
        <SettingsDialog onClose={() => setSettingsOpen(false)} />
      )}
    </aside>
  );
}
