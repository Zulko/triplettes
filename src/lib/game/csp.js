// TriplettesKnowledge et échantillonneur de scénarios CSP par intervalles (Hall).

import {
  COPIES_PER_CARD,
  HandEnd,
  MAX_CARD,
  MIN_CARD,
  MiddleSlotState,
  StepOutcomeKind,
} from './triplettes.js';

const CARD_SLOTS = MAX_CARD + 1;
const MAX_COPIES_PER_HAND = COPIES_PER_CARD - 1;
const HAND_CAP_TRIES = 32;

class HandCapError extends Error {
  constructor() {
    super('Aucune carte ne respecte la limite de deux exemplaires par main');
    this.name = 'HandCapError';
  }
}

export class TriplettesKnowledge {
  constructor(handSlots, handBounds, middleKnown, unknownMiddleSlots, runs, remainingCounts) {
    this.handSlots = handSlots;
    this.handBounds = handBounds;
    this.middleKnown = middleKnown;
    this.unknownMiddleSlots = unknownMiddleSlots;
    this.runs = runs;
    this.remainingCounts = remainingCounts;
  }

  static fromView(view) {
    const numPlayers = view.numPlayers;
    const middleLen = view.middle.length;
    const history = view.history;

    const removedFromHand = new Int32Array(numPlayers);
    let i = 0;
    while (i < history.length) {
      const turn = history[i].turn;
      const start = i;
      while (i < history.length && history[i].turn === turn) i++;
      if (history[i - 1].outcome.kind === StepOutcomeKind.TripletteWon) {
        for (let k = start; k < i; k++) {
          const act = history[k].action;
          if (act.kind === 'hand') removedFromHand[act.target]++;
        }
      }
    }

    const handSlots = Array.from({ length: numPlayers }, (_, p) =>
      new Array(view.hands[p].slots.length + removedFromHand[p]).fill(null)
    );
    const handBounds = Array.from({ length: numPlayers }, (_, p) =>
      Array.from({ length: handSlots[p].length }, () => [MIN_CARD, MAX_CARD])
    );
    const middleKnown = new Array(middleLen).fill(null);

    i = 0;
    while (i < history.length) {
      const turn = history[i].turn;
      const start = i;
      while (i < history.length && history[i].turn === turn) i++;

      const low = new Int32Array(numPlayers);
      const high = Int32Array.from(handSlots, (h) => h.length);
      const revealedHandIndices = [];

      for (let k = start; k < i; k++) {
        const ev = history[k];
        if (ev.action.kind === 'hand') {
          const p = ev.action.target;
          let idx;
          if (ev.action.end === HandEnd.Lowest) {
            idx = low[p]++;
          } else {
            high[p]--;
            idx = high[p];
          }
          handSlots[p][idx] = ev.card;
          revealedHandIndices.push([p, idx]);
        } else {
          middleKnown[ev.action.slot] = ev.card;
        }
      }

      const lastOutcome = history[i - 1].outcome;
      if (lastOutcome.kind === StepOutcomeKind.TripletteWon) {
        const v = lastOutcome.card;
        for (let r = 0; r < revealedHandIndices.length; r++) {
          const [p, idx] = revealedHandIndices[r];
          const boundsArr = handBounds[p];
          for (let j = 0; j < boundsArr.length; j++) {
            let isRemoved = false;
            for (let q = 0; q < revealedHandIndices.length; q++) {
              if (revealedHandIndices[q][0] === p && revealedHandIndices[q][1] === j) {
                isRemoved = true;
                break;
              }
            }
            if (isRemoved) continue;
            // A sorted hand can hold another copy of v, so the bound is ≤ / ≥, not strict.
            if (j < idx) {
              if (v < boundsArr[j][1]) boundsArr[j][1] = v;
            } else if (j > idx) {
              if (v > boundsArr[j][0]) boundsArr[j][0] = v;
            }
          }
        }
        revealedHandIndices.sort((a, b) => b[1] - a[1]);
        for (let r = 0; r < revealedHandIndices.length; r++) {
          const [p, idx] = revealedHandIndices[r];
          handSlots[p].splice(idx, 1);
          handBounds[p].splice(idx, 1);
        }
      }
    }

    for (let p = 0; p < numPlayers; p++) {
      const obsSlots = view.hands[p].slots;
      for (let idx = 0; idx < obsSlots.length; idx++) {
        if (obsSlots[idx] !== null) handSlots[p][idx] = obsSlots[idx];
      }
    }

    const unknownMiddleSlots = [];
    for (let slot = 0; slot < middleLen; slot++) {
      const m = view.middle[slot];
      if (m.state === MiddleSlotState.Empty) {
        middleKnown[slot] = null;
      } else if (m.state === MiddleSlotState.Revealed) {
        middleKnown[slot] = m.card;
      } else if (middleKnown[slot] === null) {
        unknownMiddleSlots.push(slot);
      }
    }

    const remainingCounts = new Uint8Array(CARD_SLOTS);
    for (let v = MIN_CARD; v <= MAX_CARD; v++) remainingCounts[v] = COPIES_PER_CARD;
    for (let p = 0; p < view.triplettes.length; p++) {
      const pile = view.triplettes[p];
      for (let k = 0; k < pile.length; k++) {
        remainingCounts[pile[k]] -= COPIES_PER_CARD;
      }
    }
    for (let p = 0; p < numPlayers; p++) {
      const h = handSlots[p];
      for (let j = 0; j < h.length; j++) {
        if (h[j] !== null) remainingCounts[h[j]] -= 1;
      }
    }
    for (let s = 0; s < middleLen; s++) {
      if (middleKnown[s] !== null) remainingCounts[middleKnown[s]] -= 1;
    }

    for (let p = 0; p < numPlayers; p++) {
      const h = handSlots[p];
      const b = handBounds[p];
      const len = h.length;
      for (let j = 0; j < len; j++) {
        if (h[j] !== null) {
          const v = h[j];
          b[j][0] = v;
          b[j][1] = v;
        }
      }
      for (let j = 1; j < len; j++) {
        if (b[j - 1][0] > b[j][0]) b[j][0] = b[j - 1][0];
      }
      for (let j = len - 2; j >= 0; j--) {
        if (b[j + 1][1] < b[j][1]) b[j][1] = b[j + 1][1];
      }
      // At most two copies of a value fit in one hand. A 7-card low end is at
      // most a 9, and a known 8 on top of that hand pulls the low end down to 5.
      for (let j = 0; j < len; j++) {
        if (h[j] !== null) continue;
        let minV = Math.ceil((j + 1) / MAX_COPIES_PER_HAND);
        let maxV = MAX_CARD + 1 - Math.ceil((len - j) / MAX_COPIES_PER_HAND);
        for (let k = 0; k < len; k++) {
          if (h[k] === null) continue;
          const v = h[k];
          if (k > j) {
            const cap = v + 1 - Math.ceil((k - j + 1) / MAX_COPIES_PER_HAND);
            if (cap < maxV) maxV = cap;
          } else if (k < j) {
            const floor = v - 1 + Math.ceil((j - k + 1) / MAX_COPIES_PER_HAND);
            if (floor > minV) minV = floor;
          }
        }
        if (minV < MIN_CARD) minV = MIN_CARD;
        if (maxV > MAX_CARD) maxV = MAX_CARD;
        if (b[j][0] < minV) b[j][0] = minV;
        if (b[j][1] > maxV) b[j][1] = maxV;
        while (b[j][0] < b[j][1] && remainingCounts[b[j][0]] === 0) b[j][0]++;
        while (b[j][1] > b[j][0] && remainingCounts[b[j][1]] === 0) b[j][1]--;
      }
      for (let j = 1; j < len; j++) {
        if (b[j - 1][0] > b[j][0]) b[j][0] = b[j - 1][0];
      }
      for (let j = len - 2; j >= 0; j--) {
        if (b[j + 1][1] < b[j][1]) b[j][1] = b[j + 1][1];
      }
      for (let j = 0; j < len; j++) {
        if (h[j] !== null) {
          b[j][0] = h[j];
          b[j][1] = h[j];
        } else if (b[j][0] > b[j][1]) {
          b[j][0] = b[j][1];
        }
      }
    }

    const runs = [];
    for (let p = 0; p < numPlayers; p++) {
      const h = handSlots[p];
      const b = handBounds[p];
      let idx = 0;
      while (idx < h.length) {
        if (h[idx] !== null) {
          idx++;
          continue;
        }
        const start = idx;
        const lo = b[idx][0];
        const hi = b[idx][1];
        while (idx < h.length && h[idx] === null && b[idx][0] === lo && b[idx][1] === hi) {
          idx++;
        }
        runs.push({ player: p, start, len: idx - start, lo, hi });
      }
    }

    return new TriplettesKnowledge(
      handSlots,
      handBounds,
      middleKnown,
      unknownMiddleSlots,
      runs,
      remainingCounts
    );
  }

  sampleScenario(rng) {
    for (let attempt = 0; attempt < HAND_CAP_TRIES; attempt++) {
      try {
        return this._sampleOnce(rng, true);
      } catch (err) {
        if (!(err instanceof HandCapError)) throw err;
      }
    }
    return this._sampleOnce(rng, false);
  }

  _sampleOnce(rng, enforceHandCap) {
    const remaining = new Uint8Array(this.remainingCounts);
    const demand = new Uint8Array(CARD_SLOTS * CARD_SLOTS);
    const runs = this.runs;
    for (let r = 0; r < runs.length; r++) {
      const run = runs[r];
      demand[run.lo * CARD_SLOTS + run.hi] += run.len;
    }

    const runOrder = new Array(runs.length);
    for (let r = 0; r < runs.length; r++) runOrder[r] = r;
    rng.shuffle(runOrder);
    runOrder.sort((a, b) => (runs[a].hi - runs[a].lo) - (runs[b].hi - runs[b].lo));

    const hands = this.handSlots.map((slots) => {
      const out = new Array(slots.length);
      for (let j = 0; j < slots.length; j++) out[j] = slots[j] ?? MIN_CARD;
      return out;
    });
    const handCounts = enforceHandCap
      ? this.handSlots.map((slots) => {
          const counts = new Uint8Array(CARD_SLOTS);
          for (let j = 0; j < slots.length; j++) {
            if (slots[j] !== null) counts[slots[j]] += 1;
          }
          return counts;
        })
      : null;

    const prefix = new Uint8Array(CARD_SLOTS);
    const candVals = new Uint8Array(12);
    const candWeights = new Uint8Array(12);
    const runCards = [];

    for (let r = 0; r < runOrder.length; r++) {
      const run = runs[runOrder[r]];
      runCards.length = 0;
      for (let step = 0; step < run.len; step++) {
        const chosen = pickFeasibleCard(
          run.lo,
          run.hi,
          remaining,
          demand,
          prefix,
          candVals,
          candWeights,
          rng,
          handCounts ? handCounts[run.player] : null
        );
        if (handCounts) handCounts[run.player][chosen] += 1;
        runCards.push(chosen);
      }
      runCards.sort((a, b) => a - b);
      const targetHand = hands[run.player];
      for (let j = 0; j < run.len; j++) {
        targetHand[run.start + j] = runCards[j];
      }
    }

    const middle = this.middleKnown.slice();
    const unkMid = this.unknownMiddleSlots;
    if (unkMid.length > 0) {
      const leftover = [];
      for (let v = MIN_CARD; v <= MAX_CARD; v++) {
        for (let c = 0; c < remaining[v]; c++) leftover.push(v);
      }
      rng.shuffle(leftover);
      for (let k = 0; k < unkMid.length; k++) {
        middle[unkMid[k]] = leftover[k];
      }
    }

    return { hands, middle };
  }
}

function pickFeasibleCard(lo, hi, remaining, demand, prefix, candVals, candWeights, rng, handCounts) {
  let nCand = 0;
  let totalWeight = 0;
  let blockedByHand = false;
  for (let v = lo; v <= hi; v++) {
    const count = remaining[v];
    if (count <= 0) continue;
    if (handCounts && handCounts[v] >= MAX_COPIES_PER_HAND) {
      blockedByHand = true;
      continue;
    }
    candVals[nCand] = v;
    candWeights[nCand] = count;
    nCand++;
    totalWeight += count;
  }

  const demandIdx = lo * CARD_SLOTS + hi;
  demand[demandIdx] -= 1;

  while (nCand > 0) {
    let draw = rng.genRange(totalWeight);
    let pickIdx = 0;
    for (let idx = 0; idx < nCand; idx++) {
      const w = candWeights[idx];
      if (draw < w) {
        pickIdx = idx;
        break;
      }
      draw -= w;
    }

    const v = candVals[pickIdx];
    const w = candWeights[pickIdx];
    remaining[v] -= 1;
    if (isHallSatisfiable(remaining, demand, prefix)) {
      return v;
    }
    remaining[v] += 1;
    totalWeight -= w;
    nCand--;
    candVals[pickIdx] = candVals[nCand];
    candWeights[pickIdx] = candWeights[nCand];
  }

  if (blockedByHand) {
    throw new HandCapError();
  }
  throw new Error(`Invariant de Hall violé pour [${lo}, ${hi}]`);
}

function isHallSatisfiable(remaining, demand, prefix) {
  prefix[0] = 0;
  for (let v = MIN_CARD; v <= MAX_CARD; v++) {
    prefix[v] = prefix[v - 1] + remaining[v];
  }

  for (let a = MIN_CARD; a <= MAX_CARD; a++) {
    let neededInAb = 0;
    const prefBefore = prefix[a - 1];
    for (let b = a; b <= MAX_CARD; b++) {
      for (let lo = a; lo <= b; lo++) {
        neededInAb += demand[lo * CARD_SLOTS + b];
      }
      if (neededInAb > prefix[b] - prefBefore) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Computes publicly revealed information from game history:
 * - handExact[p][idx]: exact card value if that remaining slot was ever revealed, else null
 * - handLowBound[p]: highest value removed in a triplette from p's low end (remaining cards are ≥ value), else null
 * - handHighBound[p]: lowest value removed in a triplette from p's high end (remaining cards are ≤ value), else null
 * - middleExact[slot]: exact card value if that still-present middle slot was ever revealed, else null
 */
export function computeRevealedMemory(view) {
  const numPlayers = view.numPlayers;
  const middleLen = view.middle.length;
  const history = view.history;

  const removedFromHand = new Int32Array(numPlayers);
  let i = 0;
  while (i < history.length) {
    const turn = history[i].turn;
    const start = i;
    while (i < history.length && history[i].turn === turn) i++;
    if (history[i - 1].outcome.kind === StepOutcomeKind.TripletteWon) {
      for (let k = start; k < i; k++) {
        const act = history[k].action;
        if (act.kind === 'hand') removedFromHand[act.target]++;
      }
    }
  }

  const handExact = Array.from({ length: numPlayers }, (_, p) =>
    new Array(view.hands[p].slots.length + removedFromHand[p]).fill(null)
  );
  const handLowBound = new Array(numPlayers).fill(null);
  const handHighBound = new Array(numPlayers).fill(null);
  const middleExact = new Array(middleLen).fill(null);

  i = 0;
  while (i < history.length) {
    const turn = history[i].turn;
    const start = i;
    while (i < history.length && history[i].turn === turn) i++;

    const low = new Int32Array(numPlayers);
    const high = Int32Array.from(handExact, (h) => h.length);
    const revealedHandEntries = [];

    for (let k = start; k < i; k++) {
      const ev = history[k];
      if (ev.action.kind === 'hand') {
        const p = ev.action.target;
        let idx;
        if (ev.action.end === HandEnd.Lowest) {
          idx = low[p]++;
        } else {
          high[p]--;
          idx = high[p];
        }
        handExact[p][idx] = ev.card;
        revealedHandEntries.push([p, idx, ev.action.end]);
      } else {
        middleExact[ev.action.slot] = ev.card;
      }
    }

    const lastOutcome = history[i - 1].outcome;
    if (lastOutcome.kind === StepOutcomeKind.TripletteWon) {
      const v = lastOutcome.card;
      for (let r = 0; r < revealedHandEntries.length; r++) {
        const [p, , end] = revealedHandEntries[r];
        if (end === HandEnd.Lowest) {
          if (handLowBound[p] === null || v > handLowBound[p]) {
            handLowBound[p] = v;
          }
        } else {
          if (handHighBound[p] === null || v < handHighBound[p]) {
            handHighBound[p] = v;
          }
        }
      }
      revealedHandEntries.sort((a, b) => b[1] - a[1]);
      for (let r = 0; r < revealedHandEntries.length; r++) {
        const [p, idx] = revealedHandEntries[r];
        handExact[p].splice(idx, 1);
      }
    }
  }

  for (let slot = 0; slot < middleLen; slot++) {
    if (view.middle[slot].state === MiddleSlotState.Empty) {
      middleExact[slot] = null;
    }
  }

  return { handExact, handLowBound, handHighBound, middleExact };
}
