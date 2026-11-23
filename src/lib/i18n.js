// Bilingual French / English copy and formatting helpers for Triplettes.

import { HandEnd, Rng } from './game/triplettes.js';

export const LANG_STORAGE_KEY = 'triplettes-lang';

export const FRENCH_BOT_NAMES = Object.freeze([
  'César',
  'Marius',
  'Honoré',
  'Fanny',
  'Claudine',
  'Amélie',
]);

export function pickBotNames(numPlayers, seed) {
  const pool = [...FRENCH_BOT_NAMES];
  const rng = new Rng((seed ^ 0x9e3779b9) >>> 0);
  rng.shuffle(pool);
  return pool.slice(0, Math.max(0, numPlayers - 1));
}

export const DIFFICULTY_LABELS = {
  fr: {
    medium: 'Moyen',
    challenging: 'Coriace',
    hard: 'Difficile',
  },
  en: {
    medium: 'Medium',
    challenging: 'Challenging',
    hard: 'Hard',
  },
};

export const STRINGS = {
  fr: {
    title: 'Triplettes',
    playersOption: (n) => `${n} joueurs`,
    playersAria: 'Nombre de joueurs',
    difficultyAria: 'Difficulté de l’IA',
    rulesBtn: 'Règles',
    menuBtn: 'Menu',
    menuTitle: 'Menu',
    menuCloseAria: 'Fermer le menu',
    languageLabel: 'Langue',
    themeLabel: 'Thème',
    themeAuto: 'Auto',
    speedLabel: 'Vitesse',
    speedAria: 'Durée d’affichage des cartes retournées par l’IA (en secondes)',
    newGameBtn: 'Nouvelle partie',
    newGameCloseAria: 'Fermer Nouvelle partie',
    startGameBtn: 'Lancer la partie',
    playersLabel: 'Nombre de joueurs',
    difficultyLabel: 'Niveau de difficulté',
    showRevealedLabel: 'Afficher les infos révélées',
    showRevealedHelp: 'Affiche sur les cartes cachées les valeurs déjà vues et les bornes (ex. <11).',
    dealingPrompt: 'Distribution des cartes…',
    centerAria: 'Cartes du centre',
    you: 'Vous',
    cardsInHand: 'Cartes en main',
    collectedTriplettes: 'Triplettes gagnées',
    emptyHand: 'Main vide',
    emptySlotAria: (n) => `Emplacement central ${n} vide`,
    revealedMiddleAria: (n, card) => `Centre n°${n} : ${card}`,
    hiddenMiddleAria: (n) => `Révéler la carte centrale n°${n}`,
    revealedHandCardAria: (name, card) => `${name} — carte révélée ${card}`,
    pickLowAria: (name, isHuman, card) =>
      `Révéler la plus petite carte de ${name}${isHuman ? ` (${card})` : ''}`,
    pickHighAria: (name, isHuman, card) =>
      `Révéler la plus grande carte de ${name}${isHuman ? ` (${card})` : ''}`,
    ownLowAria: (card) => `Votre plus petite carte : ${card}`,
    ownHighAria: (card) => `Votre plus grande carte : ${card}`,
    otherLowAria: (name) => `Plus petite carte de ${name}`,
    otherHighAria: (name) => `Plus grande carte de ${name}`,
    ownCardAria: (card) => `Votre carte : ${card}`,
    hiddenCardAria: 'Carte cachée',
    themeLight: '☀︎ Clair',
    themeDark: '☾ Sombre',
    themeSystem: '☀︎/◑/☾',
    themeTitle: 'Changer de thème (système / clair / sombre)',
    themeAria: (label) => `Changer de thème : ${label}`,
    switchToEn: 'Passer en anglais',
    switchToFr: 'Passer en français',
    rulesTitle: 'Règles',
    rulesCredit:
      'This game is a player-vs-computer implementation of the Kaya Miyano game commercialized as trio, Nano, or Slotters.',
    rulesCloseAria: 'Fermer les règles',
    rules: {
      goalHeading: 'But du jeu',
      goalBefore: 'Soyez le premier joueur à réunir ',
      goalThree: '3 triplettes',
      goalMid: ' (trois cartes identiques), ou remportez immédiatement la partie en formant la ',
      goalSeven: 'triplette de 7',
      goalAfter: '.',
      setupHeading: 'Mise en place',
      setupBefore: 'Le paquet contient 36 cartes numérotées de ',
      setupRange: '1 à 12',
      setupAfter:
        ' (en trois exemplaires chacune). Chaque joueur reçoit sa main triée en ordre croissant, du plus petit au plus grand. Les cartes restantes sont disposées face cachée au centre. Une triplette déjà présente dans une main à la distribution ne compte pas : les cartes sont alors redistribuées.',
      turnHeading: 'Déroulement d’un tour',
      turnIntro: 'À votre tour, révélez une carte au choix parmi :',
      turnBullet1A: 'la carte la ',
      turnBullet1Low: 'plus petite',
      turnBullet1B: ' ou la ',
      turnBullet1High: 'plus grande',
      turnBullet1C: ' d’un joueur — y compris dans votre propre main ;',
      turnBullet2A: 'une carte face cachée du ',
      turnBullet2Center: 'centre',
      turnBullet2B: '.',
      turnMatchA:
        'Si la carte révélée porte le même numéro que la précédente, vous continuez votre tour (vous pouvez même redemander la carte suivante du même joueur). Avec ',
      turnMatchThree: '3 cartes identiques',
      turnMatchB: ', vous remportez la triplette et le tour passe au joueur suivant.',
      turnMismatch:
        'Dès qu’une carte diffère, toutes les cartes révélées pendant le tour sont remises face cachée à leur place exacte et le tour s’arrête.',
      tipHeading: 'Astuce',
      tipBody:
        'Observez bien l’ordre des mains : comme elles sont toujours triées, chaque carte révélée encadre les valeurs possibles de ses voisines.',
    },
  },
  en: {
    title: 'Triplettes',
    playersOption: (n) => `${n} players`,
    playersAria: 'Number of players',
    difficultyAria: 'AI difficulty',
    rulesBtn: 'Rules',
    menuBtn: 'Menu',
    menuTitle: 'Menu',
    menuCloseAria: 'Close menu',
    languageLabel: 'Language',
    themeLabel: 'Theme',
    themeAuto: 'Auto',
    speedLabel: 'Speed',
    speedAria: 'How many seconds AI-flipped cards stay revealed',
    newGameBtn: 'New game',
    newGameCloseAria: 'Close New game',
    startGameBtn: 'Start game',
    playersLabel: 'Number of players',
    difficultyLabel: 'Difficulty level',
    showRevealedLabel: 'Show revealed information',
    showRevealedHelp: 'Shows previously revealed values and bounds (e.g. <11) on face-down cards.',
    dealingPrompt: 'Dealing cards…',
    centerAria: 'Center cards',
    you: 'You',
    cardsInHand: 'Cards in hand',
    collectedTriplettes: 'Collected triplettes',
    emptyHand: 'Empty hand',
    emptySlotAria: (n) => `Empty center slot ${n}`,
    revealedMiddleAria: (n, card) => `Center #${n}: ${card}`,
    hiddenMiddleAria: (n) => `Reveal center card #${n}`,
    revealedHandCardAria: (name, card) => `${name} — revealed card ${card}`,
    pickLowAria: (name, isHuman, card) =>
      `Reveal ${isHuman ? 'your' : `${name}’s`} lowest card${isHuman ? ` (${card})` : ''}`,
    pickHighAria: (name, isHuman, card) =>
      `Reveal ${isHuman ? 'your' : `${name}’s`} highest card${isHuman ? ` (${card})` : ''}`,
    ownLowAria: (card) => `Your lowest card: ${card}`,
    ownHighAria: (card) => `Your highest card: ${card}`,
    otherLowAria: (name) => `${name}’s lowest card`,
    otherHighAria: (name) => `${name}’s highest card`,
    ownCardAria: (card) => `Your card: ${card}`,
    hiddenCardAria: 'Face-down card',
    themeLight: '☀︎ Light',
    themeDark: '☾ Dark',
    themeSystem: '☀︎/◑/☾',
    themeTitle: 'Switch theme (system / light / dark)',
    themeAria: (label) => `Switch theme: ${label}`,
    switchToEn: 'Switch to English',
    switchToFr: 'Switch to French',
    rulesTitle: 'Rules',
    rulesCredit:
      'This game is a player-vs-computer implementation of the Kaya Miyano game commercialized as trio, Nano, or Slotters.',
    rulesCloseAria: 'Close rules',
    rules: {
      goalHeading: 'Objective',
      goalBefore: 'Be the first player to collect ',
      goalThree: '3 triplettes',
      goalMid: ' (three matching cards), or win immediately by collecting the ',
      goalSeven: 'triplette of 7s',
      goalAfter: '.',
      setupHeading: 'Setup',
      setupBefore: 'The deck has 36 cards numbered ',
      setupRange: '1 to 12',
      setupAfter:
        ' (three of each). Every player’s hand is sorted from lowest to highest. Remaining cards are placed face down in the center. A triplette already in a hand at the deal does not count, so the cards are dealt again.',
      turnHeading: 'On your turn',
      turnIntro: 'Reveal one card from either:',
      turnBullet1A: 'any player’s ',
      turnBullet1Low: 'lowest',
      turnBullet1B: ' or ',
      turnBullet1High: 'highest',
      turnBullet1C: ' unrevealed card — including your own hand;',
      turnBullet2A: 'any face-down card in the ',
      turnBullet2Center: 'center',
      turnBullet2B: '.',
      turnMatchA:
        'If the card matches the previous one, keep revealing (you may even ask the same player for their next lowest or highest card). Match ',
      turnMatchThree: '3 identical cards',
      turnMatchB: ' to claim the triplette, then play passes to the next player.',
      turnMismatch:
        'If a card does not match, all cards revealed this turn flip back face down in place and your turn ends.',
      tipHeading: 'Tip',
      tipBody:
        'Watch hand order closely: because hands stay sorted, every revealed card narrows down the values of its neighbors.',
    },
  },
};

export function detectInitialLang() {
  if (typeof window === 'undefined') return 'fr';
  try {
    const urlLang = new URLSearchParams(window.location.search).get('lang');
    if (urlLang === 'en' || urlLang === 'fr') return urlLang;
  } catch {}
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === 'en' || saved === 'fr') return saved;
  } catch {}
  if (typeof navigator !== 'undefined' && navigator.language) {
    return navigator.language.toLowerCase().startsWith('fr') ? 'fr' : 'en';
  }
  return 'fr';
}

export function getPlayerName(lang, seat, botNames = FRENCH_BOT_NAMES, humanSeat = 0) {
  if (seat === humanSeat) return STRINGS[lang].you;
  return botNames[seat - 1] ?? FRENCH_BOT_NAMES[(seat - 1) % FRENCH_BOT_NAMES.length];
}

export function getDifficultyLabel(lang, id) {
  return DIFFICULTY_LABELS[lang]?.[id] ?? id;
}

export function describeAction(lang, actor, action, card, botNames, humanSeat = 0) {
  const who = getPlayerName(lang, actor, botNames, humanSeat);
  if (action.kind === 'middle') {
    return lang === 'fr'
      ? `${who} retourne une carte du centre → ${card}`
      : `${who} flips a center card → ${card}`;
  }
  if (lang === 'fr') {
    const endWord = action.end === HandEnd.Lowest ? 'plus petite' : 'plus grande';
    if (action.target === humanSeat) {
      return `${who} révèle votre ${endWord} carte → ${card}`;
    }
    if (action.target === actor) {
      return `${who} révèle sa ${endWord} carte → ${card}`;
    }
    const targetName = getPlayerName(lang, action.target, botNames, humanSeat);
    const prep = /^[AEÉÈÊIÎOÔUÙYH]/i.test(targetName) ? 'd’' : 'de ';
    return `${who} révèle la ${endWord} carte ${prep}${targetName} → ${card}`;
  }
  const endWord = action.end === HandEnd.Lowest ? 'lowest' : 'highest';
  if (action.target === humanSeat) {
    return `${who} reveals your ${endWord} card → ${card}`;
  }
  if (action.target === actor) {
    return `${who} reveals their ${endWord} card → ${card}`;
  }
  return `${who} reveals ${getPlayerName(lang, action.target, botNames, humanSeat)}’s ${endWord} card → ${card}`;
}

export function formatIdlePrompt(lang, view, botNames, humanSeat = 0) {
  if (!view) return '';
  if (view.isOver()) {
    if (view.winner === humanSeat) {
      return lang === 'fr'
        ? 'Victoire\u00a0! Vous remportez la partie.'
        : 'Victory! You win the game.';
    }
    const winner = getPlayerName(lang, view.winner, botNames, humanSeat);
    return lang === 'fr' ? `${winner} remporte la partie.` : `${winner} wins the game.`;
  }
  const target = view.targetCard();
  if (view.currentPlayer === humanSeat) {
    if (target === null) {
      return lang === 'fr'
        ? 'À vous de jouer — choisissez une carte'
        : 'Your turn — pick a card';
    }
    const left = 3 - view.revealedThisTurn.length;
    if (lang === 'fr') {
      return left === 1
        ? `Trouvez la dernière carte ${target}`
        : `Trouvez encore 2 cartes ${target}`;
    }
    return left === 1 ? `Find the last ${target}` : `Find 2 more ${target}s`;
  }
  const who = getPlayerName(lang, view.currentPlayer, botNames, humanSeat);
  if (lang === 'fr') {
    const prep = /^[AEÉÈÊIÎOÔUÙYH]/i.test(who) ? 'd’' : 'de ';
    return `Tour ${prep}${who}…`;
  }
  return `${who}’s turn…`;
}

export function formatStatusEvent(lang, statusEvent, view, botNames, humanSeat = 0) {
  if (!statusEvent) return formatIdlePrompt(lang, view, botNames, humanSeat);

  if (statusEvent.kind === 'continue') {
    const { actor, action, card, left } = statusEvent;
    if (actor === humanSeat) {
      if (lang === 'fr') {
        return left === 1
          ? `Carte ${card}\u00a0— trouvez la 3e carte ${card}`
          : `Carte ${card}\u00a0— trouvez encore 2 cartes ${card}`;
      }
      return left === 1
        ? `Matched ${card} — find the 3rd ${card}`
        : `Revealed ${card} — find 2 more ${card}s`;
    }
    return describeAction(lang, actor, action, card, botNames, humanSeat);
  }

  if (statusEvent.kind === 'mismatch') {
    const step = describeAction(
      lang,
      statusEvent.actor,
      statusEvent.action,
      statusEvent.card,
      botNames,
      humanSeat
    );
    return lang === 'fr' ? `${step} — raté` : `${step} — mismatch`;
  }

  if (statusEvent.kind === 'triplette') {
    const { actor, card, gameWon } = statusEvent;
    const who = getPlayerName(lang, actor, botNames, humanSeat);
    if (lang === 'fr') {
      if (gameWon) {
        return actor === humanSeat
          ? `Triplette de ${card}\u00a0! Victoire\u00a0!`
          : `Triplette de ${card}\u00a0— ${who} gagne\u00a0!`;
      }
      return actor === humanSeat
        ? `Triplette de ${card} remportée\u00a0!`
        : `${who} remporte la triplette de ${card}\u00a0!`;
    }
    if (gameWon) {
      return actor === humanSeat
        ? `${card} triplette! You win!`
        : `${card} triplette — ${who} wins!`;
    }
    return actor === humanSeat
      ? `You collected the ${card} triplette!`
      : `${who} collected the ${card} triplette!`;
  }

  return formatIdlePrompt(lang, view, botNames, humanSeat);
}
