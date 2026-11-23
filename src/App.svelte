<script>
  import { onMount, tick } from 'svelte';
  import NewGameModal from './lib/components/NewGameModal.svelte';
  import PlayingCard from './lib/components/PlayingCard.svelte';
  import PlayerHand from './lib/components/PlayerHand.svelte';
  import RulesModal from './lib/components/RulesModal.svelte';
  import { computeRevealedMemory } from './lib/game/csp.js';
  import { getDifficulty } from './lib/game/difficulties.js';
  import { CspTriplettesPlayer } from './lib/game/players.js';
  import {
    DECK_SIZE,
    HandEnd,
    MiddleSlotState,
    StepOutcomeKind,
    TriplettesGame,
    TriplettesView,
    revealHand,
    revealMiddle,
  } from './lib/game/triplettes.js';
  import {
    FRENCH_BOT_NAMES,
    LANG_STORAGE_KEY,
    STRINGS,
    detectInitialLang,
    getPlayerName,
    pickBotNames,
  } from './lib/i18n.js';

  const HUMAN_SEAT = 0;
  const AI_START_DELAY_MS = 380;
  const AI_CALLOUT_MS = 500;
  const HUMAN_MISMATCH_DELAY_MS = 850;
  const HUMAN_TRIPLETTE_HOLD_MS = 550;
  const TRIPLETTE_FLY_MS = 420;
  const DEAL_STEP_MS = 20;
  const DEAL_LAND_MS = 240;
  const MINI_CARD_W = 18;
  const THEME_STORAGE_KEY = 'triplettes-theme';
  const REVEALED_INFO_STORAGE_KEY = 'triplettes-show-revealed';
  const AI_SPEED_STORAGE_KEY = 'triplettes-ai-speed';
  const AI_SPEED_MIN = 0.5;
  const AI_SPEED_MAX = 3;
  const AI_SPEED_STEP = 0.25;

  let lang = $state('fr');
  let numPlayers = $state(4);
  let difficultyId = $state('challenging');
  let showRevealedInfo = $state(false);
  let aiRevealSec = $state(1);
  let botNames = $state(FRENCH_BOT_NAMES.slice(0, 3));

  // 'system' | 'light' | 'dark'
  let theme = $state('system');

  let rulesOpen = $state(false);
  let rulesTriggerEl = $state(null);
  let menuOpen = $state(false);
  let menuTriggerEl = $state(null);
  let newGameOpen = $state(false);
  let draftPlayers = $state(4);
  let draftDifficulty = $state('challenging');
  let draftShowRevealed = $state(false);

  let game = null;
  let aiPlayers = [];
  let pendingTimer = null;
  let calloutClearTimer = null;
  let aiPlan = null;
  let thinkToken = 0;
  let aiCalloutLoc = $state(null);
  let dealRafId = null;
  let dealTimerId = null;
  let tableEl = null;

  let gameId = $state(0);
  let displayView = $state(null);
  let isDealing = $state(false);
  let dealPhase = $state('done'); // 'prepare' | 'flying' | 'flipping' | 'done'
  let dealOffsets = $state({});
  let resolving = $state(false);
  let resolutionKind = $state(null); // 'mismatch' | 'triplette' | null

  // Active fly-and-shrink animation when a triplette is assembled
  let flyingTriplette = $state(null); // { card, items: [{ id, fromLeft, fromTop, fromW, fromH, dx, dy, scale, rot, delay }] }
  let hiddenTriplette = $state(null); // { seat, card }

  let s = $derived(STRINGS[lang]);

  let revealedMemory = $derived(
    showRevealedInfo && displayView ? computeRevealedMemory(displayView) : null
  );

  let opponentSeats = $derived(
    displayView
      ? Array.from({ length: displayView.numPlayers - 1 }, (_, i) => i + 1)
      : []
  );

  let playerCardsTotal = $derived(
    displayView ? displayView.numPlayers * displayView.hands[0].slots.length : 0
  );

  let humanCanAct = $derived(
    Boolean(
      displayView &&
        !isDealing &&
        !resolving &&
        !displayView.isOver() &&
        displayView.currentPlayer === HUMAN_SEAT
    )
  );

  let cardHighlight = $derived(
    resolutionKind === 'triplette'
      ? 'triplette'
      : resolutionKind === 'mismatch'
        ? 'mismatch'
        : 'revealed'
  );

  let activeTurnSeat = $derived(
    displayView && !isDealing && !displayView.isOver() ? displayView.currentPlayer : null
  );

  let aiSpeedLabel = $derived(`${Number(aiRevealSec.toFixed(2))}s`);

  function updateAiSpeed(nextVal) {
    const parsed = Number(nextVal);
    if (!Number.isFinite(parsed)) return;
    const clamped = Math.min(AI_SPEED_MAX, Math.max(AI_SPEED_MIN, parsed));
    aiRevealSec = clamped;
    try {
      localStorage.setItem(AI_SPEED_STORAGE_KEY, String(clamped));
    } catch {}
  }

  function attachTurnSlider(seat) {
    return (node) => {
      const parent = node.parentElement;
      if (!parent) return;

      const update = (allowSlide) => {
        if (seat === null) {
          node.classList.remove('is-visible', 'can-slide');
          return;
        }
        const seatEl = parent.querySelector(`[data-seat-row="${seat}"]`);
        if (!seatEl) return;
        const parentRect = parent.getBoundingClientRect();
        const seatRect = seatEl.getBoundingClientRect();
        const y = Math.round((seatRect.top - parentRect.top) * 10) / 10;
        const h = Math.round(seatRect.height * 10) / 10;
        const wasVisible = node.classList.contains('is-visible');
        if (allowSlide && wasVisible) {
          node.classList.add('can-slide');
        } else if (!wasVisible) {
          node.classList.remove('can-slide');
        }
        node.style.setProperty('--turn-y', `${y}px`);
        node.style.setProperty('--turn-h', `${h}px`);
        if (!wasVisible) {
          node.classList.add('is-visible');
        }
      };

      update(true);
      const ro =
        typeof ResizeObserver !== 'undefined'
          ? new ResizeObserver(() => update(false))
          : null;
      ro?.observe(parent);
      return () => ro?.disconnect();
    };
  }

  function switchLanguage(next) {
    if (next !== 'en' && next !== 'fr') return;
    lang = next;
    if (typeof document !== 'undefined') {
      document.documentElement.lang = next;
    }
    try {
      localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch {}
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('lang')) {
        url.searchParams.set('lang', next);
        window.history.replaceState({}, '', url);
      }
    } catch {}
  }

  function applyTheme(next) {
    theme = next;
    if (typeof document === 'undefined') return;
    if (next === 'system') {
      document.documentElement.removeAttribute('data-theme');
      try {
        localStorage.removeItem(THEME_STORAGE_KEY);
      } catch {}
    } else {
      document.documentElement.setAttribute('data-theme', next);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {}
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const dark =
        next === 'dark' ||
        (next === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
      meta.setAttribute('content', dark ? '#120f08' : '#faf8f3');
    }
  }

  function clearPendingTimer() {
    if (pendingTimer !== null) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }
  }

  function clearCalloutTimer() {
    if (calloutClearTimer !== null) {
      clearTimeout(calloutClearTimer);
      calloutClearTimer = null;
    }
  }

  function actionCardLoc(view, action) {
    if (action.kind === 'middle') return `m-${action.slot}`;
    const hand = view.hands[action.target];
    const idx =
      action.end === HandEnd.Lowest
        ? hand.lowRevealed
        : hand.slots.length - hand.highRevealed - 1;
    return `h-${action.target}-${idx}`;
  }

  function cancelDealAnimation() {
    if (dealRafId !== null) {
      cancelAnimationFrame(dealRafId);
      dealRafId = null;
    }
    if (dealTimerId !== null) {
      clearTimeout(dealTimerId);
      dealTimerId = null;
    }
  }

  function randomSeed() {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      return buf[0] || 1;
    }
    return ((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0) || 1;
  }

  function prefersReducedMotion() {
    return (
      typeof window !== 'undefined' &&
      Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
    );
  }

  function measureDealOffsets() {
    if (!tableEl) return {};
    const originEl = tableEl.querySelector('.middle-cards');
    if (!originEl) return {};
    const originRect = originEl.getBoundingClientRect();
    const originX = originRect.left + originRect.width / 2;
    const originY = originRect.top + originRect.height / 2;

    const offsets = {};
    const nodes = tableEl.querySelectorAll('[data-deal-key]');
    for (const el of nodes) {
      const key = el.getAttribute('data-deal-key');
      if (!key) continue;
      const rect = el.getBoundingClientRect();
      const dx = Math.round(originX - (rect.left + rect.width / 2));
      const dy = Math.round(originY - (rect.top + rect.height / 2));
      const rot = Math.round(Math.max(-14, Math.min(14, -dx * 0.045)) * 10) / 10;
      offsets[key] = { dx, dy, rot };
    }
    return offsets;
  }

  async function runDealAnimation(runGameId) {
    await tick();
    if (runGameId !== gameId) return;

    dealOffsets = measureDealOffsets();
    dealPhase = 'flying';

    // Trigger human cards' CSS-delayed face-up flip on the next paint frame
    // so the browser transitions cleanly from 0deg -> 180deg with zero per-frame JS work.
    dealRafId = requestAnimationFrame(() => {
      dealRafId = null;
      if (runGameId !== gameId) return;
      dealPhase = 'flipping';
    });

    const totalDuration = (DECK_SIZE - 1) * DEAL_STEP_MS + DEAL_LAND_MS + 80;
    dealTimerId = setTimeout(() => {
      dealTimerId = null;
      if (runGameId !== gameId) return;
      isDealing = false;
      dealPhase = 'done';
      dealOffsets = {};
    }, totalDuration);
  }

  function startNewGame(playersCount = numPlayers, diffId = difficultyId) {
    clearPendingTimer();
    thinkToken += 1;
    aiPlan = null;
    cancelDealAnimation();
    numPlayers = playersCount;
    difficultyId = diffId;
    const diff = getDifficulty(diffId);
    const seed = randomSeed();
    const names = pickBotNames(playersCount, seed);
    botNames = names;

    game = new TriplettesGame(playersCount, seed);
    aiPlayers = Array.from({ length: playersCount }, (_, seat) =>
      seat === HUMAN_SEAT
        ? null
        : new CspTriplettesPlayer(
            diff.simulations,
            (seed + seat * 7919) >>> 0,
            names[seat - 1]
          )
    );

    gameId += 1;
    resolving = false;
    resolutionKind = null;
    flyingTriplette = null;
    hiddenTriplette = null;
    clearCalloutTimer();
    aiCalloutLoc = null;
    displayView = game.viewFor(HUMAN_SEAT);

    if (prefersReducedMotion()) {
      isDealing = false;
      dealPhase = 'done';
      dealOffsets = {};
    } else {
      isDealing = true;
      dealPhase = 'prepare';
      dealOffsets = {};
      void runDealAnimation(gameId);
    }
  }

  function openNewGameModal() {
    menuOpen = false;
    draftPlayers = numPlayers;
    draftDifficulty = difficultyId;
    draftShowRevealed = showRevealedInfo;
    newGameOpen = true;
  }

  function handleStartConfiguredGame({
    numPlayers: nextPlayers,
    difficultyId: nextDifficulty,
    showRevealedInfo: nextShowRevealed,
  }) {
    showRevealedInfo = Boolean(nextShowRevealed);
    try {
      localStorage.setItem(REVEALED_INFO_STORAGE_KEY, showRevealedInfo ? '1' : '0');
    } catch {}
    newGameOpen = false;
    startNewGame(nextPlayers, nextDifficulty);
  }

  function buildResolutionSnapshot(beforeView, action, card) {
    const hands = beforeView.hands.map((h) => ({
      slots: h.slots.slice(),
      ids: h.ids ? h.ids.slice() : undefined,
      lowRevealed: h.lowRevealed,
      highRevealed: h.highRevealed,
    }));
    const middle = beforeView.middle.map((m) => ({ ...m }));

    if (action.kind === 'hand') {
      const h = hands[action.target];
      if (action.end === HandEnd.Lowest) {
        h.slots[h.lowRevealed] = card;
        h.lowRevealed += 1;
      } else {
        h.highRevealed += 1;
        h.slots[h.slots.length - h.highRevealed] = card;
      }
    } else {
      middle[action.slot] = { ...middle[action.slot], state: MiddleSlotState.Revealed, card };
    }

    return new TriplettesView({
      viewer: beforeView.viewer,
      numPlayers: beforeView.numPlayers,
      currentPlayer: beforeView.currentPlayer,
      turnNumber: beforeView.turnNumber,
      winner: beforeView.winner,
      hands,
      middle,
      triplettes: beforeView.triplettes.map((pile) => [...pile]),
      revealedThisTurn: [...beforeView.revealedThisTurn, { action, card }],
      history: beforeView.history,
    });
  }

  function collectRevealedCardLocs(snapshot) {
    const locs = [];
    for (let p = 0; p < snapshot.hands.length; p++) {
      const h = snapshot.hands[p];
      const len = h.slots.length;
      for (let i = 0; i < h.lowRevealed; i++) locs.push(`h-${p}-${i}`);
      for (let i = len - h.highRevealed; i < len; i++) locs.push(`h-${p}-${i}`);
    }
    for (let slot = 0; slot < snapshot.middle.length; slot++) {
      if (snapshot.middle[slot].state === MiddleSlotState.Revealed) {
        locs.push(`m-${slot}`);
      }
    }
    return locs;
  }

  async function animateTripletteCollection(runGameId, winnerSeat, card, sourceLocs) {
    if (runGameId !== gameId || !game) return;

    const sourceRects = [];
    if (tableEl && !prefersReducedMotion()) {
      for (const loc of sourceLocs) {
        const wrap = tableEl.querySelector(`[data-card-loc="${loc}"]`);
        const el = wrap?.querySelector('.card-lift') ?? wrap;
        if (el) {
          const r = el.getBoundingClientRect();
          sourceRects.push({ left: r.left, top: r.top, width: r.width, height: r.height });
        }
      }
    }

    const nextView = game.viewFor(HUMAN_SEAT);
    const destIdx = nextView.triplettes[winnerSeat].length - 1;

    if (sourceRects.length === 0 || prefersReducedMotion()) {
      resolving = false;
      resolutionKind = null;
      displayView = nextView;
      scheduleAiIfNeeded();
      return;
    }

    // Remove the 3 cards from the board and mount the destination mini-stack invisibly
    // so we can measure its exact landing coordinates.
    hiddenTriplette = { seat: winnerSeat, card };
    displayView = nextView;
    await tick();
    if (runGameId !== gameId) return;

    const destEl = tableEl?.querySelector(`[data-triplette-slot="${winnerSeat}-${destIdx}"]`);
    if (!destEl) {
      hiddenTriplette = null;
      resolving = false;
      resolutionKind = null;
      scheduleAiIfNeeded();
      return;
    }

    const destRect = destEl.getBoundingClientRect();
    const items = sourceRects.map((src, i) => {
      const targetLeft = destRect.left + i * 2;
      const targetTop = destRect.top + i * 1.5;
      const dx = Math.round((targetLeft - src.left) * 10) / 10;
      const dy = Math.round((targetTop - src.top) * 10) / 10;
      const scale = Math.round((MINI_CARD_W / src.width) * 1000) / 1000;
      return {
        id: `${runGameId}-${card}-${i}`,
        fromLeft: src.left,
        fromTop: src.top,
        fromW: src.width,
        fromH: src.height,
        dx,
        dy,
        scale,
      };
    });

    flyingTriplette = { card, items };

    clearPendingTimer();
    pendingTimer = setTimeout(() => {
      pendingTimer = null;
      if (runGameId !== gameId) return;
      flyingTriplette = null;
      hiddenTriplette = null;
      resolving = false;
      resolutionKind = null;
      scheduleAiIfNeeded();
    }, TRIPLETTE_FLY_MS);
  }

  function performAction(action) {
    if (!game || isDealing || resolving || game.isOver() || !game.isLegal(action)) return;

    const beforeView = game.viewFor(HUMAN_SEAT);
    const event = game.applyAction(action);
    ensureAiPlan();

    if (event.outcome.kind === StepOutcomeKind.Continue) {
      displayView = game.viewFor(HUMAN_SEAT);
      scheduleAiIfNeeded();
      return;
    }

    const snapshot = buildResolutionSnapshot(beforeView, action, event.card);
    resolving = true;
    const isTriplette = event.outcome.kind === StepOutcomeKind.TripletteWon;
    resolutionKind = isTriplette ? 'triplette' : 'mismatch';
    displayView = snapshot;

    const runGameId = gameId;
    clearPendingTimer();

    const isAiActor = event.actor !== HUMAN_SEAT;
    if (isTriplette) {
      const sourceLocs = collectRevealedCardLocs(snapshot);
      const holdMs = isAiActor
        ? Math.max(350, Math.round(aiRevealSec * 800))
        : HUMAN_TRIPLETTE_HOLD_MS;
      pendingTimer = setTimeout(() => {
        pendingTimer = null;
        void animateTripletteCollection(runGameId, event.actor, event.outcome.card, sourceLocs);
      }, holdMs);
    } else {
      const mismatchMs = isAiActor
        ? Math.round(aiRevealSec * 1000)
        : HUMAN_MISMATCH_DELAY_MS;
      pendingTimer = setTimeout(() => {
        pendingTimer = null;
        if (runGameId !== gameId) return;
        resolving = false;
        resolutionKind = null;
        displayView = game.viewFor(HUMAN_SEAT);
        scheduleAiIfNeeded();
      }, mismatchMs);
    }
  }

  function ensureAiPlan() {
    if (!game || isDealing || game.isOver() || game.currentPlayer === HUMAN_SEAT) return null;
    const actor = game.currentPlayer;
    const turnNumber = game.turnNumber;
    const reveals = game.turnReveals.length;
    if (
      aiPlan &&
      aiPlan.gameId === gameId &&
      aiPlan.actor === actor &&
      aiPlan.turnNumber === turnNumber &&
      aiPlan.reveals === reveals
    ) {
      return aiPlan;
    }

    const token = ++thinkToken;
    const runGameId = gameId;
    const view = game.viewFor(actor);
    const promise = aiPlayers[actor].decideAsync(
      view,
      () => token !== thinkToken || runGameId !== gameId
    );
    aiPlan = { gameId: runGameId, actor, turnNumber, reveals, token, promise };
    return aiPlan;
  }

  function scheduleAiIfNeeded() {
    clearPendingTimer();
    if (!game || isDealing || resolving || game.isOver() || game.currentPlayer === HUMAN_SEAT) {
      return;
    }

    const plan = ensureAiPlan();
    const runGameId = gameId;
    const delayMs =
      game.turnReveals.length === 0
        ? Math.min(AI_START_DELAY_MS, Math.round(aiRevealSec * 420))
        : Math.round(aiRevealSec * 1000);

    pendingTimer = setTimeout(() => {
      pendingTimer = null;
      void playScheduledAiTurn(plan, runGameId);
    }, delayMs);
  }

  async function playScheduledAiTurn(plan, runGameId) {
    if (!plan || runGameId !== gameId) return;
    let decision;
    try {
      decision = await plan.promise;
    } catch {
      return;
    }
    if (
      runGameId !== gameId ||
      !decision ||
      !game ||
      isDealing ||
      resolving ||
      game.isOver() ||
      game.currentPlayer !== plan.actor ||
      game.turnNumber !== plan.turnNumber ||
      game.turnReveals.length !== plan.reveals
    ) {
      return;
    }

    const action = decision.chosenAction;
    if (prefersReducedMotion()) {
      performAction(action);
      return;
    }

    const loc = actionCardLoc(game.viewFor(HUMAN_SEAT), action);
    aiCalloutLoc = loc;
    pendingTimer = setTimeout(() => {
      pendingTimer = null;
      if (
        runGameId !== gameId ||
        !game ||
        isDealing ||
        resolving ||
        game.isOver() ||
        game.currentPlayer !== plan.actor
      ) {
        aiCalloutLoc = null;
        return;
      }
      performAction(action);
      clearCalloutTimer();
      calloutClearTimer = setTimeout(() => {
        calloutClearTimer = null;
        if (aiCalloutLoc === loc) aiCalloutLoc = null;
      }, 340);
    }, AI_CALLOUT_MS);
  }

  function handleHandClick(seat, end) {
    if (!humanCanAct) return;
    performAction(revealHand(seat, end));
  }

  function handleMiddleClick(slot) {
    if (!humanCanAct) return;
    performAction(revealMiddle(slot));
  }

  function canPickHandEnd(seat, end) {
    if (!humanCanAct || !displayView) return false;
    const unrev = displayView.unrevealedHandLen(seat);
    return end === HandEnd.Lowest ? unrev >= 1 : unrev >= 2;
  }

  function trackTableNode(node) {
    tableEl = node;
    return () => {
      if (tableEl === node) tableEl = null;
    };
  }

  function closeMenuOnOutsideClick(node) {
    function handlePointerDown(e) {
      if (menuOpen && !node.contains(e.target)) {
        menuOpen = false;
      }
    }
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }

  function handleWindowKeydown(e) {
    if (e.key === 'Escape' && menuOpen) {
      menuOpen = false;
      menuTriggerEl?.focus();
    }
  }

  onMount(() => {
    lang = detectInitialLang();
    document.documentElement.lang = lang;
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') {
        theme = saved;
      }
      const savedRevealed = localStorage.getItem(REVEALED_INFO_STORAGE_KEY);
      if (savedRevealed === '1') {
        showRevealedInfo = true;
      }
      const savedSpeed = Number(localStorage.getItem(AI_SPEED_STORAGE_KEY));
      if (Number.isFinite(savedSpeed) && savedSpeed >= AI_SPEED_MIN && savedSpeed <= AI_SPEED_MAX) {
        aiRevealSec = savedSpeed;
      }
    } catch {}
    startNewGame(numPlayers, difficultyId);
    return () => {
      thinkToken += 1;
      aiPlan = null;
      clearPendingTimer();
      clearCalloutTimer();
      cancelDealAnimation();
    };
  });
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<div class="page">
  <div class="game-shell">
    <header class="page-header">
      <h1>{s.title}</h1>

      <div class="menu-anchor" {@attach closeMenuOnOutsideClick}>
        <button
          type="button"
          class={['menu-btn', menuOpen && 'is-open']}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onclick={(e) => {
            menuTriggerEl = e.currentTarget;
            menuOpen = !menuOpen;
          }}
        >
          <span class="menu-icon" aria-hidden="true">☰</span>
          <span>{s.menuBtn}</span>
        </button>

        {#if menuOpen}
          <div class="menu-popover" role="menu" aria-label={s.menuTitle}>
            <div class="menu-row">
              <span class="menu-row-label">{s.languageLabel}</span>
              <div class="seg-group" role="group" aria-label={s.languageLabel}>
                <button
                  type="button"
                  class={['seg-opt', lang === 'en' && 'active']}
                  aria-pressed={lang === 'en'}
                  onclick={() => switchLanguage('en')}
                >
                  🇬🇧 EN
                </button>
                <button
                  type="button"
                  class={['seg-opt', lang === 'fr' && 'active']}
                  aria-pressed={lang === 'fr'}
                  onclick={() => switchLanguage('fr')}
                >
                  🇫🇷 FR
                </button>
              </div>
            </div>

            <div class="menu-row">
              <span class="menu-row-label">{s.themeLabel}</span>
              <div class="seg-group" role="group" aria-label={s.themeLabel}>
                <button
                  type="button"
                  class={['seg-opt', theme === 'light' && 'active']}
                  aria-pressed={theme === 'light'}
                  onclick={() => applyTheme('light')}
                >
                  {s.themeLight}
                </button>
                <button
                  type="button"
                  class={['seg-opt', theme === 'system' && 'active']}
                  aria-pressed={theme === 'system'}
                  onclick={() => applyTheme('system')}
                >
                  ◑ {s.themeAuto}
                </button>
                <button
                  type="button"
                  class={['seg-opt', theme === 'dark' && 'active']}
                  aria-pressed={theme === 'dark'}
                  onclick={() => applyTheme('dark')}
                >
                  {s.themeDark}
                </button>
              </div>
            </div>

            <div class="menu-row">
              <label class="menu-row-label" for="ai-speed-slider">{s.speedLabel}</label>
              <div class="speed-control">
                <input
                  id="ai-speed-slider"
                  class="speed-slider"
                  type="range"
                  min={AI_SPEED_MIN}
                  max={AI_SPEED_MAX}
                  step={AI_SPEED_STEP}
                  value={aiRevealSec}
                  aria-label={s.speedAria}
                  oninput={(e) => updateAiSpeed(e.currentTarget.value)}
                />
                <span class="speed-value">{aiSpeedLabel}</span>
              </div>
            </div>

            <div class="menu-sep" aria-hidden="true"></div>

            <button
              type="button"
              class="menu-action menu-action-btn"
              role="menuitem"
              onclick={() => {
                menuOpen = false;
                rulesTriggerEl = menuTriggerEl;
                rulesOpen = true;
              }}
            >
              {s.rulesBtn}
            </button>

            <button
              type="button"
              class="menu-action menu-action-primary"
              role="menuitem"
              onclick={openNewGameModal}
            >
              {s.newGameBtn}
            </button>
          </div>
        {/if}
      </div>
    </header>

    {#if displayView}
    {#key gameId}
      <main class="table-frame" {@attach trackTableNode}>
        <div
          class="turn-slider"
          {@attach attachTurnSlider(activeTurnSeat)}
          aria-hidden="true"
        ></div>

        <div class="opponents-list">
          {#each opponentSeats as seat (seat)}
            <PlayerHand
              {lang}
              {seat}
              numPlayers={displayView.numPlayers}
              name={getPlayerName(lang, seat, botNames, HUMAN_SEAT)}
              hand={displayView.hands[seat]}
              triplettes={displayView.triplettes[seat]}
              hiddenTripletteCard={hiddenTriplette?.seat === seat ? hiddenTriplette.card : null}
              isHuman={false}
              isCurrent={!displayView.isOver() && displayView.currentPlayer === seat}
              isWinner={!resolving && displayView.winner === seat}
              {isDealing}
              {dealPhase}
              dealStepMs={DEAL_STEP_MS}
              {dealOffsets}
              canClickLow={canPickHandEnd(seat, HandEnd.Lowest)}
              canClickHigh={canPickHandEnd(seat, HandEnd.Highest)}
              revealHighlight={cardHighlight}
              calloutLoc={aiCalloutLoc}
              memory={revealedMemory
                ? {
                    exact: revealedMemory.handExact[seat],
                    lowBound: revealedMemory.handLowBound[seat],
                    highBound: revealedMemory.handHighBound[seat],
                  }
                : null}
              onPickEnd={(end) => handleHandClick(seat, end)}
            />
          {/each}
        </div>

        <section
          class="middle-zone"
          aria-label={s.centerAria}
          style:--middle-count={displayView.middle.length}
        >
          <div class="middle-cards">
            {#if isDealing}
              <div
                class={['deal-deck', dealPhase !== 'prepare' && 'is-dealing-out']}
                style:--deck-fade-delay={`${(DECK_SIZE - 2) * DEAL_STEP_MS}ms`}
                aria-hidden="true"
              >
                <span class="deck-layer layer-3"></span>
                <span class="deck-layer layer-2"></span>
                <span class="deck-layer layer-1">
                  <span class="deck-panel"></span>
                </span>
              </div>
            {/if}

            {#each displayView.middle as slot, idx (slot.id ?? idx)}
              {@const dealIndex = playerCardsTotal + idx}
              {@const dealKey = `m-${idx}`}
              {@const offset = dealOffsets[dealKey]}
              {@const middleHintVal =
                slot.state === MiddleSlotState.Hidden && revealedMemory
                  ? revealedMemory.middleExact[idx]
                  : null}
              <div
                class={[
                  'deal-wrap',
                  isDealing && dealPhase === 'prepare' && 'is-undealt',
                  isDealing && dealPhase !== 'prepare' && offset && 'is-dealing-in',
                ]}
                data-deal-key={dealKey}
                data-card-loc={dealKey}
                style:--deal-dx={offset ? `${offset.dx}px` : '0px'}
                style:--deal-dy={offset ? `${offset.dy}px` : '0px'}
                style:--deal-rot={offset ? `${offset.rot}deg` : '0deg'}
                style:--deal-delay={isDealing ? `${dealIndex * DEAL_STEP_MS}ms` : '0ms'}
              >
                <PlayingCard
                  value={slot.card}
                  faceUp={slot.state === MiddleSlotState.Revealed}
                  revealed={slot.state === MiddleSlotState.Revealed}
                  empty={slot.state === MiddleSlotState.Empty}
                  clickable={humanCanAct && slot.state === MiddleSlotState.Hidden}
                  highlight={slot.state === MiddleSlotState.Revealed ? cardHighlight : null}
                  callout={aiCalloutLoc === dealKey}
                  memoryHint={middleHintVal !== null
                    ? { kind: 'exact', value: middleHintVal }
                    : null}
                  size="md"
                  ariaLabel={slot.state === MiddleSlotState.Empty
                    ? s.emptySlotAria(idx + 1)
                    : slot.state === MiddleSlotState.Revealed
                      ? s.revealedMiddleAria(idx + 1, slot.card)
                      : s.hiddenMiddleAria(idx + 1)}
                  onclick={humanCanAct && slot.state === MiddleSlotState.Hidden
                    ? () => handleMiddleClick(idx)
                    : undefined}
                />
              </div>
            {/each}
          </div>
        </section>

        <div class="human-zone">
          <PlayerHand
            {lang}
            seat={HUMAN_SEAT}
            numPlayers={displayView.numPlayers}
            name={getPlayerName(lang, HUMAN_SEAT, botNames, HUMAN_SEAT)}
            hand={displayView.hands[HUMAN_SEAT]}
            triplettes={displayView.triplettes[HUMAN_SEAT]}
            hiddenTripletteCard={hiddenTriplette?.seat === HUMAN_SEAT
              ? hiddenTriplette.card
              : null}
            isHuman={true}
            isCurrent={!displayView.isOver() && displayView.currentPlayer === HUMAN_SEAT}
            isWinner={!resolving && displayView.winner === HUMAN_SEAT}
            {isDealing}
            {dealPhase}
            dealStepMs={DEAL_STEP_MS}
            {dealOffsets}
            canClickLow={canPickHandEnd(HUMAN_SEAT, HandEnd.Lowest)}
            canClickHigh={canPickHandEnd(HUMAN_SEAT, HandEnd.Highest)}
            revealHighlight={cardHighlight}
            calloutLoc={aiCalloutLoc}
            onPickEnd={(end) => handleHandClick(HUMAN_SEAT, end)}
          />
        </div>
      </main>
    {/key}
  {/if}
  </div>
</div>

{#if flyingTriplette}
  <div class="fly-layer" aria-hidden="true">
    {#each flyingTriplette.items as item (item.id)}
      <div
        class={['flying-card', flyingTriplette.card === 7 && 'is-seven']}
        style:left={`${item.fromLeft}px`}
        style:top={`${item.fromTop}px`}
        style:width={`${item.fromW}px`}
        style:height={`${item.fromH}px`}
        style:--fly-w={`${item.fromW}px`}
        style:--fly-dx={`${item.dx}px`}
        style:--fly-dy={`${item.dy}px`}
        style:--fly-scale={item.scale}
      >
        <span class="flying-num">{flyingTriplette.card}</span>
      </div>
    {/each}
  </div>
{/if}

<RulesModal
  open={rulesOpen}
  {lang}
  onClose={() => (rulesOpen = false)}
  returnFocusTo={rulesTriggerEl}
/>

<NewGameModal
  open={newGameOpen}
  {lang}
  bind:numPlayers={draftPlayers}
  bind:difficultyId={draftDifficulty}
  bind:showRevealedInfo={draftShowRevealed}
  onStart={handleStartConfiguredGame}
  onClose={() => (newGameOpen = false)}
  returnFocusTo={menuTriggerEl}
/>

<style>
  .page {
    min-height: 100dvh;
    width: 100%;
    max-width: 560px;
    margin: 0 auto;
    padding: 14px 10px 18px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .game-shell {
    width: 100%;
    margin: auto 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .page-header {
    position: relative;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 2.1rem;
    z-index: 40;
  }

  .page-header h1 {
    margin: 0;
    font-family: var(--font-display);
    font-size: clamp(2rem, 5.2vw, 2.65rem);
    font-weight: 400;
    letter-spacing: 0.02em;
    line-height: 1.05;
    text-align: center;
    color: var(--title-color);
  }

  /* Top-right Menu button and anchored dropdown */
  .menu-anchor {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    display: inline-flex;
  }

  .menu-btn {
    height: 1.95rem;
    padding: 0 0.72rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    font-family: var(--font-hand);
    font-size: 0.98rem;
    font-weight: 400;
    letter-spacing: 0.04em;
    line-height: 1;
    color: var(--btn-text);
    background: var(--btn-neu-bg);
    box-shadow: var(--btn-neu-shadow);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    white-space: nowrap;
    transition: color 0.15s ease, background-color 0.15s ease;
  }

  .menu-btn:hover,
  .menu-btn.is-open {
    color: var(--accent);
  }

  .menu-btn:active {
    background: linear-gradient(145deg, var(--btn-neu-active-from), var(--btn-neu-active-to));
  }

  .menu-icon {
    font-size: 0.85rem;
    line-height: 1;
  }

  .menu-popover {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    min-width: 248px;
    padding: 10px;
    background: var(--surface);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 12px 30px var(--shadow);
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 60;
  }

  @media (prefers-reduced-motion: no-preference) {
    .menu-popover {
      animation: popover-in 0.14s ease-out;
    }
  }

  @keyframes popover-in {
    from {
      opacity: 0;
      transform: translateY(-4px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .menu-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .menu-row-label {
    font-family: var(--font-hand);
    font-size: 1rem;
    font-weight: 400;
    letter-spacing: 0.02em;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .seg-group {
    display: inline-flex;
    align-items: center;
    padding: 2px;
    gap: 2px;
    background: var(--surface-alt);
    border: 1px solid var(--border-subtle);
    border-radius: 7px;
  }

  .seg-opt {
    padding: 3px 8px;
    border: none;
    border-radius: 5px;
    background: transparent;
    color: var(--text-muted);
    font-family: var(--font-hand);
    font-size: 0.92rem;
    font-weight: 400;
    letter-spacing: 0.02em;
    cursor: pointer;
    white-space: nowrap;
    transition: background-color 0.14s ease, color 0.14s ease;
  }

  .seg-opt:hover {
    color: var(--text);
  }

  .seg-opt.active {
    background: var(--surface);
    color: var(--accent);
    box-shadow: 0 1px 3px var(--shadow);
  }

  .speed-control {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    justify-content: flex-end;
    min-width: 0;
  }

  .speed-slider {
    width: 118px;
    accent-color: var(--accent);
    cursor: pointer;
    margin: 0;
  }

  .speed-value {
    min-width: 34px;
    text-align: right;
    font-family: var(--font-hand);
    font-size: 0.95rem;
    font-weight: 400;
    color: var(--accent);
    font-variant-numeric: tabular-nums;
  }

  .menu-sep {
    height: 1px;
    background: var(--border-subtle);
    margin: 1px 0;
  }

  .menu-action {
    width: 100%;
    padding: 7px 12px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--text);
    text-align: center;
    font-family: var(--font-hand);
    font-size: 1.02rem;
    font-weight: 400;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition:
      background-color 0.14s ease,
      color 0.14s ease,
      border-color 0.14s ease,
      filter 0.14s ease,
      transform 0.1s ease;
  }

  .menu-action-btn {
    background: var(--btn-neu-bg);
    color: var(--btn-text);
    border: 1px solid var(--border);
    box-shadow: 0 1px 3px var(--shadow);
  }

  .menu-action-btn:hover {
    background: var(--accent-soft);
    border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
    color: var(--accent);
  }

  .menu-action-primary {
    padding: 8px 14px;
    background: var(--accent);
    color: #fffdf8;
    font-size: 1.05rem;
    letter-spacing: 0.05em;
  }

  .menu-action-primary:hover {
    filter: brightness(1.08);
  }

  .menu-action-primary:active {
    transform: translateY(1px);
  }

  /* Compact frameless table */
  .table-frame {
    position: relative;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .turn-slider {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: var(--turn-h, 0px);
    transform: translate3d(0, var(--turn-y, 0px), 0);
    border-radius: 10px;
    background: var(--row-active-bg);
    box-shadow: 0 2px 10px color-mix(in srgb, var(--shadow) 55%, transparent);
    pointer-events: none;
    z-index: 0;
    opacity: 0;
    transition: opacity 180ms ease;
  }

  .turn-slider:global(.is-visible) {
    opacity: 1;
  }

  .turn-slider:global(.can-slide) {
    transition:
      transform 340ms cubic-bezier(0.22, 1, 0.36, 1),
      height 340ms cubic-bezier(0.22, 1, 0.36, 1),
      opacity 180ms ease;
  }

  .opponents-list {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  /* Frameless single-line center card strip that scales cleanly on narrow screens */
  .middle-zone {
    position: relative;
    z-index: 1;
    width: 100%;
    container-type: inline-size;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px 4px;
  }

  .middle-cards {
    --mid-gap: clamp(3px, 1.4cqi, 6px);
    --card-w: min(
      44px,
      calc((100cqi - (var(--middle-count, 8) - 1) * var(--mid-gap)) / var(--middle-count, 8))
    );
    position: relative;
    display: flex;
    flex-wrap: nowrap;
    justify-content: center;
    gap: var(--mid-gap);
  }

  /* Stacked card deck visible in the center during the dealing animation */
  .deal-deck {
    position: absolute;
    left: 50%;
    top: 50%;
    width: var(--card-w, 44px);
    aspect-ratio: 5 / 7;
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: 12;
  }

  .deal-deck.is-dealing-out {
    animation: deck-fade-out 180ms ease var(--deck-fade-delay, 680ms) forwards;
  }

  @keyframes deck-fade-out {
    to {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.92);
    }
  }

  .deck-layer {
    position: absolute;
    inset: 0;
    border-radius: 6px;
    background: var(--card-back-rim);
    border: 1.25px solid var(--card-back-border);
    box-shadow: var(--card-shadow);
  }

  .layer-3 {
    transform: translate(4px, 4px);
  }

  .layer-2 {
    transform: translate(2px, 2px);
  }

  .layer-1 {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .deck-panel {
    position: absolute;
    inset: 3.5px;
    border-radius: 4px;
    background:
      repeating-linear-gradient(
        45deg,
        var(--card-back-weave) 0 1px,
        transparent 1px 5px
      ),
      repeating-linear-gradient(
        -45deg,
        var(--card-back-weave) 0 1px,
        transparent 1px 5px
      ),
      linear-gradient(160deg, var(--card-back-bg) 0%, var(--card-back-bg2) 100%);
  }

  .deck-panel::before {
    content: '';
    position: absolute;
    inset: 2px;
    border-radius: 2.5px;
    border: 1px solid var(--card-back-inner-line);
  }

  .deal-wrap {
    display: inline-flex;
  }

  .deal-wrap.is-undealt {
    opacity: 0;
    pointer-events: none;
  }

  .deal-wrap.is-dealing-in {
    animation: deal-fly-in 240ms cubic-bezier(0.22, 1, 0.36, 1) var(--deal-delay, 0ms) both;
    position: relative;
    z-index: 8;
  }

  @keyframes deal-fly-in {
    from {
      opacity: 0;
      transform: translate3d(var(--deal-dx, 0px), var(--deal-dy, 0px), 0)
        rotate(var(--deal-rot, 0deg)) scale(0.84);
    }
    12% {
      opacity: 1;
    }
    to {
      opacity: 1;
      transform: translate3d(0, 0, 0) rotate(0deg) scale(1);
    }
  }

  .human-zone {
    position: relative;
    z-index: 1;
    width: 100%;
  }

  /* Fly-and-shrink overlay when 3 matching cards assemble into a mini triplette stack */
  .fly-layer {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 60;
  }

  .flying-card {
    position: fixed;
    transform-origin: top left;
    border-radius: 6px;
    background: var(--card-face-bg);
    color: var(--card-face-text);
    border: 1.5px solid var(--ok);
    box-shadow:
      0 0 0 2px var(--ok-soft),
      0 8px 18px var(--shadow);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fly-to-triplette 420ms cubic-bezier(0.25, 0.9, 0.3, 1) forwards;
    will-change: transform;
  }

  .flying-card.is-seven {
    color: var(--seven);
    border-color: var(--seven);
  }

  .flying-num {
    font-family: var(--font-card);
    font-size: calc(var(--fly-w, 40px) * 0.54);
    font-weight: 600;
    line-height: 1;
    letter-spacing: -0.01em;
    font-variant-numeric: lining-nums tabular-nums;
  }

  @keyframes fly-to-triplette {
    from {
      transform: translate3d(0, 0, 0) scale(1);
    }
    to {
      transform: translate3d(var(--fly-dx), var(--fly-dy), 0) scale(var(--fly-scale));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .deal-wrap.is-dealing-in,
    .deal-deck.is-dealing-out,
    .flying-card {
      animation: none;
    }

    .turn-slider:global(.can-slide) {
      transition: opacity 120ms ease;
    }
  }

  @media (max-width: 480px) {
    .page {
      padding: 8px 6px 12px;
    }

    .page-header h1 {
      font-size: clamp(1.45rem, 6.4vw, 1.9rem);
      max-width: calc(100% - 6.6rem);
    }

    .menu-btn {
      height: 1.55rem;
      padding: 0 0.48rem;
      gap: 3px;
      font-size: 0.82rem;
      border-radius: 7px;
    }

    .menu-icon {
      font-size: 0.72rem;
    }
  }
</style>
