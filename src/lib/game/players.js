// Joueur IA par échantillonnage CSP pour Triplettes.

import { TriplettesKnowledge } from './csp.js';
import {
  HandEnd,
  INSTANT_WIN_CARD,
  MAX_CARD,
  MIN_CARD,
  MiddleSlotState,
  Rng,
  revealHand,
  revealMiddle,
} from './triplettes.js';

function encodeHandSlot(player, isHigh, depth) {
  return ((isHigh ? 1 : 0) << 8) | (player << 2) | depth;
}

function encodeMiddleSlot(slot) {
  return (2 << 8) | slot;
}

function decodeSlotAction(code) {
  const kind = code >>> 8;
  if (kind === 2) {
    return revealMiddle(code & 0xff);
  }
  const player = (code & 0xff) >>> 2;
  return revealHand(player, kind === 0 ? HandEnd.Lowest : HandEnd.Highest);
}

// Depth bits mark a copy sitting behind the end. Turning that card over means
// revealing the end in front of it, so order decisions have to score that face.
function faceSlotCode(code) {
  if ((code >>> 8) === 2) return code;
  return code & ~0x03;
}

function isSlotOwnHand(code, viewer) {
  const kind = code >>> 8;
  if (kind === 2) return false;
  const player = (code & 0xff) >>> 2;
  return player === viewer;
}

function isSlotExactKnown(code, knowledge, view) {
  const kind = code >>> 8;
  if (kind === 2) {
    return knowledge.middleKnown[code & 0xff] !== null;
  }
  const player = (code & 0xff) >>> 2;
  const depth = code & 0x03;
  const hv = view.hands[player];
  const idx = kind === 0 ? hv.lowRevealed + depth : hv.slots.length - 1 - hv.highRevealed - depth;
  return knowledge.handSlots[player][idx] !== null;
}

function getActionKnownInfo(action, knowledge, view) {
  if (action.kind === 'middle') {
    const val = knowledge.middleKnown[action.slot];
    return { known: val !== null, value: val, lo: MIN_CARD, hi: MAX_CARD };
  }
  const p = action.target;
  const hv = view.hands[p];
  const idx = action.end === HandEnd.Lowest ? hv.lowRevealed : hv.slots.length - 1 - hv.highRevealed;
  const val = knowledge.handSlots[p][idx];
  const bounds = knowledge.handBounds[p][idx];
  return { known: val !== null, value: val, lo: bounds[0], hi: bounds[1] };
}

export class CspTriplettesPlayer {
  constructor(numSimulations = 10, seed = 0x51a7c0de, name = 'IA') {
    this.name = name;
    this.numSimulations = numSimulations;
    this.rng = new Rng(seed);
  }

  decide(view) {
    const ctx = this._beginDecision(view);
    if (ctx.done) return ctx.done;
    for (let sim = 0; sim < this.numSimulations; sim++) this._sampleOnce(ctx);
    return this._finishDecision(ctx);
  }

  // Yields between batches so a card animation can keep painting while the search runs.
  async decideAsync(view, isCancelled) {
    await yieldToUi();
    if (isCancelled?.()) return null;
    const ctx = this._beginDecision(view);
    if (ctx.done) return ctx.done;
    let lastYield = Date.now();
    for (let sim = 0; sim < this.numSimulations; sim++) {
      this._sampleOnce(ctx);
      if (Date.now() - lastYield >= 12) {
        await yieldToUi();
        lastYield = Date.now();
        if (isCancelled?.()) return null;
      }
    }
    if (isCancelled?.()) return null;
    return this._finishDecision(ctx);
  }

  _beginDecision(view) {
    const legalActions = view.possibleActions();
    if (legalActions.length === 0) {
      throw new Error('CspTriplettesPlayer::decide appelé sans action légale');
    }

    const knowledge = TriplettesKnowledge.fromView(view);
    if (this.numSimulations <= 0) {
      return { done: this._smartFallback(legalActions, knowledge, view, 0) };
    }

    const alreadyRevealed = view.revealedThisTurn.length;
    const needed = 3 - alreadyRevealed;
    if (needed <= 0) {
      return { done: this._smartFallback(legalActions, knowledge, view, 0) };
    }

    let candidateCards;
    const target = view.targetCard();
    if (target !== null) {
      candidateCards = [target];
    } else {
      const won = new Uint8Array(MAX_CARD + 1);
      for (let p = 0; p < view.triplettes.length; p++) {
        const pile = view.triplettes[p];
        for (let k = 0; k < pile.length; k++) won[pile[k]] = 1;
      }
      candidateCards = [];
      for (let v = MIN_CARD; v <= MAX_CARD; v++) {
        if (!won[v]) candidateCards.push(v);
      }
    }

    return {
      done: null,
      view,
      knowledge,
      legalActions,
      needed,
      candidateCards,
      planHits: new Map(),
      slotHits: new Map(),
      acc: [],
    };
  }

  _sampleOnce(ctx) {
    const { view, knowledge, needed, candidateCards, planHits, slotHits, acc } = ctx;
    const scenario = knowledge.sampleScenario(this.rng);
    for (let cIdx = 0; cIdx < candidateCards.length; cIdx++) {
      const card = candidateCards[cIdx];
      collectAccessibleSlots(view, scenario, card, acc);
      for (let k = 0; k < acc.length; k++) {
        const sk = (acc[k] << 4) | card;
        slotHits.set(sk, (slotHits.get(sk) ?? 0) + 1);
      }
      if (acc.length === needed) {
        if (needed === 2 && acc[0] > acc[1]) {
          const t = acc[0]; acc[0] = acc[1]; acc[1] = t;
        } else if (needed === 3) {
          if (acc[0] > acc[1]) { const t = acc[0]; acc[0] = acc[1]; acc[1] = t; }
          if (acc[1] > acc[2]) { const t = acc[1]; acc[1] = acc[2]; acc[2] = t; }
          if (acc[0] > acc[1]) { const t = acc[0]; acc[0] = acc[1]; acc[1] = t; }
        }
        let planKey = card;
        for (let k = 0; k < needed; k++) {
          planKey = planKey * 1024 + acc[k];
        }
        const entry = planHits.get(planKey);
        if (entry !== undefined) {
          entry.count++;
        } else {
          planHits.set(planKey, { card, slots: acc.slice(), count: 1 });
        }
      }
    }
  }

  _finishDecision(ctx) {
    const { view, knowledge, legalActions, planHits, slotHits } = ctx;
    if (planHits.size === 0) {
      return this._smartFallback(legalActions, knowledge, view, this.numSimulations);
    }

    let maxHits = 0;
    for (const entry of planHits.values()) {
      if (entry.count > maxHits) maxHits = entry.count;
    }

    let bestPlans = [];
    let hasInstantWin = false;
    for (const entry of planHits.values()) {
      if (entry.count === maxHits) {
        bestPlans.push(entry);
        if (entry.card === INSTANT_WIN_CARD) hasInstantWin = true;
      }
    }
    if (hasInstantWin) {
      bestPlans = bestPlans.filter((e) => e.card === INSTANT_WIN_CARD);
    }

    bestPlans.sort((a, b) => {
      if (a.card !== b.card) return a.card - b.card;
      for (let k = 0; k < a.slots.length; k++) {
        if (a.slots[k] !== b.slots[k]) return a.slots[k] - b.slots[k];
      }
      return 0;
    });

    const chosenPlan = bestPlans[this.rng.genRange(bestPlans.length)];
    const targetCard = chosenPlan.card;
    const targetSlots = chosenPlan.slots;

    // Pick the riskiest card we would actually turn over:
    // 1. Lowest empirical hit count from simulations.
    // 2. Break ties by probing genuinely unknown slots before already-known slots
    //    (critical at low simulation counts where an unknown slot can tie at 1/1 or 5/5).
    // 3. Break remaining ties by revealing center / opponents before our own hand
    //    (so a player only reveals their own card first when all needed cards are in their own hand).
    // Buried copies (depth > 0) share an action with the end in front of them.
    // Scoring the buried copy would open on a known face whenever the card behind
    // it is the long shot of the trio.
    let bestHits = Infinity;
    let bestKnownRank = Infinity;
    let bestOwnRank = Infinity;
    let bestSlotCandidates = [];
    const seenFaces = new Set();

    for (let k = 0; k < targetSlots.length; k++) {
      const code = faceSlotCode(targetSlots[k]);
      if (seenFaces.has(code)) continue;
      seenFaces.add(code);
      const hits =
        slotHits.get((code << 4) | targetCard) ??
        slotHits.get((targetSlots[k] << 4) | targetCard) ??
        0;
      const knownRank = isSlotExactKnown(code, knowledge, view) ? 1 : 0;
      const ownRank = isSlotOwnHand(code, view.viewer) ? 1 : 0;

      const better =
        hits < bestHits ||
        (hits === bestHits && knownRank < bestKnownRank) ||
        (hits === bestHits && knownRank === bestKnownRank && ownRank < bestOwnRank);

      if (better) {
        bestHits = hits;
        bestKnownRank = knownRank;
        bestOwnRank = ownRank;
        bestSlotCandidates = [code];
      } else if (hits === bestHits && knownRank === bestKnownRank && ownRank === bestOwnRank) {
        bestSlotCandidates.push(code);
      }
    }

    bestSlotCandidates.sort((a, b) => a - b);
    const chosenSlotCode = bestSlotCandidates[this.rng.genRange(bestSlotCandidates.length)];

    return {
      chosenAction: decodeSlotAction(chosenSlotCode),
      targetTriplette: targetCard,
      tripletteProbability: maxHits / this.numSimulations,
      chosenSlotProbability: bestHits / this.numSimulations,
      simulationsRun: this.numSimulations,
      usedRandomFallback: false,
    };
  }

  selectAction(view) {
    return this.decide(view).chosenAction;
  }

  _smartFallback(legalActions, knowledge, view, simulationsRun) {
    const target = view.targetCard();
    const tier0 = []; // Non-own unknown slot compatible with target (if any)
    const tier1 = []; // Any non-own unknown slot (gathers fresh info)
    const tier2 = []; // Any non-own slot (avoids leaking our own hand)

    for (let i = 0; i < legalActions.length; i++) {
      const action = legalActions[i];
      const isOwn = action.kind === 'hand' && action.target === view.viewer;
      if (isOwn) continue;

      const info = getActionKnownInfo(action, knowledge, view);
      if (!info.known) {
        if (target === null || (target >= info.lo && target <= info.hi)) {
          tier0.push(action);
        }
        tier1.push(action);
      }
      tier2.push(action);
    }

    const pool =
      tier0.length > 0
        ? tier0
        : tier1.length > 0
          ? tier1
          : tier2.length > 0
            ? tier2
            : legalActions;

    return {
      chosenAction: pool[this.rng.genRange(pool.length)],
      targetTriplette: null,
      tripletteProbability: 0,
      chosenSlotProbability: 0,
      simulationsRun,
      usedRandomFallback: true,
    };
  }
}

function yieldToUi() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function collectAccessibleSlots(view, scenario, card, out) {
  out.length = 0;
  const hands = scenario.hands;
  const handViews = view.hands;

  for (let p = 0; p < hands.length; p++) {
    const hand = hands[p];
    const hv = handViews[p];
    const low = hv.lowRevealed;
    const endIdx = hand.length - hv.highRevealed;
    if (low >= endIdx) continue;

    if (hand[low] === card) {
      let depth = 0;
      while (low + depth < endIdx && hand[low + depth] === card) {
        out.push(encodeHandSlot(p, false, depth));
        depth++;
      }
    } else if (endIdx - low >= 2 && hand[endIdx - 1] === card) {
      let depth = 0;
      while (endIdx - 1 - depth >= low && hand[endIdx - 1 - depth] === card) {
        out.push(encodeHandSlot(p, true, depth));
        depth++;
      }
    }
  }

  const midViews = view.middle;
  const midCards = scenario.middle;
  for (let slot = 0; slot < midViews.length; slot++) {
    if (midViews[slot].state === MiddleSlotState.Hidden && midCards[slot] === card) {
      out.push(encodeMiddleSlot(slot));
    }
  }
}
