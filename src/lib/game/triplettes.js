// Triplettes (mode simple) : moteur de règles, vues par joueur et boucle de partie.

export const MIN_CARD = 1;
export const MAX_CARD = 12;
export const COPIES_PER_CARD = 3;
export const DECK_SIZE = MAX_CARD * COPIES_PER_CARD;
export const TRIPLETTES_TO_WIN = 3;
export const INSTANT_WIN_CARD = 7;

export const HandEnd = Object.freeze({
  Lowest: 'low',
  Highest: 'high',
});

export const MiddleSlotState = Object.freeze({
  Empty: 0,
  Hidden: 1,
  Revealed: 2,
});

export const StepOutcomeKind = Object.freeze({
  Continue: 'continue',
  Mismatch: 'mismatch',
  TripletteWon: 'triplette_won',
});

export class Rng {
  constructor(seed) {
    this.state = seed >>> 0;
  }

  nextU32() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let z = this.state;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return (z ^ (z >>> 14)) >>> 0;
  }

  genRange(upper) {
    const threshold = (0x100000000 - upper) % upper;
    while (true) {
      const value = this.nextU32();
      if (value >= threshold) {
        return value % upper;
      }
    }
  }

  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.genRange(i + 1);
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
  }
}

export function standardDeck() {
  const deck = new Array(DECK_SIZE);
  let k = 0;
  for (let v = MIN_CARD; v <= MAX_CARD; v++) {
    for (let c = 0; c < COPIES_PER_CARD; c++) {
      deck[k++] = v;
    }
  }
  return deck;
}

// A triplet already sitting in a hand at the deal does not count, so those deals are discarded.
export function handContainsTriplette(values) {
  let run = 1;
  for (let i = 1; i < values.length; i++) {
    if (values[i] === values[i - 1]) {
      run += 1;
      if (run >= COPIES_PER_CARD) return true;
    } else {
      run = 1;
    }
  }
  return false;
}

export function standardConfig(numPlayers) {
  let cardsPerPlayer;
  switch (numPlayers) {
    case 3:
      cardsPerPlayer = 9;
      break;
    case 4:
      cardsPerPlayer = 7;
      break;
    case 5:
      cardsPerPlayer = 6;
      break;
    case 6:
      cardsPerPlayer = 5;
      break;
    default:
      throw new Error(`Nombre de joueurs non pris en charge : ${numPlayers} (3 à 6 joueurs)`);
  }
  return {
    numPlayers,
    cardsPerPlayer,
    middleCards: DECK_SIZE - numPlayers * cardsPerPlayer,
  };
}

export function revealHand(target, end) {
  return { kind: 'hand', target, end };
}

export function revealMiddle(slot) {
  return { kind: 'middle', slot };
}

export function actionToString(action) {
  return action.kind === 'hand'
    ? `p${action.target}:${action.end}`
    : `m${action.slot}`;
}

export class TriplettesView {
  constructor({
    viewer,
    numPlayers,
    currentPlayer,
    turnNumber,
    winner,
    hands,
    middle,
    triplettes,
    revealedThisTurn,
    history,
  }) {
    this.viewer = viewer;
    this.numPlayers = numPlayers;
    this.currentPlayer = currentPlayer;
    this.turnNumber = turnNumber;
    this.winner = winner;
    this.hands = hands;
    this.middle = middle;
    this.triplettes = triplettes;
    this.revealedThisTurn = revealedThisTurn;
    this.history = history;
  }

  isOver() {
    return this.winner !== null;
  }

  isViewerTurn() {
    return !this.isOver() && this.viewer === this.currentPlayer;
  }

  targetCard() {
    return this.revealedThisTurn.length > 0 ? this.revealedThisTurn[0].card : null;
  }

  handLen(player) {
    return this.hands[player].slots.length;
  }

  unrevealedHandLen(player) {
    const h = this.hands[player];
    return Math.max(0, h.slots.length - h.lowRevealed - h.highRevealed);
  }

  possibleActions() {
    if (this.isOver()) return [];
    const actions = [];
    for (let p = 0; p < this.numPlayers; p++) {
      const unrev = this.unrevealedHandLen(p);
      if (unrev >= 1) actions.push(revealHand(p, HandEnd.Lowest));
      if (unrev >= 2) actions.push(revealHand(p, HandEnd.Highest));
    }
    for (let slot = 0; slot < this.middle.length; slot++) {
      if (this.middle[slot].state === MiddleSlotState.Hidden) {
        actions.push(revealMiddle(slot));
      }
    }
    return actions;
  }
}

export class TriplettesGame {
  constructor(numPlayers, seed) {
    this.config = standardConfig(numPlayers);
    const deckCards = standardDeck().map((value, id) => ({ id, value }));
    const rng = new Rng(seed);
    const perPlayer = this.config.cardsPerPlayer;

    this.hands = [];
    this.handIds = [];
    this.middle = [];
    this.middleIds = [];

    for (let attempt = 0; attempt < 200; attempt++) {
      rng.shuffle(deckCards);
      const hands = [];
      const handIds = [];
      let cursor = 0;
      let blocked = false;
      for (let p = 0; p < numPlayers; p++) {
        const slice = deckCards.slice(cursor, cursor + perPlayer);
        slice.sort((a, b) => a.value - b.value || a.id - b.id);
        const values = slice.map((c) => c.value);
        if (handContainsTriplette(values)) blocked = true;
        hands.push(values);
        handIds.push(slice.map((c) => c.id));
        cursor += perPlayer;
      }
      const midSlice = deckCards.slice(cursor);
      this.hands = hands;
      this.handIds = handIds;
      this.middle = midSlice.map((c) => c.value);
      this.middleIds = midSlice.map((c) => c.id);
      if (!blocked) break;
    }
    this.triplettes = Array.from({ length: numPlayers }, () => []);
    this.currentPlayer = 0;
    this.turnNumber = 1;
    this.winner = null;
    this.turnReveals = [];
    this.handLowRevealed = new Uint8Array(numPlayers);
    this.handHighRevealed = new Uint8Array(numPlayers);
    this.history = [];
  }

  numPlayers() {
    return this.hands.length;
  }

  isOver() {
    return this.winner !== null;
  }

  unrevealedHandLen(player) {
    return Math.max(
      0,
      this.hands[player].length - this.handLowRevealed[player] - this.handHighRevealed[player]
    );
  }

  isMiddleRevealed(slot) {
    for (let i = 0; i < this.turnReveals.length; i++) {
      const r = this.turnReveals[i];
      if (r.locKind === 'middle' && r.slot === slot) return true;
    }
    return false;
  }

  isLegal(action) {
    if (this.isOver()) return false;
    if (action.kind === 'hand') {
      const p = action.target;
      if (p < 0 || p >= this.hands.length) return false;
      const unrev = this.unrevealedHandLen(p);
      return action.end === HandEnd.Lowest ? unrev >= 1 : unrev >= 2;
    }
    const s = action.slot;
    return s >= 0 && s < this.middle.length && this.middle[s] !== null && !this.isMiddleRevealed(s);
  }

  possibleActions() {
    if (this.isOver()) return [];
    const actions = [];
    for (let p = 0; p < this.hands.length; p++) {
      const unrev = this.unrevealedHandLen(p);
      if (unrev >= 1) actions.push(revealHand(p, HandEnd.Lowest));
      if (unrev >= 2) actions.push(revealHand(p, HandEnd.Highest));
    }
    for (let s = 0; s < this.middle.length; s++) {
      if (this.middle[s] !== null && !this.isMiddleRevealed(s)) {
        actions.push(revealMiddle(s));
      }
    }
    return actions;
  }

  viewFor(viewer) {
    const hands = this.hands.map((hand, p) => {
      const len = hand.length;
      const low = this.handLowRevealed[p];
      const high = this.handHighRevealed[p];
      const slots = new Array(len);
      for (let idx = 0; idx < len; idx++) {
        const visible = p === viewer || idx < low || idx >= len - high;
        slots[idx] = visible ? hand[idx] : null;
      }
      return {
        slots,
        ids: this.handIds[p].slice(),
        lowRevealed: low,
        highRevealed: high,
      };
    });

    const middle = this.middle.map((card, slot) => {
      const id = this.middleIds[slot];
      if (card === null) return { state: MiddleSlotState.Empty, card: null, id };
      if (this.isMiddleRevealed(slot)) return { state: MiddleSlotState.Revealed, card, id };
      return { state: MiddleSlotState.Hidden, card: null, id };
    });

    return new TriplettesView({
      viewer,
      numPlayers: this.hands.length,
      currentPlayer: this.currentPlayer,
      turnNumber: this.turnNumber,
      winner: this.winner,
      hands,
      middle,
      triplettes: this.triplettes.map((pile) => [...pile]),
      revealedThisTurn: this.turnReveals.map((r) => ({ action: r.action, card: r.card })),
      history: this.history.slice(),
    });
  }

  applyAction(action) {
    if (!this.isLegal(action)) {
      throw new Error(`Action illégale : ${actionToString(action)}`);
    }

    const actor = this.currentPlayer;
    const turn = this.turnNumber;
    let card;

    if (action.kind === 'hand') {
      const p = action.target;
      let index;
      if (action.end === HandEnd.Lowest) {
        index = this.handLowRevealed[p]++;
      } else {
        this.handHighRevealed[p]++;
        index = this.hands[p].length - this.handHighRevealed[p];
      }
      card = this.hands[p][index];
      this.turnReveals.push({ action, locKind: 'hand', player: p, index, card });
    } else {
      card = this.middle[action.slot];
      this.turnReveals.push({ action, locKind: 'middle', slot: action.slot, card });
    }

    const targetCard = this.turnReveals[0].card;
    let outcome;

    if (card !== targetCard) {
      this._clearTurnReveals();
      this._advanceTurn();
      outcome = { kind: StepOutcomeKind.Mismatch };
    } else if (this.turnReveals.length === 3) {
      this._removeRevealedTripletteCards();
      this.triplettes[actor].push(card);
      this._clearTurnReveals();

      const gameWon =
        card === INSTANT_WIN_CARD || this.triplettes[actor].length >= TRIPLETTES_TO_WIN;
      if (gameWon) {
        this.winner = actor;
      } else {
        this._advanceTurn();
      }
      outcome = { kind: StepOutcomeKind.TripletteWon, card, gameWon };
    } else {
      outcome = { kind: StepOutcomeKind.Continue };
    }

    const event = { turn, actor, action, card, outcome };
    this.history.push(event);
    return event;
  }

  _clearTurnReveals() {
    this.turnReveals.length = 0;
    this.handLowRevealed.fill(0);
    this.handHighRevealed.fill(0);
  }

  _advanceTurn() {
    this.currentPlayer = (this.currentPlayer + 1) % this.hands.length;
    this.turnNumber += 1;
  }

  _removeRevealedTripletteCards() {
    const handRemovals = [];
    for (const r of this.turnReveals) {
      if (r.locKind === 'hand') {
        handRemovals.push([r.player, r.index]);
      } else {
        this.middle[r.slot] = null;
      }
    }
    handRemovals.sort((a, b) => b[1] - a[1]);
    for (const [player, index] of handRemovals) {
      this.hands[player].splice(index, 1);
      this.handIds[player].splice(index, 1);
    }
  }
}
