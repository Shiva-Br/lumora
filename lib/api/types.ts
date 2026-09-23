export type Stage =
  | 'understanding'
  | 'requirement'
  | 'understanding'
  | 'analysis'
  | 'selection'
  | 'discovery'
  | 'marketplace'
  | 'research'
  | 'recommendation'
  | 'response';

export type StageState = 'started' | 'completed';

export interface StatusEvent {
  stage: Stage;
  state: StageState;
  /** Human-readable, safe to display. */
  message: string;
}

export interface DeltaEvent {
  content: string;
}

export interface DoneEvent {
  message_id: string;
  conversation_id: string;
}

export interface ErrorEvent {
  error: string;
}

/** Only on `POST /conversations/start`, always the first event. */
export interface ConversationEvent {
  conversation_id: string;
  title?: string;
}

export type Readiness =
  'collecting_required_fields' | 'resolving_conflicts' | 'ready_for_search';

export type QuestionInputKind = 'free_text' | 'single_choice' | 'multi_choice';

export interface QuestionChoice {
  id: string;
  label: string;
}

export interface Question {
  id: string;
  /** Kept for older clients; identical to `id`. */
  field_id: string;
  /** Uppercase eyebrow, e.g. "BUDGET". */
  label: string;
  /** The question text. */
  title: string;
  /** Kept; identical to `title`. */
  question: string;
  helper?: string;
  /** Does it block the search? (Not the input type.) */
  kind: 'required' | 'conditional' | 'optional';
  /** How the user answers. */
  input_kind: QuestionInputKind;
  required: boolean;
  constraint?: 'hard' | 'preference';
  /** Present for choice inputs. */
  choices?: QuestionChoice[];
  /** Render as chips for free_text. */
  examples?: string[];
}

export interface PreferenceNote {
  field?: string;
  text: string;
  emphasis?: string[];
  action?: string;
}

export interface BuyingProfileWeight {
  id: string;
  label: string;
  weight_pct?: number;
  chip?: string;
}

export interface BuyingProfile {
  summary: string;
  weights?: BuyingProfileWeight[];
  /** Always true today — label the numbers as estimates, never measurements. */
  estimated: boolean;
}

export interface RequirementChip {
  id: string;
  label: string;
  constraint: 'hard' | 'preference';
}

export interface RequirementSummary {
  supporting_copy: string;
  secondary_copy: string;
  /** 0..1, deterministic — render as a percentage. */
  requirement_confidence: number;
  confidence_explanation: string;
  chips?: RequirementChip[];
  preference_note?: PreferenceNote;
  buying_profile?: BuyingProfile;
}

export type FieldStatus =
  | 'answered'
  | 'explicit_no_preference'
  | 'derived_with_user_consent'
  | 'defaulted'
  | 'missing'
  | 'invalid'
  | 'conflicting'
  | 'not_applicable';

export interface ProfileField {
  field_id: string;
  status: FieldStatus;
  value?: string;
  source?:
    | 'user_explicit'
    | 'conversation_inference'
    | 'requirement_rule'
    | 'product_policy';
  confidence?: string;
}

export interface ProfileConflict {
  field_ids: string[];
  /** Safe to display. */
  reason: string;
}

export interface Profile {
  category_id?: string;
  fields?: Record<string, ProfileField>;
  conflicts?: ProfileConflict[];
}

export interface RequirementPayload {
  type: 'followup_questions' | 'requirement_summary';
  /** The conversation id. */
  session_id: string;
  category_id: string;
  /** Display name, e.g. "Laptop". */
  category: string;
  readiness: Readiness;
  /** One-line lead-in shown above the questions. */
  intro?: string;
  /** field_ids still unanswered. */
  missing?: string[];
  profile?: Profile;
  /** At most 3 — empty when ready_for_search. */
  questions?: Question[];

  flow?: QuestionFlow;
  /** Only when type === "requirement_summary". */
  summary?: RequirementSummary;
}

export type Badge =
  | 'Best Value'
  | 'Best Overall'
  | 'Best Balance'
  | 'Premium Pick'
  | 'Feature Pick';

export interface ProductScores {
  /** 0–10 — the product on its own merits. */
  lumora: number;
  /** 0–10 — fit to THIS user. */
  personal: number;
  /** 0–100 — overall fit percentage. */
  match: number;
  /**
   * false = computed by the weight engine; true = model estimate (fallback).
   * Honour per product — an estimate must be labelled as one.
   */
  estimated: boolean;
}

export interface PriceRange {
  min?: number;
  max?: number;
  currency?: string;
}

export interface CandidateProduct {
  /** Stable backend slug — key selection state on it. */
  id: string;
  /** Send this (or `id`) back verbatim in `selected_products`. */
  name: string;
  brand?: string;
  /** Absent when not verified — render a placeholder, never a guess. */
  image_url?: string;
  badge?: Badge;
  /** Exactly one product has this — the ★ pick. */
  recommended?: boolean;
  /** Exact configuration, e.g. "16GB RAM · 512GB SSD". */
  variant?: string;
  key_specs?: string[];
  /** Rough single figure — NOT authoritative. */
  approx_price?: number;
  /** Verified span; absent when none. */
  price_range?: PriceRange;
  currency?: string;
  scores?: ProductScores;
  /** One line on why it made the shortlist. */
  survival_reason?: string;
  /** Kept. */
  why_relevant?: string;
  data_confidence?: 'high' | 'medium' | 'low';
  /** Price provenance (backend listing-anchor pass, v0.12): a shown price is a
   *  retrieved listing price. price_unavailable means no listing matched and
   *  the model's figure was withheld — render "price unavailable", never a
   *  guess. source_url/seller give the user a real listing to open. */
  price_verified?: boolean;
  price_unavailable?: boolean;
  price_checked_at?: string;
  source_url?: string;
  seller?: string;
  old_price?: number;
  discount_pct?: number;
  price_note?: string;
}

export interface ComparisonRow {
  factor: string;
  kind: 'bar' | 'text';
  /** Exactly one per column, same order as `products`. */
  values: (number | string)[];
}

export interface WhyCard {
  product_id?: string;
  product: string;
  /** Usually the badge. */
  title: string;
  points: string[];
}

export interface LumoraConfidence {
  /** NEVER a percentage. */
  level: 'high' | 'medium' | 'low';
  explanation?: string;
  factors?: { label: string; highlight?: boolean }[];
}

export interface ComparisonTable {
  /** COLUMN ORDER — mirrors CandidateSet.products, 1:1. */
  products: string[];
  product_ids?: string[];
  rows: ComparisonRow[];
  why_cards?: WhyCard[];
  lumora_confidence?: LumoraConfidence;
}

export interface ScanSummary {
  scanned_count?: number;
  eliminated_count?: number;
  marketplace_count?: number;
  /** Always false in a real run. */
  is_example: boolean;
}

export interface CandidateSet {
  /** May be null — always guard. */
  products: CandidateProduct[] | null;
  comparison?: ComparisonTable;
  type?: 'shortlist';
  scan_summary?: ScanSummary;
  elimination_reasons?: string[];
  notes?: string;
}

export interface MarketplaceOffer {
  seller: string;
  price?: number;
  currency?: string;
  url?: string;
  availability?: string;
  shipping?: string;
  warranty?: string;
  return_policy?: string;
  /** Live sale on this offer (backend-verified from listing data). */
  old_price?: number;
  discount_label?: string;
}

export interface ProductMarketplace {
  /** Matches CandidateProduct.name. */
  product: string;
  offers: MarketplaceOffer[] | null;
}

export interface MarketplaceComparison {
  items: ProductMarketplace[] | null;
  notes?: string;
}

export type DataQuality = 'full' | 'limited' | 'not_verified';

export interface ResearchPeriod {
  id: '1m' | '3m' | '6m';
  /** "After 1 month". */
  label?: string;
  summary?: string;
  points?: string[];
  /** Default "not_verified" — never overstate. */
  data_quality?: DataQuality;
}

export interface ResearchReport {
  product: string;
  /** Matches CandidateProduct.id. */
  product_id?: string;
  type?: 'buyer_experience';
  /** The 1m / 3m / 6m tabs — only windows with data. */
  periods?: ResearchPeriod[];
  source_note?: string;
  // Legacy flat view (still populated):
  pros?: string[];
  cons?: string[];
  recurring_issues?: string[];
  reliability?: string;
  satisfaction?: string;
  sources?: string[];
}

export interface ResearchSet {
  type?: 'research';
  reports: ResearchReport[] | null;
}

export interface RankedProduct {
  product: string;
  /** 1 = best. */
  rank: number;
  rationale?: string;
  pros?: string[];
  cons?: string[];
  best_price?: number;
  currency?: string;
  seller?: string;
}

export interface RejectedProduct {
  product: string;
  reason: string;
}

export type Confidence = 'high' | 'medium' | 'low';

/** Chip tone in the recommendation's confidence detail. */
export type Tone = 'positive' | 'warning' | 'neutral';

export interface DecisionSummary {
  product_id?: string;
  product_name?: string;
  buy_from?: string;
  match_score_pct?: number;
  confidence_pct?: number | null;
  confidence_level?: Confidence;
  one_sentence?: string;
}

/** The picked-product block of the decision preview. */
export interface RecommendationPick {
  product_id?: string;
  /** Absent when not verified — render a placeholder, never a guess. */
  image_url?: string;
  seller?: string;
  price?: { amount?: number; currency?: string };
  delivery_label?: string;
  scores?: ProductScores;
  why_reasons?: string[];
  like_most?: string[];
  should_know?: string[];
  why_others_failed?: { product_id?: string; reason: string }[];
  /** Winner label from the category vocab, e.g. "best_overall". */
  label?: string;
  /** Expert-knowledge factor ids that drove the pick (DISC/COMP/DEC). */
  factor_trace?: string[];
}

/** The doc's `confidence` object (the flat number is the legacy self-score). */
export interface ConfidenceDetail {
  pct?: number | null;
  explanation?: string;
  chips?: { label: string; tone: Tone }[];
  what_would_change?: string[];
}

export interface IfIWereYou {
  text?: string;
  honest_disclaimer?: string;
  confidence_level?: Confidence;
  footer?: { confidence_pct?: number | null; date?: string };
}

/** One arm of a conditional recommendation (v0.9.0 REC-CND): when no single
 * winner is honest, the pick branches on a stated condition. */
export interface ConditionalBranch {
  if: string;
  then_product: string;
  why?: string;
}

export interface Recommendation {
  /** "It depends" branches beside the default pick (absent = unconditional). */
  conditional?: ConditionalBranch[] | null;
  // Original ranking (v0.2.0, unchanged):
  ranked?: RankedProduct[] | null;
  /** Product name. */
  best_pick?: string;
  alternatives?: string[];
  rejected?: RejectedProduct[];
  /** Legacy 0..1 self-score — prefer `confidence_detail`. */
  confidence?: number;
  summary?: string;

  type?: 'recommendation';
  status?: 'ready' | 'pending' | 'unavailable';
  /** ISO 8601. */
  generated_at?: string;
  /** `is_example` is always false in prod. */
  final_opinion_intro?: { text?: string; is_example: boolean };
  decision_summary?: DecisionSummary;
  recommendation?: RecommendationPick;
  confidence_detail?: ConfidenceDetail;
  if_i_were_you?: IfIWereYou;
  actions?: { primary_offer_url?: string; saveable: boolean };
  /** Last-mile sanity gate the backend fills from confidence. */
  final_checks?: {
    future_regret_risk?: string;
    long_term_fit_to_workload?: string;
  };
}

export type MessageRole = 'user' | 'assistant' | 'system';

/** 1:1 with the SSE data-event names, so one renderer serves both. */
export type DataEventKind =
  | 'requirement'
  | 'understanding'
  | 'analysis'
  | 'candidates'
  | 'marketplace'
  | 'research'
  | 'recommendation'
  | 'deals';

export type MessageKind = 'text' | DataEventKind;

/** The payload for each structured message kind. */
export interface DataPayloadByKind {
  requirement: RequirementPayload;
  understanding: UnderstandingPayload;
  analysis: AnalysisPayload;
  candidates: CandidateSet;
  deals: DealsPayload;
  marketplace: MarketplaceComparison;
  research: ResearchSet;
  recommendation: Recommendation;
}

export type DataPayload = DataPayloadByKind[DataEventKind];

/**
 * A persisted message, as the UI consumes it. `content` is prose for `text`
 * and a short summary line for every other kind (prefer `payload`).
 */
export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: MessageRole;
  kind: MessageKind;
  content: string;
  payload?: unknown;
  created_at: string;

  status?: 'complete' | 'partial' | 'fallback';
  /** Why a non-complete row ended early (user_stop | timeout | …). */
  stop_reason?: string;
  /** Regeneration lineage: the reply this row replaced (v0.9.0). */
  supersedes_message_id?: string;
}

// ---------- v0.6.0+ delivery-contract events ----------

/** First event of every turn (v0.8.0: expect + contract revision). */
export interface StartEvent {
  stream_ref: string;
  conversation_id: string;
  /** "fast" | "researching" — set the waiting posture before any status. */
  expect?: string;
  contract?: string;
}

/** Coarse in-stage tool activity (v0.9.0), namespaced by stage. */
export interface ToolStatusEvent {
  tool: string;
  state: 'started' | 'completed';
}

/** The user stopped the turn (v0.6.0 terminal). */
export interface StoppedEvent {
  conversation_id: string;
  message_id?: string;
  had_content: boolean;
  message: string;
}

/** The turn hit its hard budget (v0.6.0 terminal); message is user-safe. */
export interface TimeoutEvent {
  conversation_id: string;
  message_id?: string;
  had_content: boolean;
  message: string;
}

// ---------- SSE dispatch ----------

export type ServerEvent =
  | { event: 'conversation'; data: ConversationEvent }
  | { event: 'status'; data: StatusEvent }
  | { event: 'requirement'; data: RequirementPayload }
  | { event: 'understanding'; data: UnderstandingPayload }
  | { event: 'analysis'; data: AnalysisPayload }
  | { event: 'candidates'; data: CandidateSet }
  | { event: 'marketplace'; data: MarketplaceComparison }
  | { event: 'research'; data: ResearchSet }
  | { event: 'recommendation'; data: Recommendation }
  | { event: 'delta'; data: DeltaEvent }
  | { event: 'done'; data: DoneEvent }
  | { event: 'error'; data: ErrorEvent };

// ---------- quota (v0.8.0) ----------

export interface QuotaWindow {
  /** 0..100; absent when the window has no cap. Raw spend never leaves the
   *  server (stress fix #7 — no operator economics in the client). */
  used_pct?: number;
  /** This window is exhausted — sends 429 until it resets. */
  limited: boolean;
  /** ISO 8601 — when this window resets. */
  resets_at: string;
}

/** GET /api/quota — spend vs the caller's windows. `limited` means sends are
 * refused (429) until the window resets; `warned` means ≥80% consumed. */
export interface QuotaStatus {
  day: QuotaWindow;
  month: QuotaWindow;
  state: 'ok' | 'warned' | 'limited';
}

// ---------- deals (v0.10.0) ----------

/** One live discounted listing — numbers computed backend-side from the
 * marketplace's own published old price; never model-generated. */
export interface Deal {
  title: string;
  seller?: string;
  price: number;
  old_price: number;
  discount_pct: number;
  currency?: string;
  link?: string;
  image_url?: string;
  delivery?: string;
  rating?: number;
  reviews?: number;
}

/** The deal-hunt payload: rendered as cards in the thread. */
export interface DealsPayload {
  type: 'deals';
  category_id: string;
  category: string;
  deals: Deal[];
  scanned_count: number;
  captured_at: string;
}

export interface FlowChoice {
  label: string;
  tags?: string[];
  /** Canonical registry value this choice stores; display keeps `label`. */
  value?: string;
}

export interface FlowQuestion {
  id: string;
  type: 'single' | 'multi' | 'text';
  required: boolean;
  question: string;
  why?: string;
  options?: FlowChoice[];
  factor: string;
  rank: number;
  emoji?: string;
}

export interface QuestionFlow {
  questions: FlowQuestion[];
  answered?: Record<string, string>;
  skipped?: string[];
  tags?: string[];
  /** Question id an edit reopened. Its old answer stays in `answered` until
   *  the new one lands (FLOW-02: reopening is not answering), so the card
   *  must treat this id as the active question, not an answered row. */
  editing?: string;
}

export interface QFlowAnswer {
  id: string;
  value?: string;
  values?: string[];
  skipped?: boolean;
}

export interface UnderstandingFact {
  label: string;
  level: 'essential' | 'high' | 'preference' | 'flexible';
}

export interface UnderstandingPayload {
  type: 'understanding';
  category_id: string;
  category: string;
  core_need: string;
  explicit_facts?: UnderstandingFact[];
  dna?: { factor: string; value: string; emoji?: string }[];
  inferred_priorities?: UnderstandingFact[];
  tradeoff: {
    prefer?: string[];
    give_up?: string[];
    bars?: {
      label: string;
      level: string;
      /** This factor's share of the personalized weight vector (sums to 100).
       *  Absent on payloads predating the field — the bar falls back to the
       *  level's bucket width. */
      share?: number;
    }[];
    sentence?: string;
  };
  avoidances?: string[];
  ideal?: string;
  confidence: {
    level: 'Partial' | 'Good' | 'Strong';
    note?: string;
    pct: number;
    unresolved?: string[];
  };
  tags?: string[];
  confirmed: boolean;
}

export interface AnalysisPayload {
  type: 'analysis';
  category_id: string;
  category: string;
  goal?: string;
  rec: {
    summary?: string;
    optimized?: { emoji?: string; title: string; line: string }[];
    avoided?: { title: string; reason: string }[];
    reasoning?: string[];

    reasoning_flow?: {
      priority: string;
      weight?: string;
      rule: string;
      effect: string;
    }[];
    tradeoffs_rec?: { gain: string; give: string; why?: string }[];
    boundary?: { if: string; then: string }[];
    boundary_note?: string;
    best: {
      product_id?: string;
      name: string;
      brand?: string;
      price?: string;
      image_url?: string;
      why?: string[];
      why_not?: string[];
      tradeoffs?: string[];
    };
    why_won?: {
      priority: string;
      performance?: string;
      ok: 'yes' | 'ok' | 'no';
    }[];
    fit?: { label: string; score: number }[];
    signature?: string;
    scores: { lumora: number; personal: number; match: number };
  };
  compare: {
    finalists: {
      product_id: string;
      name: string;
      brand?: string;
      image_url?: string;
      match: number;
      price?: string;
      why_finalist?: string;
      for_who?: string;
      best?: boolean;
    }[];
    table?: unknown;
    wins?: string;
  };
  market: {
    summary?: { k: string; v: number }[];
    items: {
      product_id: string;
      product: string;
      offers: {
        seller: string;
        authority: string;
        price?: number;
        currency?: string;
        old_price?: number;
        url?: string;
        delivery?: string;
        warranty?: string;
        returns?: string;
        stock?: string;
        trust: number;
        buy_score: number;
        risk_score: number;
        risk_band: string;
        badge?: string;
        badge_why?: string;
        derived: boolean;
      }[];
    }[];
    note?: string;
  };
  dna?: { factor: string; value: string; emoji?: string }[];
  confidence: { pct: number; word: string; unresolved?: string[] };
  generated_at?: string;
}

// ---------------------------------------------------------------------------
// Account preferences (backend v0.22.0 — GET/PATCH /api/me/preferences)
// ---------------------------------------------------------------------------

export type PreferenceTheme = 'dark';

/** The locales the design ships translations and RTL for. */
export type PreferenceLanguage = 'en' | 'fa' | 'ar';

/**
 * Account-scoped UI settings. These follow the person, not the browser —
 * localStorage is not account storage, and reduced motion in particular is an
 * accessibility setting that should not be stranded on one device.
 */
export interface Preferences {
  theme: PreferenceTheme;
  language: PreferenceLanguage;
  sidebarCollapsed: boolean;
  /**
   * Three distinct states, and the difference matters:
   *   null  — no preference expressed; follow the operating system
   *   true  — the user asked for reduced motion regardless of the OS
   *   false — the user asked for full motion regardless of the OS
   */
  reducedMotionOverride: boolean | null;
  /**
   * The CLIENT's own storage-migration counter. The backend persists and
   * returns it untouched and never interprets it — this ladder belongs to the
   * frontend.
   */
  _v: number;
}

/**
 * A partial update. Send only the keys being changed.
 *
 * An omitted key is left as stored, which is what makes it safe to change one
 * setting without clobbering another. Note the distinction the optional marker
 * cannot express on its own: omitting `reducedMotionOverride` leaves it alone,
 * while sending it explicitly as `null` clears it back to following the OS.
 */
export interface PreferencesPatch {
  theme?: PreferenceTheme;
  language?: PreferenceLanguage;
  sidebarCollapsed?: boolean;
  reducedMotionOverride?: boolean | null;
  _v?: number;
}
