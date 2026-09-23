'use client';

import { Menu } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';

import { AppSidebar } from '@/components/lumora/app-sidebar';
import {
  ActivityPanel,
  type ActivityWaiting,
  type FactorPreview,
} from '@/components/lumora/chat/activity-tracker';
import { AnalysisJourney } from '@/components/lumora/chat/analysis-journey';
import {
  AssistantActions,
  AssistantBlock,
  AssistantProse,
  CardBlock,
  UserBubble,
} from '@/components/lumora/chat/chat-message';
import { DealsCards } from '@/components/lumora/chat/deals-cards';
import {
  InsightPanel,
  type PanelTab,
} from '@/components/lumora/chat/insight-panel';
import { PanelAnalysis } from '@/components/lumora/chat/panel-analysis';
import { PanelOffers } from '@/components/lumora/chat/panel-offers';
import { PanelProducts } from '@/components/lumora/chat/panel-products';
import { QFlowCards } from '@/components/lumora/chat/qflow-cards';
import { ReadyCard } from '@/components/lumora/chat/ready-card';
import {
  composeAnswerMessage,
  RequirementQuestions,
  SelectedAnswers,
  type AnswerSelection,
} from '@/components/lumora/chat/requirement-questions';
import { StageStatus } from '@/components/lumora/chat/stage-status';
import { UnderstandingCard } from '@/components/lumora/chat/understanding-card';
import {
  AnalysisCompareTab,
  AnalysisDecisionTab,
  AnalysisMarketTab,
  AnalysisReadyCard,
} from '@/components/lumora/chat/workspace-analysis';
import { WorkspaceEmpty } from '@/components/lumora/chat/workspace-empty';
import { WorldHeader } from '@/components/lumora/chat/world-header';
import { Composer } from '@/components/lumora/composer';
import { LoginModal } from '@/components/lumora/login-modal';
import { LogoMark } from '@/components/lumora/logo';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { formatRelativeTime } from '@/lib/api/conversations';
import {
  deleteConversation,
  renameConversation,
} from '@/lib/api/conversations';
import { getQuota } from '@/lib/api/quota';
import type {
  AnalysisPayload,
  QFlowAnswer,
  UnderstandingPayload,
  DealsPayload,
  QuotaStatus,
  CandidateProduct,
  ChatMessage,
  MessageKind,
  Question,
  RequirementPayload,
} from '@/lib/api/types';
import { useAuth } from '@/lib/auth/auth-provider';
import { accountFrom, GUEST_ACCOUNT } from '@/lib/auth/identity';
import { useChatHistory } from '@/lib/conversation/chat-history-provider';
import { takeFirstMessage } from '@/lib/conversation/first-message';
import {
  mergeStages,
  stagesFromAnalysisJob,
  stagesFromHistory,
} from '@/lib/conversation/stages-from-history';
import { useAnalysisJob } from '@/lib/conversation/use-analysis-job';
import { useConversation } from '@/lib/conversation/use-conversation';
import { useT } from '@/lib/i18n/provider';
import { armComposeFocus } from '@/lib/shell/compose-intent';
import { resolveWorldContext } from '@/lib/taxonomy/resolve';
import { cn } from '@/lib/utils';

function subscribeOnline(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

const DEFAULT_PANEL_WIDTH = 'clamp(560px, 41vw, 800px)';

/** Index of the newest message of a kind, -1 when absent. */
function latestKindIndex(messages: ChatMessage[], kind: MessageKind): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].kind === kind) return i;
  }
  return -1;
}

/** Newest structured payload that names a category → the world skin. */
function findWorldContext(messages: ChatMessage[]) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (
      message.kind === 'requirement' ||
      message.kind === 'understanding' ||
      message.kind === 'analysis'
    ) {
      const category = (message.payload as { category?: string } | undefined)
        ?.category;
      if (category) return resolveWorldContext(category);
    }
  }
  return null;
}

function asRequirement(message: ChatMessage): RequirementPayload | null {
  if (message.kind !== 'requirement') return null;
  const payload = message.payload as RequirementPayload | undefined;
  if (!payload || typeof payload !== 'object') return null;
  return payload;
}

function dayLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return '';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  });
}

function GateCard({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-8">
      <div className="vk-anim-in-up shadow-[0_22px_50px_rgba(249, 248, 242, 0.25)] w-full max-w-[420px] rounded-[18px] border border-[var(--vk-border)] bg-[var(--vk-surface-2)] p-7 text-center">
        <LogoMark size={44} className="mx-auto" />
        <h2 className="mt-4 mb-0 text-[19px] font-semibold tracking-[-0.015em] text-[var(--vk-text-strong)]">
          {title}
        </h2>
        <p className="mt-2 mb-0 text-sm leading-[1.6] text-[var(--vk-text-muted)]">
          {body}
        </p>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="mt-5 inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-[11px] border border-[rgba(232,137,46,0.48)] bg-linear-[150deg,#348568,#28765c] px-5 text-sm font-semibold text-[var(--vk-on-accent)] shadow-[0_10px_26px_-8px_rgba(232,137,46,0.5)] transition-transform outline-none hover:-translate-y-px hover:bg-linear-[150deg,#F6BC5C,#F09A3B] hover:shadow-[0_14px_32px_-8px_rgba(232,137,46,0.62)] focus-visible:shadow-[0_0_0_3px_var(--vk-accent-ring)]"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

/** Earliest exhausted window's reset, as a local time label. */
function formatResetTime(quota: QuotaStatus): string {
  const exhausted = [quota.day, quota.month].filter((w) => w.limited);
  const windows = exhausted.length > 0 ? exhausted : [quota.day];
  const soonest = windows.reduce((a, b) =>
    new Date(a.resets_at) <= new Date(b.resets_at) ? a : b
  );
  const at = new Date(soonest.resets_at);
  return at.toLocaleString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  });
}

export function ChatScreen({
  conversationId: initialConversationId,
}: {
  /** A backend id, or null for `/chat/new` — the value at first render. */
  conversationId: string | null;
}) {
  const t = useT();
  const router = useRouter();
  const { status, identity, profile, signOut } = useAuth();

  // The live thread target comes from the pathname, not the server prop: the
  // pathname also tracks the transitions that DON'T remount this screen —
  // the replaceState id adoption below, and same-segment navigations (an
  // adopted /chat/new navigating to /chat/new again). Cross-id navigations
  // remount the page subtree, so those reset naturally.
  const pathname = usePathname();
  const conversationId = React.useMemo(() => {
    const segment = /^\/chat\/([^/]+)\/?$/.exec(pathname ?? '')?.[1];
    if (!segment) return initialConversationId;
    return segment === 'new' ? null : decodeURIComponent(segment);
  }, [pathname, initialConversationId]);

  // ---- Sidebar data ----
  // Owned by the root layout's ChatHistoryProvider: this screen remounts on
  // every conversation switch (pages get a fresh instance per URL), so the
  // list would flash empty on navigation if it were screen state.
  const { conversations, refresh: refreshConversations } = useChatHistory();

  // The selection sent with the last "compare" turn, for restore-on-failure.
  const lastCompareSelectionRef = React.useRef<ReadonlySet<string>>(new Set());

  // Quota awareness (advisory): fetched on mount and refreshed after each
  // completed turn. The backend enforces; this only warns before typing.
  const [quota, setQuota] = React.useState<QuotaStatus | null>(null);
  const refreshQuota = React.useCallback(() => {
    void getQuota().then((q) => setQuota(q));
  }, []);
  React.useEffect(() => {
    refreshQuota();
  }, [refreshQuota]);

  const conversation = useConversation({
    conversationId,
    onConversationCreated: (id) => {
      // Adopt the real id in the URL without remounting the screen
      // (Next.js integrates native replaceState into its router).
      window.history.replaceState(null, '', `/chat/${id}`);
      refreshConversations();
    },
    onTurnDone: () => {
      refreshConversations();
      refreshQuota();
    },
    // A send that failed before the backend committed anything hands the
    // input straight back — nothing typed or selected may disappear.
    onSendFailed: (input) => {
      if (input.selectedProducts?.length) {
        setSelectedProducts(lastCompareSelectionRef.current);
      } else if (input.content) {
        setComposerText(input.content);
      }
    },
  });

  const {
    load,
    id,
    messages,
    turn,
    decisionStages,
    freshDecision,
    latestRequirement,
    candidates,
    marketplace,
    research,
    recommendation,
    dataSeq,
    send,
    stop,
    regenerate,
    dismissTurnError,
    reload,
  } = conversation;

  // ---- Composer + answers ----
  const [composerText, setComposerText] = React.useState('');
  const [answerSelection, setAnswerSelection] = React.useState<AnswerSelection>(
    {}
  );
  const [selectedProducts, setSelectedProducts] = React.useState<
    ReadonlySet<string>
  >(new Set());

  // ---- Optimistic Known-factors preview ----
  // The question flow answers locally and submits in ONE batch, so the
  // backend echo arrives only after the last question. This lifted state is
  // what lets Known factors move as each answer's tag flight arrives (or
  // right away when nothing flies); the flow card reports its local answer
  // set here, the activity rail merges it per question id, and the flight
  // animation targets this ref.
  const [qflowPreview, setQflowPreview] = React.useState<FactorPreview[]>([]);
  const factorsTargetRef = React.useRef<HTMLDivElement | null>(null);

  // ---- Panel ----
  const [panelOpen, setPanelOpen] = React.useState(false);
  // Design tab order opens on the decision, not the board (`rpa-nav`
  // marks My Best Choice active on first paint).
  const [panelTab, setPanelTab] = React.useState<PanelTab>('analysis');
  // Design width: the workspace column is `clamp(560px, 41vw, 800px)`
  // (the `.app.ws-analysis.ws-wide` grid); the divider still writes px
  // when dragged.
  const [panelWidth, setPanelWidth] = React.useState(DEFAULT_PANEL_WIDTH);
  const splitRef = React.useRef<HTMLDivElement>(null);

  // The decision pipeline, run detached. `reload()` is the whole completion
  // handler: the job persists every stage as a real message, so the payloads
  // are already in history by the time it reports ready.
  // Written below once `openWorkspace` exists (it reads state declared later);
  // the job's completion callback closes over the ref, not the function.
  const openWorkspaceRef = React.useRef<(preferred: PanelTab) => void>(
    () => {}
  );
  const analysisJob = useAnalysisJob(conversationId, (outcome) => {
    void (async () => {
      await reload();
      if (outcome === 'result') openWorkspaceRef.current('analysis');
    })();
  });

  // ---- v0.13 analysis result ----
  // The golden path's single result event: rec + finalists + market drive
  // all three workspace tabs. Selecting a finalist on the compare tab
  // re-targets the marketplace tab (the payload carries offers per finalist),
  // so the selection lives here, shared by both.
  // The current collection round starts at the newest requirement message —
  // the backend commits one whenever it (re)opens the flow, including on an
  // edit. Every payload older than it was computed from answers the user has
  // since reopened, and counting it would resurrect the invalidated result.
  const requirementIndex = latestKindIndex(messages, 'requirement');
  const understandingIndex = latestKindIndex(messages, 'understanding');
  const analysisIndexRaw = latestKindIndex(messages, 'analysis');
  const analysisIndex =
    analysisIndexRaw > requirementIndex ? analysisIndexRaw : -1;
  const latestAnalysis =
    analysisIndex >= 0
      ? (messages[analysisIndex].payload as AnalysisPayload | undefined)
      : undefined;
  const analysisReady = Boolean(latestAnalysis?.rec?.best?.name);
  const [finalistIndex, setFinalistIndex] = React.useState(0);

  const [loginOpen, setLoginOpen] = React.useState(false);

  const [navOpen, setNavOpen] = React.useState(false);

  // Offline awareness — the browser's connectivity is an external store.
  const online = React.useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true
  );

  const authenticated = status === 'authenticated';
  const account = accountFrom(identity, profile) ?? GUEST_ACCOUNT;

  const worldContext = findWorldContext(messages);

  // The user's opening prompt becomes the header's intent subtitle.
  const firstPrompt = messages.find((m) => m.role === 'user')?.content;

  // ---- New conversation: submit the stashed Home prompt exactly once ----
  const autoSendRef = React.useRef(false);
  React.useEffect(() => {
    if (conversationId !== null || !authenticated) return;
    if (autoSendRef.current) return;
    autoSendRef.current = true;
    const first = takeFirstMessage();
    if (first) send({ content: first });
  }, [conversationId, authenticated, send]);

  // ---- Session restored while looking at a 401 → reload the history ----
  React.useEffect(() => {
    if (
      authenticated &&
      load.phase === 'error' &&
      load.status === 401 &&
      conversationId !== null
    ) {
      reload();
    }
  }, [authenticated, load, conversationId, reload]);

  const candidatesSeq = dataSeq.candidates ?? 0;
  const recommendationSeq = dataSeq.recommendation ?? 0;
  const analysisSeq = dataSeq.analysis ?? 0;
  const [openedSeq, setOpenedSeq] = React.useState({
    candidates: 0,
    recommendation: 0,
    analysis: 0,
  });
  if (
    candidatesSeq !== openedSeq.candidates ||
    recommendationSeq !== openedSeq.recommendation ||
    analysisSeq !== openedSeq.analysis
  ) {
    // A LOWER seq means the hook reset for another thread — resync only.
    // Only a FINISHED result opens the panel: candidates arriving mid-turn
    // are the pipeline still thinking, and the rule is that the workspace
    // shows up with the answer, not with the work in progress.
    if (analysisSeq > openedSeq.analysis) {
      // The v0.13 `analysis` event carries all three tabs at once; a fresh
      // one also resets the finalist selection to LUMORA's pick.
      setFinalistIndex(0);
      setPanelTab('analysis');
      setPanelOpen(true);
    } else if (recommendationSeq > openedSeq.recommendation) {
      setPanelTab('analysis');
      setPanelOpen(true);
    }
    setOpenedSeq({
      candidates: candidatesSeq,
      recommendation: recommendationSeq,
      analysis: analysisSeq,
    });
  }

  // ---- Auto-scroll while the user is pinned to the bottom ----
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const stickRef = React.useRef(true);
  // Mirrors stickRef for the jump-to-latest affordance — a ref alone can't
  // re-render the button in and out.
  const [stuck, setStuck] = React.useState(true);
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, turn.draft, turn.stages]);

  const contentRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = scrollRef.current;
    const content = contentRef.current;
    if (!el || !content) return;
    const observer = new ResizeObserver(() => {
      if (stickRef.current) el.scrollTop = el.scrollHeight;
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  // ---- Thread switch: clear conversation-scoped UI state ----
  // The screen used to remount per thread (key={conversationId}); now it
  // stays mounted, so composer text, answer picks, and panel state must be
  // re-initialized by hand when navigation retargets it. Adoption (a `new`
  // thread taking its real id, so `id` already matches the new target) is
  // the one target change that is NOT a switch. State resets use React's
  // adjust-state-during-render pattern; the refs reset in the effect below.
  const [uiThread, setUiThread] = React.useState(conversationId);
  if (uiThread !== conversationId) {
    setUiThread(conversationId);
    if (!(conversationId !== null && conversationId === id)) {
      setComposerText('');
      setAnswerSelection({});
      setSelectedProducts(new Set());
      setQflowPreview([]);
      setFinalistIndex(0);
      setPanelOpen(false);
      setPanelTab('products');
      setPanelWidth(DEFAULT_PANEL_WIDTH);
      setStuck(true);
    }
  }
  const refThreadRef = React.useRef(conversationId);
  React.useEffect(() => {
    if (refThreadRef.current === conversationId) return;
    const adopted = conversationId !== null && conversationId === id;
    refThreadRef.current = conversationId;
    if (adopted) return;
    stickRef.current = true;
    lastCompareSelectionRef.current = new Set();
    autoSendRef.current = false;
  }, [conversationId, id]);

  const liveTail = messages[messages.length - 1];
  const draftRestatesQuestions = Boolean(
    turn.streaming && liveTail && asRequirement(liveTail)?.questions?.length
  );

  const activeRequirement = React.useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const message = messages[i];
      if (message.role === 'user') return null; // already answered
      const payload = asRequirement(message);
      if (payload?.questions?.length) return payload;
    }
    return null;
  }, [messages]);
  const activeQuestions: Question[] = React.useMemo(
    () =>
      !turn.streaming && activeRequirement?.questions?.length
        ? activeRequirement.questions
        : [],
    [turn.streaming, activeRequirement]
  );
  const hasSelections = Object.values(answerSelection).some(
    (picked) => picked.length > 0
  );

  const latestUnderstanding =
    understandingIndex >= 0 && understandingIndex > requirementIndex
      ? (messages[understandingIndex].payload as UnderstandingPayload)
      : null;
  // Consent, from every witness that can testify to it. The payload's own flag
  // lags reality (older backends never re-emitted it after confirm), but a
  // downstream payload PROVES consent — the pipeline only runs after it — and
  // a running analysis job IS the act of consenting. Reading the flag alone
  // kept the rail on "Waiting for your confirmation" after the answer shipped,
  // and kept the card offering a confirm the user had already pressed.
  const understandingConfirmed =
    Boolean(latestUnderstanding?.confirmed) ||
    Boolean(candidates) ||
    Boolean(recommendation) ||
    analysisReady ||
    analysisJob.phase === 'running' ||
    analysisJob.phase === 'done';

  // ---- Preview ⇄ backend reconciliation ----
  // A fresh `requirement` or `understanding` payload is the backend's own
  // account of the answers (the flow submits them all in one turn), so the
  // optimistic layer retires the moment either arrives. Chip identity is the
  // factor text and resolution is per question id, so the hand-off never
  // duplicates or reorders — and if the backend REJECTED an answer, the chip
  // honestly disappears instead of lingering. Adjust-state-during-render,
  // like the thread-switch reset above (React Compiler: no set-in-effect).
  const [seenPayloads, setSeenPayloads] = React.useState<{
    requirement: RequirementPayload | null;
    understanding: UnderstandingPayload | null;
  }>({ requirement: null, understanding: null });
  if (
    seenPayloads.requirement !== latestRequirement ||
    seenPayloads.understanding !== latestUnderstanding
  ) {
    setSeenPayloads({
      requirement: latestRequirement,
      understanding: latestUnderstanding,
    });
    if (qflowPreview.length > 0) setQflowPreview([]);
  }

  const flowPending = Boolean(
    latestRequirement?.flow?.questions?.some(
      (q) =>
        latestRequirement.flow?.answered?.[q.id] === undefined &&
        !(latestRequirement.flow?.skipped ?? []).includes(q.id)
    ) ||
    // A reopened question is pending even though its old answer is still
    // in `answered` — the edit is waiting on the replacement.
    latestRequirement?.flow?.editing
  );
  const activityReady = analysisIndex >= 0 || Boolean(recommendation);
  // The ladder reads history first, then this DECISION's live events —
  // `decisionStages`, not `turn.stages`. Two separate faults met here: a
  // reloaded thread had no live events at all (nine pending rungs under a
  // header already reading "Decision ready"), and within a session every new
  // turn reset the per-turn ladder, so completed rungs went dark and re-lit
  // out of order. History proves what ran; the decision ladder carries it
  // across turns.
  // The journey's counted labels: live figures from the running job first,
  // the persisted payloads on a reloaded thread second.
  const journeyCounts = {
    scanned:
      analysisJob.counts.scanned ?? candidates?.scan_summary?.scanned_count,
    finalists: analysisJob.counts.finalists ?? candidates?.products?.length,
    marketplaces:
      analysisJob.counts.marketplaces ??
      // Read by the backend's own counter key — data lookup, not copy.
      Object.fromEntries(
        (latestAnalysis?.market?.summary ?? []).map((s) => [s.k, s.v])
      )['Offers analysed'],
  };
  const activityStages = mergeStages(
    // Only the current round's messages prove rungs: after an edit the old
    // evidence is invalidated, and a lit ladder over a reopened question
    // would claim the pipeline still stands.
    mergeStages(
      // Between a NEW decision opening and its requirement payload landing,
      // the newest requirement message still belongs to the PREVIOUS round —
      // its history must not light the ladder for a request the pipeline is
      // only now classifying.
      freshDecision
        ? []
        : stagesFromHistory(
            requirementIndex > 0 ? messages.slice(requirementIndex) : messages
          ),
      decisionStages
    ),
    // The job reports on its own channel, not the turn stream — without this
    // the ladder froze for the minute the pipeline runs, then jumped to done.
    stagesFromAnalysisJob(analysisJob.progressTypes)
  );
  const activityWaiting: ActivityWaiting =
    turn.streaming || activityReady || analysisJob.phase === 'running'
      ? null
      : latestUnderstanding &&
          !understandingConfirmed &&
          understandingIndex > requirementIndex
        ? 'confirmation'
        : flowPending || activeQuestions.length > 0
          ? 'answers'
          : null;

  // Plain handlers — the React Compiler memoizes these automatically.
  const handleToggleChoice = (question: Question, optionId: string) => {
    setAnswerSelection((current) => {
      const picked = current[question.id] ?? [];
      if (question.input_kind === 'multi_choice') {
        return {
          ...current,
          [question.id]: picked.includes(optionId)
            ? picked.filter((id) => id !== optionId)
            : [...picked, optionId],
        };
      }
      // single_choice — and a free-text example pick, which is one answer:
      // picking another replaces, picking again deselects.
      return {
        ...current,
        [question.id]: picked.includes(optionId) ? [] : [optionId],
      };
    });
  };

  // Every edit door — an answered row's Edit, the understanding card's
  // Adjust — goes through here. Cancelling the job first matters: a run
  // still streaming (or a finished one whose 'done' phase would testify to
  // consent) belongs to the answers being reopened, and its state must not
  // outlive them on this screen.
  const handleFlowEdit = React.useCallback(
    (id: string) => {
      analysisJob.cancel();
      send({ content: '', qflowEditFrom: id });
    },
    [analysisJob, send]
  );

  const handleSubmit = React.useCallback(
    (text: string) => {
      const content = composeAnswerMessage(
        activeQuestions,
        answerSelection,
        text
      );
      if (!content.trim()) return;
      send({ content });
      setComposerText('');
      setAnswerSelection({});
    },
    [activeQuestions, answerSelection, send]
  );

  const handleToggleProduct = React.useCallback((product: CandidateProduct) => {
    setSelectedProducts((current) => {
      const next = new Set(current);
      if (next.has(product.id)) next.delete(product.id);
      else next.add(product.id);
      return next;
    });
  }, []);

  // Runs the decision as a DETACHED JOB, not a turn.
  //
  // The turn path sends `selected_products` and the backend runs the same
  // pipeline — but inside CHATBOT_TURN_DEADLINE, where the window left for the
  // evidence stages falls under both stages' viability floors. Research never
  // starts, marketplace dies mid-search, and the REC-NON gate then withholds
  // the ranking, honestly and every single time. The job runs the identical
  // code with no deadline, so the same gate passes and the `recommendation` +
  // `analysis` payloads the workspace renders actually get written.
  const handleCompareSelected = React.useCallback(() => {
    analysisJob.start();
  }, [analysisJob]);

  // ---- Panel divider (desktop only) ----
  // Plain handlers (the React Compiler memoizes them): the panel setters are
  // also called from the thread-switch reset during render, so the compiler
  // can no longer preserve a manual useCallback([]) around them.
  const handleDividerPointerDown = (
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    event.preventDefault();
    const container = splitRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const move = (ev: PointerEvent) => {
      const width = Math.round(
        Math.min(Math.max(rect.right - ev.clientX, 500), rect.width - 360)
      );
      setPanelWidth(`${width}px`);
    };
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  };

  const handleDividerKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const container = splitRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const current =
      container.querySelector('[role="complementary"]')?.getBoundingClientRect()
        .width ?? rect.width * 0.58;
    const next = Math.round(
      Math.min(
        Math.max(current + (event.key === 'ArrowLeft' ? 24 : -24), 500),
        rect.width - 360
      )
    );
    setPanelWidth(`${next}px`);
  };

  // ---- Screen-reader narration for stream progress ----
  const runningStage = turn.stages.filter((s) => s.state === 'started').at(-1);
  // Delete a conversation from the sidebar. Deleting the OPEN thread first
  // navigates home — the screen must never sit on a dead id.
  const handleDeleteConversation = React.useCallback(
    (target: string) => {
      void deleteConversation(target).then((result) => {
        if (!result.ok) return;
        refreshConversations();
        if (target === id) router.push('/');
      });
    },
    [id, refreshConversations, router]
  );

  const announcement = turn.error
    ? `Error: ${turn.error}`
    : turn.notice
      ? turn.notice
      : turn.streaming
        ? (runningStage?.message ?? t('activity.working'))
        : activeQuestions.length > 0
          ? `${activeQuestions.length} follow-up ${
              activeQuestions.length === 1 ? 'question' : 'questions'
            } from Lumora`
          : '';

  // ---- Title ----
  // Seeded from the sidebar cache while history loads, so clicking a
  // conversation shows its title immediately instead of flashing the
  // new-conversation placeholder. The placeholder is reserved for a thread
  // that is truly empty once settled; a still-unknown title (deep link
  // before the cache has loaded) renders as a skeleton in the header.
  const firstUserMessage = messages.find((m) => m.role === 'user');
  // Thread language, for localizing the templated status layer (finding #6):
  // the LAST user message decides — a thread can switch language mid-way.
  const lastUserMessage = [...messages]
    .reverse()
    .find((m) => m.role === 'user');
  const threadLang: 'fa' | 'en' = /[\u0600-\u06FF]/.test(
    lastUserMessage?.content ?? ''
  )
    ? 'fa'
    : 'en';
  const cachedTitle = conversationId
    ? conversations?.find((c) => c.id === conversationId)?.title
    : undefined;
  const title =
    conversation.title || cachedTitle || firstUserMessage?.content || '';

  // A tab lights up from EITHER contract shape: the legacy per-stage
  // payloads, or the v0.13 `analysis` event that carries all three at once.
  // Partial data counts — a tab with only its hero/summary still renders
  // that surface honestly rather than a full empty state.
  const offersDestination = Boolean(
    recommendation?.decision_summary?.buy_from ||
    recommendation?.recommendation?.seller ||
    recommendation?.actions?.primary_offer_url
  );
  const panelAvailability: Record<PanelTab, boolean> = {
    products:
      Boolean(candidates) ||
      Boolean(latestAnalysis?.compare?.finalists?.length),
    analysis: Boolean(recommendation) || analysisReady,
    offers:
      Boolean(marketplace) ||
      Boolean(latestAnalysis?.market?.items?.length) ||
      offersDestination,
  };
  // Auto-opens still prefer the richest available surface (design: the
  // workspace opens onto content), but once the user is inside the workspace
  // their explicit tab choice wins even if that tab is still empty/partial.
  const bestAvailableTab = (preferred: PanelTab): PanelTab => {
    if (panelAvailability[preferred]) return preferred;
    return (
      (['analysis', 'products', 'offers'] as PanelTab[]).find(
        (tab) => panelAvailability[tab]
      ) ?? preferred
    );
  };
  const activeTab = panelTab;

  const canRunAnalysis = Boolean(latestUnderstanding) || Boolean(candidates);

  const openWorkspace = (preferred: PanelTab) => {
    setPanelTab(bestAvailableTab(preferred));
    setPanelOpen(true);
  };
  React.useEffect(() => {
    openWorkspaceRef.current = openWorkspace;
  });

  // ---- Full-screen gates ----
  const authLoading = status === 'loading';
  const showSignInGate =
    !authLoading &&
    (!authenticated || (load.phase === 'error' && load.status === 401));

  let gate: React.ReactNode = null;
  if (showSignInGate) {
    gate = (
      <GateCard
        title={t('chat.signIn')}
        body="This conversation belongs to your Lumora account. Sign in and it will pick up right where it left off."
        actionLabel="Sign in"
        onAction={() => setLoginOpen(true)}
      />
    );
  } else if (load.phase === 'error' && load.status === 404) {
    gate = (
      <GateCard
        title={t('chat.notFound')}
        body="It may have been deleted, or the link is wrong. Start a new chat to keep exploring."
        actionLabel="Start a new chat"
        onAction={() => router.push('/')}
      />
    );
  } else if (load.phase === 'error') {
    gate = (
      <GateCard
        title={t('chat.loadFailed')}
        body={load.message}
        actionLabel="Try again"
        onAction={reload}
      />
    );
  }

  const loading = authLoading || load.phase === 'loading';

  // ---- Thread with day dividers ----
  let previousDay = '';

  // One set of sidebar props for both renderings — the md+ column and the
  // mobile drawer. Every navigation also closes the drawer so the thread is
  // visible the moment the route changes.
  const sidebarProps = {
    history: (authenticated ? (conversations ?? []) : []).map((c) => ({
      id: c.id,
      title: c.title || t('chat.newConversation'),
      time: formatRelativeTime(c.updatedAt),
    })),
    historyLoading: authenticated && conversations === null,
    account,
    authenticated,
    activeId: id,
    onSelectConversation: (selected: string) => {
      setNavOpen(false);
      router.push(`/chat/${selected}`);
    },
    onDeleteConversation: handleDeleteConversation,
    onRenameConversation: (target: string, title: string) =>
      void renameConversation(target, title).then((result) => {
        if (result.ok) refreshConversations();
      }),
    // New chat goes Home: the hero composer is the blank-slate surface.
    // /chat/new stays routable, but only as the streaming landing target
    // for a prompt submitted from that composer. Arm the one-shot so Home
    // mounts with the composer focused, ready to type.
    onNewChat: () => {
      setNavOpen(false);
      armComposeFocus();
      router.push('/');
    },
    onSignIn: () => {
      setNavOpen(false);
      setLoginOpen(true);
    },
    onSignOut: () => void signOut(),
  };

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-transparent">
      <div
        aria-hidden="true"
        className="vk-moodwash"
        data-on={worldContext ? '' : undefined}
        style={
          worldContext
            ? ({ '--vk-mood': worldContext.world.tone } as React.CSSProperties)
            : undefined
        }
      />
      <div className="relative hidden h-full md:block">
        <AppSidebar {...sidebarProps} />
      </div>
      {/* The same sidebar as a drawer below md. */}
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent
          side="left"
          aria-describedby={undefined}
          className="w-[min(300px,calc(100vw-32px))] gap-0 border-r border-[rgba(120,150,180,0.1)] bg-[#f7f5f2] p-0 md:hidden"
        >
          <SheetTitle className="sr-only">
            Conversations and navigation
          </SheetTitle>
          <AppSidebar fill {...sidebarProps} />
        </SheetContent>
      </Sheet>

      <div
        ref={splitRef}
        className={cn(
          'relative flex h-full min-w-0 flex-1',
          panelOpen && 'vk-split-open'
        )}
      >
        <main className="vk-chat-col relative isolate flex h-full min-w-0 flex-1 flex-col overflow-hidden">
          {/* Ambient glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
          >
            <div className="absolute -top-[220px] left-1/2 h-[650px] w-[900px] -translate-x-1/2 rounded-full bg-radial-[ellipse_at_center,rgba(242,193,78,0.16)_0%,rgba(232,137,46,0.05)_40%,rgba(232,137,46,0)_72%] blur-[14px]" />
          </div>

          {/* Topbar — re-skins into the Decision World's identity the moment
              the backend names a category (v3.0 `cv-head`: centered 820px,
              chromeless — the conversation sits directly on the cosmos). */}
          <header className="mx-auto flex w-full max-w-[820px] flex-none items-center justify-between gap-2.5 px-5 pt-2 pb-2 sm:gap-3.5 sm:px-7 sm:pt-4 sm:pb-3">
            <button
              type="button"
              onClick={() => setNavOpen(true)}
              aria-label={t('chat.openNav')}
              title={t('chat.openNav')}
              className="bg-[rgba(249, 248, 242, 0.7)] grid h-10 w-10 flex-none cursor-pointer place-items-center rounded-[11px] border border-[rgba(150,178,205,0.16)] text-[var(--vk-text-muted)] transition-colors hover:text-[var(--vk-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--vk-accent-ring)] md:hidden"
            >
              <Menu size={20} strokeWidth={2} aria-hidden="true" />
            </button>
            {worldContext ? (
              <WorldHeader
                context={worldContext}
                prompt={firstPrompt}
                // The General Conversation surface is Home; the thread stays
                // in the sidebar under My Decisions.
                onReturn={() => router.push('/')}
              />
            ) : (
              <div className="min-w-0 flex-1">
                <div className="text-xs leading-[1.2] text-[var(--vk-text-muted)]">
                  {id ? 'Conversation' : t('chat.newConversation')}
                </div>
                {title || !loading ? (
                  <h1
                    dir="auto"
                    className="mt-[5px] mb-0 truncate text-[15px] font-semibold tracking-[-0.01em] text-[var(--vk-text-strong)]"
                  >
                    {title || 'What are you looking to choose?'}
                  </h1>
                ) : (
                  <Skeleton
                    aria-hidden="true"
                    className="mt-[5px] h-[18px] w-44 rounded-md"
                  />
                )}
              </div>
            )}
          </header>

          <div aria-live="polite" className="sr-only">
            {announcement}
          </div>

          {gate ?? (
            <>
              {/* Thread — before the composer in the column: the v3.0
                  conversation reads top-down with the input settled at the
                  bottom (design `.cv-scroll { order:1 }` / `.cv-zone
                  { order:2 }`). */}
              <section
                ref={scrollRef}
                onScroll={(event) => {
                  const el = event.currentTarget;
                  stickRef.current =
                    el.scrollHeight - el.scrollTop - el.clientHeight < 90;
                  setStuck(stickRef.current);
                }}
                className="min-h-0 w-full flex-1 overflow-x-hidden overflow-y-auto"
              >
                <div
                  ref={contentRef}
                  className="mx-auto w-full max-w-[792px] px-5 pt-3.5 pb-10 sm:px-7"
                >
                  {loading && (
                    <div className="flex flex-col gap-4" aria-hidden="true">
                      <Skeleton className="h-16 w-3/5 self-end rounded-[17px]" />
                      <Skeleton className="h-28 w-4/5 rounded-[17px]" />
                      <Skeleton className="h-16 w-2/5 self-end rounded-[17px]" />
                    </div>
                  )}

                  {!loading && messages.length === 0 && !turn.streaming && (
                    <div className="vk-anim-in-up mt-[16vh] flex flex-col items-center text-center">
                      <LogoMark size={56} className="vk-mascot-float" />
                      <h2 className="mt-5 mb-0 text-[22px] font-semibold tracking-[-0.02em] text-[var(--vk-text-strong)]">
                        What are you looking to choose?
                      </h2>
                      <p className="mt-2 mb-0 max-w-[420px] text-[14px] leading-[1.6] text-[var(--vk-text-muted)]">
                        Tell Lumora what you need — it asks a few sharp
                        questions, then finds and compares the strongest options
                        for you.
                      </p>
                    </div>
                  )}

                  {!loading &&
                    messages.map((message, index) => {
                      const label = dayLabel(message.created_at);
                      const divider =
                        label && label !== previousDay ? (
                          <div className="mb-[18px] flex items-center justify-center text-xs text-[var(--vk-text-faint)]">
                            {label}
                          </div>
                        ) : null;
                      if (label) previousDay = label;

                      let body: React.ReactNode = null;
                      if (message.role === 'user') {
                        body = (
                          <UserBubble initial={account.initial}>
                            <span className="whitespace-pre-wrap">
                              {message.content}
                            </span>
                          </UserBubble>
                        );
                      } else if (message.kind === 'text') {
                        const restatesQuestions = Boolean(
                          index > 0 &&
                          asRequirement(messages[index - 1])?.questions?.length
                        );
                        if (
                          message.role === 'assistant' &&
                          message.content &&
                          !restatesQuestions
                        ) {
                          const isLast = index === messages.length - 1;
                          body = (
                            <AssistantBlock
                              actions={
                                <AssistantActions
                                  text={message.content}
                                  onRegenerate={
                                    isLast && !turn.streaming
                                      ? regenerate
                                      : undefined
                                  }
                                />
                              }
                            >
                              <AssistantProse text={message.content} />
                            </AssistantBlock>
                          );
                        }
                      } else if (message.kind === 'requirement') {
                        const payload = asRequirement(message);
                        if (payload?.type === 'requirement_summary') {
                          body = (
                            <CardBlock>
                              <ReadyCard
                                payload={payload}
                                onOpenAnalysis={
                                  candidates
                                    ? () => openWorkspace('products')
                                    : undefined
                                }
                              />
                            </CardBlock>
                          );
                        } else if (payload?.flow?.questions?.length) {
                          const flowOpen =
                            Boolean(payload.flow.editing) ||
                            payload.flow.questions.some(
                              (q) =>
                                payload.flow?.answered?.[q.id] === undefined &&
                                !(payload.flow?.skipped ?? []).includes(q.id)
                            );
                          if (
                            index === requirementIndex &&
                            // A still-open snapshot that an understanding has
                            // already closed over is a pre-v0.22 thread whose
                            // answers only ever lived on the session — there
                            // is nothing truthful to render from it.
                            (!flowOpen || understandingIndex < requirementIndex)
                          ) {
                            // A completed flow stays interactive: every
                            // answered row is an Edit affordance, and editing
                            // must work AFTER the results exist — that is
                            // when someone learns which answer they want to
                            // change.
                            const interactive = !turn.streaming;
                            body = (
                              <CardBlock>
                                <QFlowCards
                                  flow={payload.flow}
                                  category={payload.category}
                                  disabled={!interactive}
                                  onSubmit={(answers: QFlowAnswer[]) =>
                                    send({ content: '', qflowAnswers: answers })
                                  }
                                  onEditServer={handleFlowEdit}
                                  // Only the interactive card previews — a
                                  // history replay must not repopulate state.
                                  onPreview={
                                    interactive ? setQflowPreview : undefined
                                  }
                                  flyTargetRef={factorsTargetRef}
                                />
                              </CardBlock>
                            );
                          }
                        } else if (payload?.questions?.length) {
                          // Reference equality is sound: asRequirement returns
                          // the message's own payload object, and the active
                          // scan reads from the same messages array.
                          const interactive =
                            payload === activeRequirement &&
                            activeQuestions.length > 0;
                          body = (
                            <CardBlock>
                              <RequirementQuestions
                                payload={payload}
                                interactive={interactive}
                                selection={answerSelection}
                                onToggleChoice={handleToggleChoice}
                              />
                            </CardBlock>
                          );
                        }
                      } else if (message.kind === 'understanding') {
                        const payload = message.payload as
                          UnderstandingPayload | undefined;
                        // Only the NEWEST understanding renders as the card.
                        // Confirming re-emits the understanding with the flag
                        // set, so a confirmed thread carries two of these
                        // messages — and two identical cards would read as a
                        // glitch, not a record.
                        if (
                          index !== understandingIndex ||
                          understandingIndex < requirementIndex
                        ) {
                          // Superseded — by a newer understanding, or by a
                          // reopened flow whose new answers it no longer
                          // describes. Either way, not the card.
                        } else if (payload?.core_need) {
                          // Adjust needs factor → question id; derive it from the
                          // newest requirement flow in this thread.
                          const f2q: Record<string, string> = {};
                          for (const m of messages) {
                            const rp = asRequirement(m);
                            for (const q of rp?.flow?.questions ?? []) {
                              f2q[q.factor] = q.id;
                            }
                          }
                          body = (
                            <CardBlock>
                              <UnderstandingCard
                                payload={payload}
                                disabled={turn.streaming}
                                factorToQuestion={f2q}
                                confirmed={understandingConfirmed}
                                // The button IS the analysis: it opens the
                                // workspace and runs the detached pipeline —
                                // never a chat turn, so nothing is ever
                                // narrated into the thread. Idempotent by
                                // design: with a result already in hand (or a
                                // run in flight) it only reopens the
                                // workspace, however many times it's pressed.
                                onConfirm={() => {
                                  // With a finished result in hand the button
                                  // is a reopen door; otherwise it starts the
                                  // run and the workspace stays closed until
                                  // the job reports ready — the in-thread
                                  // journey is the face of the wait.
                                  if (analysisReady || recommendation) {
                                    openWorkspace('analysis');
                                    return;
                                  }
                                  if (analysisJob.phase !== 'running') {
                                    setPanelOpen(false);
                                    analysisJob.start();
                                  }
                                }}
                                onEdit={handleFlowEdit}
                              />
                              {understandingConfirmed &&
                              (analysisJob.phase !== 'idle' ||
                                analysisReady) ? (
                                <div className="mt-3.5">
                                  <AnalysisJourney
                                    types={analysisJob.progressTypes}
                                    counts={journeyCounts}
                                    running={analysisJob.phase === 'running'}
                                    failed={analysisJob.phase === 'failed'}
                                    errorText={analysisJob.error}
                                    completed={analysisReady}
                                    showFinal={
                                      analysisJob.phase === 'done' &&
                                      analysisJob.outcome === 'result' &&
                                      !latestAnalysis
                                    }
                                  />
                                </div>
                              ) : null}
                            </CardBlock>
                          );
                        }
                      } else if (message.kind === 'analysis') {
                        const payload = message.payload as
                          AnalysisPayload | undefined;
                        // The result lives in the workspace (design: the
                        // journey ends and the workspace opens); the thread
                        // keeps a compact reopen affordance.
                        if (payload?.rec?.best?.name) {
                          body = (
                            <CardBlock>
                              <AnalysisReadyCard analysis={payload} />
                            </CardBlock>
                          );
                        }
                      } else if (message.kind === 'deals') {
                        const payload = message.payload as
                          DealsPayload | undefined;
                        if (payload?.deals?.length) {
                          body = (
                            <CardBlock>
                              <DealsCards payload={payload} />
                            </CardBlock>
                          );
                        }
                      }
                      // candidates / marketplace / research / recommendation
                      // render in the insight panel, not the thread.

                      if (!body && !divider) return null;
                      return (
                        <React.Fragment key={message.id}>
                          {divider}
                          {body}
                        </React.Fragment>
                      );
                    })}

                  {/* Live turn: the design's thinking line / processing
                      journey, plus streaming prose. When this turn already
                      produced a question card (it arrives before the deltas),
                      the streaming prose is the §7 restatement — suppress it
                      live too, or it would flash and then vanish at `done`. */}
                  {/* Stopping lives in the composer's send button while the
                      stream runs (flow spec step 2: Send becomes Stop). */}
                  {turn.streaming && (
                    <AssistantBlock thinking>
                      <div className="flex flex-col gap-3">
                        <StageStatus
                          stages={turn.stages}
                          expect={turn.expect}
                          tool={turn.tool}
                          lang={threadLang}
                        />
                        {turn.draft && !draftRestatesQuestions && (
                          <AssistantProse text={turn.draft} />
                        )}
                      </div>
                    </AssistantBlock>
                  )}
                </div>
              </section>

              {/* Jump to latest — the design `cv-jump`, floated above the
                  bottom composer, shown once the reader scrolls away. */}
              {!stuck && (
                <button
                  type="button"
                  aria-label={t('chat.jumpLatest')}
                  onClick={() => {
                    const el = scrollRef.current;
                    if (!el) return;
                    el.scrollTo({
                      top: el.scrollHeight,
                      behavior: window.matchMedia(
                        '(prefers-reduced-motion: reduce)'
                      ).matches
                        ? 'auto'
                        : 'smooth',
                    });
                  }}
                  className="bg-[rgba(249, 248, 242, 0.92)] shadow-[0_12px_30px_-14px_rgba(249, 248, 242, 0.8)] absolute right-[26px] bottom-[104px] z-10 grid h-10 w-10 cursor-pointer place-items-center rounded-full border border-[rgba(150,178,205,0.16)] text-[var(--vk-text-muted)] backdrop-blur-md transition-colors hover:text-[var(--vk-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--vk-accent-ring)]"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    className="h-[19px] w-[19px]"
                    aria-hidden="true"
                  >
                    <path
                      d="M12 5v14M6 13l6 6 6-6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              )}

              {/* Composer zone — v3.0 settles the input at the BOTTOM of the
                  conversation (design `.cv-zone`). */}
              <div className="relative z-[5] flex-none px-5 pt-2.5 pb-[calc(16px+env(safe-area-inset-bottom,0px))] sm:px-7">
                {quota && quota.state !== 'ok' && (
                  <div
                    role="status"
                    className={
                      quota.state === 'limited'
                        ? 'mx-auto mb-2 w-full max-w-[768px] rounded-xl border border-[rgba(194,98,90,0.4)] bg-[rgba(194,98,90,0.08)] px-3.5 py-2.5 text-[13px] text-[#E8A79E]'
                        : 'mx-auto mb-2 w-full max-w-[768px] rounded-xl border border-[rgba(201,154,78,0.4)] bg-[#252218] px-3.5 py-2.5 text-[13px] text-[#F4D49D]'
                    }
                  >
                    {quota.state === 'limited'
                      ? `You've reached your usage limit for now. It resets around ${formatResetTime(quota)} — your conversations are saved.`
                      : "Heads up: you're approaching your usage limit for this period."}
                  </div>
                )}
                {!online && (
                  <div
                    role="status"
                    className="mx-auto mb-2 w-full max-w-[768px] rounded-xl border border-[rgba(201,154,78,0.4)] bg-[#252218] px-3.5 py-2.5 text-[13px] text-[#F4D49D]"
                  >
                    You&rsquo;re offline. Reconnect to keep chatting — nothing
                    you typed is lost.
                  </div>
                )}
                {turn.notice && (
                  <div
                    role="status"
                    className="mx-auto mb-2 flex w-full max-w-[768px] flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-[rgba(150,178,205,0.25)] bg-[rgba(150,178,205,0.07)] px-3.5 py-2.5 text-[13px] text-[var(--vk-text-subtle)]"
                  >
                    <span className="min-w-0 flex-1 break-words">
                      {turn.notice}
                    </span>
                    <button
                      type="button"
                      onClick={dismissTurnError}
                      className="cursor-pointer rounded-[6px] px-2 py-0.5 font-medium text-[var(--vk-text-subtle)] underline decoration-[rgba(150,178,205,0.4)] underline-offset-2 transition-colors hover:text-[var(--vk-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--vk-accent-ring)]"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
                {turn.error && (
                  <div
                    role="alert"
                    className="mx-auto mb-2 flex w-full max-w-[768px] flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-[rgba(194,98,90,0.4)] bg-[rgba(194,98,90,0.08)] px-3.5 py-2.5 text-[13px] text-[#E8A79E]"
                  >
                    <span className="min-w-0 flex-1 break-words">
                      {turn.error}
                    </span>
                    <button
                      type="button"
                      onClick={dismissTurnError}
                      className="cursor-pointer rounded-[6px] px-2 py-0.5 font-medium text-[var(--vk-text-subtle)] underline decoration-[rgba(150,178,205,0.35)] underline-offset-2 transition-colors hover:text-[var(--vk-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--vk-accent-ring)]"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
                <div className="mx-auto w-full max-w-[768px]">
                  <Composer
                    value={composerText}
                    onValueChange={setComposerText}
                    onSubmit={handleSubmit}
                    busy={turn.streaming || !online}
                    // Only while actually streaming — offline is busy too,
                    // but there is nothing to stop then.
                    onStop={turn.streaming ? stop : undefined}
                    allowEmpty={hasSelections}
                    // The picks render inside the field, tag-input style, so
                    // what will be sent is visible before pressing send; each
                    // chip removes its answer.
                    leading={
                      activeQuestions.length > 0 ? (
                        <SelectedAnswers
                          questions={activeQuestions}
                          selection={answerSelection}
                          onRemove={handleToggleChoice}
                          className="min-w-0"
                        />
                      ) : undefined
                    }
                    placeholder={
                      activeQuestions.length > 0
                        ? 'Answer the questions or add anything else that matters...'
                        : worldContext
                          ? t('chat.messagePlaceholder')
                          : 'Ask Lumora anything...'
                    }
                  />
                </div>
              </div>
            </>
          )}
        </main>

        {!panelOpen && !gate && (
          <div className="hidden w-[344px] flex-none xl:block">
            <ActivityPanel
              stages={activityStages}
              streaming={turn.streaming || analysisJob.phase === 'running'}
              tool={
                analysisJob.phase === 'running' && analysisJob.progress
                  ? [
                      `${Math.max(0, Math.min(100, analysisJob.progress.pct))}%`,
                      analysisJob.progress.label,
                      analysisJob.progress.detail,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : turn.tool
              }
              waiting={activityWaiting}
              ready={activityReady}
              world={worldContext}
              flow={latestRequirement?.flow ?? null}
              understanding={latestUnderstanding}
              preview={qflowPreview}
              knownTargetRef={factorsTargetRef}
            />
          </div>
        )}

        {panelOpen && !gate && (
          <>
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label={t('chat.resize')}
              tabIndex={0}
              onPointerDown={handleDividerPointerDown}
              onKeyDown={handleDividerKeyDown}
              className="z-20 -mx-1 hidden h-full w-[9px] flex-none cursor-col-resize bg-transparent outline-none hover:bg-linear-[90deg,transparent_4px,rgba(232,137,46,0.55)_4px,rgba(232,137,46,0.55)_5px,transparent_5px] focus-visible:bg-linear-[90deg,transparent_4px,rgba(232,137,46,0.75)_4px,rgba(232,137,46,0.75)_5px,transparent_5px] lg:block"
            />
            <InsightPanel
              tab={activeTab}
              availability={panelAvailability}
              onSelectTab={setPanelTab}
              onClose={() => setPanelOpen(false)}
              width={panelWidth}
            >
              {/* Each tab prefers the newest source: the v0.13 `analysis`
                  payload when present, else the legacy per-stage payloads. */}
              {activeTab === 'products' &&
                (latestAnalysis?.compare?.finalists?.length ? (
                  <AnalysisCompareTab
                    analysis={latestAnalysis}
                    world={worldContext}
                    candidates={candidates}
                    requirement={latestRequirement}
                    recommendation={recommendation}
                    selectedIndex={finalistIndex}
                    onSelect={setFinalistIndex}
                  />
                ) : candidates ? (
                  <PanelProducts
                    candidates={candidates}
                    requirement={latestRequirement}
                    research={research}
                    recommendation={recommendation}
                    selectedIds={selectedProducts}
                    onToggleProduct={handleToggleProduct}
                    onCompareSelected={handleCompareSelected}
                    analysing={analysisJob.phase === 'running'}
                    analysisProgress={analysisJob.progress}
                    streaming={turn.streaming}
                  />
                ) : (
                  // A tab with no payload yet still owes the person a surface.
                  // Rendering `null` here is what made the workspace look
                  // broken: chrome, three tabs, and a blank column under them.
                  <WorkspaceEmpty
                    title={t('ws.noFinalists')}
                    body={t('ws.noFinalistsBody')}
                    job={analysisJob}
                    onRun={analysisJob.start}
                    canRun={canRunAnalysis}
                  />
                ))}
              {activeTab === 'analysis' &&
                (analysisReady && latestAnalysis ? (
                  <AnalysisDecisionTab
                    analysis={latestAnalysis}
                    world={worldContext}
                    requirement={latestRequirement}
                    recommendation={recommendation}
                  />
                ) : recommendation ? (
                  <PanelAnalysis recommendation={recommendation} />
                ) : (
                  <WorkspaceEmpty
                    title={t('ws.noAnalysis')}
                    body={t('ws.noAnalysisBody')}
                    job={analysisJob}
                    onRun={analysisJob.start}
                    canRun={canRunAnalysis}
                  />
                ))}
              {activeTab === 'offers' &&
                (latestAnalysis?.market?.items?.length ? (
                  <AnalysisMarketTab
                    analysis={latestAnalysis}
                    world={worldContext}
                    recommendation={recommendation}
                    selectedIndex={finalistIndex}
                  />
                ) : marketplace || offersDestination ? (
                  // Partial data is still a surface: with no offer table yet,
                  // the tab renders the verified destination hero honestly.
                  <PanelOffers
                    marketplace={marketplace}
                    candidates={candidates}
                    recommendation={recommendation}
                  />
                ) : (
                  <WorkspaceEmpty
                    title={t('ws.noOffers')}
                    body={t('ws.noOffersBody')}
                    job={analysisJob}
                    onRun={analysisJob.start}
                    canRun={canRunAnalysis}
                  />
                ))}
            </InsightPanel>
          </>
        )}
      </div>

      <LoginModal
        open={loginOpen}
        onOpenChange={setLoginOpen}
        onAuthenticated={() => setLoginOpen(false)}
      />
    </div>
  );
}
