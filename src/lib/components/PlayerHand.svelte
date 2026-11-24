<script>
  import PlayingCard from './PlayingCard.svelte';
  import { HandEnd } from '../game/triplettes.js';
  import { STRINGS } from '../i18n.js';

  let {
    lang = 'fr',
    seat = 0,
    numPlayers = 4,
    name,
    hand,
    triplettes = [],
    hiddenTripletteCard = null,
    isHuman = false,
    isCurrent = false,
    isWinner = false,
    isDealing = false,
    dealPhase = 'done', // 'prepare' | 'flying' | 'flipping' | 'done'
    dealStepMs = 20,
    dealOffsets = {},
    canClickLow = false,
    canClickHigh = false,
    revealHighlight = 'revealed',
    calloutLoc = null,
    memory = null, // { exact, lowBound, highBound } | null
    onPickEnd = undefined,
  } = $props();

  let s = $derived(STRINGS[lang]);
  let total = $derived(hand.slots.length);
  let lowEnd = $derived(hand.lowRevealed);
  let highStart = $derived(total - hand.highRevealed);
  let unrevealedCount = $derived(Math.max(0, highStart - lowEnd));
  let cardSize = $derived(isHuman ? 'md' : 'sm');

  // Overlap fraction of --card-w between adjacent interior cards:
  // - Human hand keeps 82% of each card visible so centered numbers (even 10..12) stay clear.
  // - Bot face-down interior cards overlap more tightly (42% exposed), unless a remembered
  //   hint is shown on the previous card (85% exposed so the hint stays unobstructed).
  const HUMAN_OVERLAP_STEP = 0.82;
  const BOT_OVERLAP_STEP = 0.42;
  const BOT_HINT_OVERLAP_STEP = 0.85;

  // Render every card in one stable keyed list so revealing/hiding a card keeps
  // the same PlayingCard instance mounted and plays the smooth 3D flip animation.
  let layout = $derived.by(() => {
    const slots = hand.slots;
    const items = [];
    const overlapStep = isHuman ? HUMAN_OVERLAP_STEP : BOT_OVERLAP_STEP;
    let widthUnits = 0;
    let wideGaps = 0;
    let tightGaps = 0;

    for (let idx = 0; idx < slots.length; idx++) {
      const card = slots[idx];
      const isLowRevealed = idx < lowEnd;
      const isHighRevealed = idx >= highStart;
      const isRevealed = isLowRevealed || isHighRevealed;
      const isFirstUnrev = !isRevealed && idx === lowEnd;
      const isLastUnrev = !isRevealed && unrevealedCount >= 2 && idx === highStart - 1;
      const isInterior = !isRevealed && !isFirstUnrev && !isLastUnrev;

      let memoryHint = null;
      if (!isHuman && !isRevealed && memory) {
        const exactVal = memory.exact?.[idx] ?? null;
        if (exactVal !== null) {
          memoryHint = { kind: 'exact', value: exactVal };
        } else {
          const lines = [];
          if (idx === 0 && memory.lowBound !== null) {
            lines.push(`>${memory.lowBound}`);
          }
          if (idx === slots.length - 1 && memory.highBound !== null) {
            lines.push(`<${memory.highBound}`);
          }
          if (lines.length > 0) {
            memoryHint = { kind: 'bounds', lines };
          }
        }
      }

      let spacing = 'none';
      if (idx === 0) {
        widthUnits += 1;
      } else {
        const prev = items[idx - 1];
        if (isInterior && prev.isInterior) {
          if (!isHuman && prev.memoryHint) {
            spacing = 'overlap-hint';
            widthUnits += BOT_HINT_OVERLAP_STEP;
          } else {
            spacing = 'overlap';
            widthUnits += overlapStep;
          }
        } else if (
          (isLowRevealed && prev.isLowRevealed) ||
          (isHighRevealed && prev.isHighRevealed)
        ) {
          spacing = 'tight';
          widthUnits += 1;
          tightGaps += 1;
        } else {
          spacing = 'wide';
          widthUnits += 1;
          wideGaps += 1;
        }
      }

      const clickable =
        !isDealing && ((isFirstUnrev && canClickLow) || (isLastUnrev && canClickHigh));
      const end = isFirstUnrev ? HandEnd.Lowest : isLastUnrev ? HandEnd.Highest : null;

      const dealIndex = idx * numPlayers + seat;
      const dealKey = `h-${seat}-${idx}`;
      const offset = dealOffsets[dealKey];
      const id = hand.ids?.[idx] ?? idx;

      // Your own cards fly out face-down from the deck and flip face-up via CSS
      // transition-delay right as they land; bots stay face-down until revealed.
      const cardFaceUp = isHuman
        ? !isDealing || dealPhase === 'flipping'
        : isRevealed;

      let ariaLabel;
      if (isRevealed) {
        ariaLabel = s.revealedHandCardAria(name, card);
      } else if (isFirstUnrev) {
        ariaLabel = clickable
          ? s.pickLowAria(name, isHuman, card)
          : isHuman
            ? s.ownLowAria(card)
            : s.otherLowAria(name);
      } else if (isLastUnrev) {
        ariaLabel = clickable
          ? s.pickHighAria(name, isHuman, card)
          : isHuman
            ? s.ownHighAria(card)
            : s.otherHighAria(name);
      } else {
        ariaLabel = isHuman ? s.ownCardAria(card) : s.hiddenCardAria;
      }

      items.push({
        id,
        idx,
        card,
        isLowRevealed,
        isHighRevealed,
        isRevealed,
        isInterior,
        spacing,
        clickable,
        end,
        dealIndex,
        dealKey,
        offset,
        cardFaceUp,
        memoryHint,
        ariaLabel,
      });
    }

    return {
      items,
      widthUnits: Math.max(1, widthUnits),
      wideGaps,
      tightGaps,
    };
  });
</script>

<section
  class={[
    'seat-row',
    isHuman ? 'seat-human' : 'seat-bot',
    isCurrent && !isDealing && 'is-current',
    isWinner && 'is-winner',
  ]}
  data-seat-row={seat}
  aria-label={name}
>
  {#if isHuman && triplettes.length > 0}
    <div class="seat-meta seat-meta-human">
      <div class="triplette-tray" aria-label={s.collectedTriplettes}>
        {#each triplettes as cardValue, tIdx (cardValue)}
          <div
            class={[
              'mini-stack',
              cardValue === 7 && 'is-seven',
              hiddenTripletteCard === cardValue && 'is-landing',
            ]}
            data-triplette-slot={`${seat}-${tIdx}`}
            style:animation-delay={isWinner ? `${tIdx * 130}ms` : undefined}
            title={`3×${cardValue}`}
          >
            <span class="mini-card mini-c1" aria-hidden="true"></span>
            <span class="mini-card mini-c2" aria-hidden="true"></span>
            <span class="mini-card mini-c3">
              <span class="mini-num">{cardValue}</span>
            </span>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <div
    class={['hand-stage', isHuman ? 'stage-human' : 'stage-bot']}
    style:--hand-units={layout.widthUnits}
    style:--wide-gaps={layout.wideGaps}
    style:--tight-gaps={layout.tightGaps}
  >
    <div class="hand-anchor">
      {#if !isHuman}
        <div class="seat-meta seat-meta-bot">
          <span class="seat-name">{name}</span>

          {#if triplettes.length > 0}
            <div class="triplette-tray" aria-label={s.collectedTriplettes}>
              {#each triplettes as cardValue, tIdx (cardValue)}
                <div
                  class={[
                    'mini-stack',
                    cardValue === 7 && 'is-seven',
                    hiddenTripletteCard === cardValue && 'is-landing',
                  ]}
                  data-triplette-slot={`${seat}-${tIdx}`}
                  style:animation-delay={isWinner ? `${tIdx * 130}ms` : undefined}
                  title={`3×${cardValue}`}
                >
                  <span class="mini-card mini-c1" aria-hidden="true"></span>
                  <span class="mini-card mini-c2" aria-hidden="true"></span>
                  <span class="mini-card mini-c3">
                    <span class="mini-num">{cardValue}</span>
                  </span>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      {#if total === 0}
        <span class="empty-hand">{s.emptyHand}</span>
      {:else}
        <div class={['hand-row', isHuman ? 'row-human' : 'row-bot']}>
          {#each layout.items as item (item.id)}
            <div
              class={[
                'card-slot',
                item.spacing === 'overlap' && 'gap-overlap',
                item.spacing === 'overlap-hint' && 'gap-overlap-hint',
                item.spacing === 'tight' && 'gap-tight',
                item.spacing === 'wide' && 'gap-wide',
              ]}
            >
              <div
                class={[
                  'deal-wrap',
                  isDealing && dealPhase === 'prepare' && 'is-undealt',
                  isDealing && dealPhase !== 'prepare' && item.offset && 'is-dealing-in',
                ]}
                data-deal-key={item.dealKey}
                data-card-loc={item.dealKey}
                style:--deal-dx={item.offset ? `${item.offset.dx}px` : '0px'}
                style:--deal-dy={item.offset ? `${item.offset.dy}px` : '0px'}
                style:--deal-rot={item.offset ? `${item.offset.rot}deg` : '0deg'}
                style:--deal-delay={isDealing ? `${item.dealIndex * dealStepMs}ms` : '0ms'}
                style:--flip-delay={isDealing && isHuman
                  ? `${item.dealIndex * dealStepMs + 140}ms`
                  : '0ms'}
              >
                <PlayingCard
                  value={item.card}
                  faceUp={item.cardFaceUp}
                  revealed={item.isRevealed}
                  size={cardSize}
                  clickable={item.clickable}
                  highlight={item.isRevealed ? revealHighlight : null}
                  callout={calloutLoc === item.dealKey}
                  memoryHint={item.memoryHint}
                  ariaLabel={item.ariaLabel}
                  onclick={item.clickable && item.end ? () => onPickEnd?.(item.end) : undefined}
                />
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</section>

<style>
  .seat-row {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: calc(10px * var(--layout-scale, 1));
    padding: calc(5px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    border-radius: 10px;
    background: transparent;
    border: none;
    transition: background-color 180ms ease;
    min-width: 0;
  }

  .seat-human {
    padding: calc(7px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
  }

  .seat-row.is-winner {
    background: var(--winner-bg);
  }

  .hand-anchor {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .seat-meta {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: calc(5px * var(--layout-scale, 1));
  }

  .seat-meta-bot {
    position: absolute;
    right: calc(100% + 14px * var(--layout-scale, 1));
    top: 50%;
    transform: translateY(-50%);
    align-items: flex-end;
    text-align: right;
  }

  .seat-meta-human {
    flex-shrink: 0;
    align-items: flex-start;
  }

  .seat-name {
    font-family: var(--font-hand);
    font-size: calc(1.24rem * var(--layout-scale, 1));
    font-weight: 400;
    letter-spacing: 0.02em;
    line-height: 1.05;
    color: var(--text);
    white-space: nowrap;
    transition: color 160ms ease;
  }

  .seat-row.is-current .seat-name {
    color: var(--accent);
  }

  .seat-row.is-winner .seat-name {
    color: var(--ok);
  }

  /* Collected triplettes: compact miniature 3-card stacks */
  .triplette-tray {
    display: flex;
    align-items: center;
    gap: calc(3px * var(--layout-scale, 1));
  }

  .mini-stack {
    position: relative;
    width: calc(22px * var(--layout-scale, 1));
    height: calc(28px * var(--layout-scale, 1));
    flex-shrink: 0;
    transition: opacity 120ms ease;
  }

  .mini-stack.is-landing {
    opacity: 0;
  }

  .seat-row.is-winner .mini-stack {
    animation: win-jump 1.05s cubic-bezier(0.36, 0.07, 0.19, 0.97) infinite;
    will-change: transform;
  }

  @keyframes win-jump {
    0%,
    70%,
    100% {
      transform: translateY(0) scale(1, 1) rotate(0deg);
    }
    18% {
      transform: translateY(calc(-6px * var(--layout-scale, 1))) scale(0.97, 1.05) rotate(-3deg);
    }
    36% {
      transform: translateY(0) scale(1.04, 0.95) rotate(0deg);
    }
    52% {
      transform: translateY(calc(-4px * var(--layout-scale, 1))) scale(0.99, 1.02) rotate(2deg);
    }
  }

  .mini-card {
    position: absolute;
    width: calc(18px * var(--layout-scale, 1));
    height: calc(25px * var(--layout-scale, 1));
    border-radius: calc(3px * var(--layout-scale, 1));
    background: var(--card-face-bg);
    border: 1px solid var(--card-face-border);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.22);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--card-face-text);
  }

  .mini-c1 {
    top: 0;
    left: 0;
  }

  .mini-c2 {
    top: calc(1.5px * var(--layout-scale, 1));
    left: calc(2px * var(--layout-scale, 1));
  }

  .mini-c3 {
    top: calc(3px * var(--layout-scale, 1));
    left: calc(4px * var(--layout-scale, 1));
  }

  .mini-stack.is-seven .mini-card {
    color: var(--seven);
    border-color: color-mix(in srgb, var(--seven) 60%, var(--card-face-border));
  }

  .mini-num {
    font-family: var(--font-card);
    font-size: calc(0.74rem * var(--layout-scale, 1));
    font-weight: 600;
    line-height: 1;
    letter-spacing: -0.02em;
    font-variant-numeric: lining-nums tabular-nums;
  }

  /* Fluid single-line scaling based on the exact inline space available to this hand */
  .hand-stage {
    flex: 1;
    min-width: 0;
    container-type: inline-size;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .stage-bot {
    --card-max-w: calc(36px * var(--layout-scale, 1));
    --wide-gap-px: calc(8px * var(--layout-scale, 1));
    --tight-gap-px: calc(4px * var(--layout-scale, 1));
    min-height: calc(54px * var(--layout-scale, 1));
    padding-inline: calc(88px * var(--layout-scale, 1));
  }

  .stage-human {
    --card-max-w: calc(44px * var(--layout-scale, 1));
    --wide-gap-px: calc(10px * var(--layout-scale, 1));
    --tight-gap-px: calc(4px * var(--layout-scale, 1));
    min-height: calc(66px * var(--layout-scale, 1));
  }

  .empty-hand {
    font-size: 0.82rem;
    color: var(--text-muted);
    font-style: italic;
  }

  .hand-row {
    --card-w: min(
      var(--card-max-w),
      calc(
        (
            100cqi - var(--wide-gaps, 0) * var(--wide-gap-px) - var(--tight-gaps, 0) *
              var(--tight-gap-px)
          ) / var(--hand-units, 1)
      )
    );
    display: flex;
    align-items: center;
    justify-content: flex-start;
    flex-wrap: nowrap;
  }

  .card-slot {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    transition: margin-left 140ms ease;
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

  .row-bot .gap-overlap {
    margin-left: calc(var(--card-w) * -0.58);
  }

  .row-bot .gap-overlap-hint {
    margin-left: calc(var(--card-w) * -0.15);
  }

  .row-human .gap-overlap {
    margin-left: calc(var(--card-w) * -0.18);
  }

  .gap-tight {
    margin-left: var(--tight-gap-px);
  }

  .gap-wide {
    margin-left: var(--wide-gap-px);
  }

  @media (prefers-reduced-motion: reduce) {
    .deal-wrap.is-dealing-in,
    .seat-row.is-winner .mini-stack {
      animation: none;
    }
  }

  @media (max-width: 520px) {
    .seat-row {
      gap: 8px;
      padding: 4px 6px;
    }

    .seat-meta-bot {
      right: calc(100% + 10px);
    }

    .seat-name {
      font-size: 1.08rem;
    }

    .stage-bot {
      --wide-gap-px: 6px;
      --tight-gap-px: 3px;
      padding-inline: 58px;
    }

    .stage-human {
      --wide-gap-px: 7px;
      --tight-gap-px: 3px;
    }
  }

  @media (max-width: 380px) {
    .seat-meta-bot {
      right: calc(100% + 6px);
    }

    .seat-name {
      font-size: 0.96rem;
    }

    .stage-bot {
      padding-inline: 46px;
    }
  }
</style>
