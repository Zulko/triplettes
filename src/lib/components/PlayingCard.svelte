<script>
  let {
    value = null,
    faceUp = false,
    empty = false,
    clickable = false,
    revealed = false,
    highlight = null, // 'revealed' | 'triplette' | 'mismatch' | null
    callout = false,
    memoryHint = null, // { kind: 'exact', value } | { kind: 'bounds', lines } | null
    size = 'md', // 'sm' | 'md'
    ariaLabel = '',
    onclick = undefined,
  } = $props();

  // Remember the last known value so the front face stays painted while a face-down
  // card rotates back on mismatch (hidden past 90deg by backface-visibility).
  let lastSeenValue = null;
  let displayValue = $derived.by(() => {
    if (value !== null && value !== undefined) {
      lastSeenValue = value;
      return value;
    }
    return lastSeenValue;
  });

  let isSeven = $derived(displayValue === 7);
</script>

{#if empty}
  <div
    class={['card-slot-shell', 'card-empty', `size-${size}`]}
    aria-label={ariaLabel}
  >
    <span class="empty-dot" aria-hidden="true"></span>
  </div>
{:else}
  <button
    type="button"
    class={[
      'card-scene',
      `size-${size}`,
      clickable && 'is-clickable',
      revealed && 'is-revealed',
      callout && 'is-callout',
    ]}
    disabled={!clickable}
    aria-label={ariaLabel}
    onclick={clickable ? onclick : undefined}
  >
    <span class="card-lift">
      <span class={['card-flipper', faceUp && 'is-face-up']}>
        <span class="card-side card-back" aria-hidden={faceUp}>
          <span class="back-panel" aria-hidden="true">
            {#if memoryHint}
              <span
                class={[
                  'back-hint',
                  memoryHint.kind === 'exact' ? 'hint-exact' : 'hint-bounds',
                  memoryHint.kind === 'exact' && memoryHint.value === 7 && 'hint-seven',
                  memoryHint.kind === 'bounds' && memoryHint.lines.length > 1 && 'hint-stacked',
                ]}
              >
                {#if memoryHint.kind === 'exact'}
                  {memoryHint.value}
                {:else}
                  {#each memoryHint.lines as line, i (i)}
                    <span>{line}</span>
                  {/each}
                {/if}
              </span>
            {/if}
          </span>
        </span>

        <span
          class={[
            'card-side',
            'card-face',
            isSeven && 'is-seven',
            highlight === 'revealed' && 'hl-revealed',
            highlight === 'triplette' && 'hl-triplette',
            highlight === 'mismatch' && 'hl-mismatch',
          ]}
          aria-hidden={!faceUp}
        >
          {#if displayValue !== null && displayValue !== undefined}
            <span class="center-num">{displayValue}</span>
          {/if}
        </span>
      </span>
    </span>
  </button>
{/if}

<style>
  .size-sm {
    --card-default-w: 36px;
  }

  .size-md {
    --card-default-w: 44px;
  }

  .card-slot-shell,
  .card-scene {
    --w: var(--card-w, var(--card-default-w, 44px));
    --r: clamp(3.5px, calc(var(--w) * 0.13), 14px);
  }

  .card-slot-shell {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--w);
    aspect-ratio: 5 / 7;
    border-radius: var(--r);
    flex-shrink: 0;
  }

  .card-empty {
    background: var(--card-empty-bg);
    border: 1.5px dashed var(--card-empty-border);
  }

  .empty-dot {
    width: 3.5px;
    height: 3.5px;
    border-radius: 999px;
    background: var(--card-empty-border);
  }

  .card-scene {
    position: relative;
    display: inline-block;
    width: var(--w);
    aspect-ratio: 5 / 7;
    padding: 0;
    border: none;
    background: transparent;
    flex-shrink: 0;
    perspective: 720px;
    cursor: default;
    -webkit-tap-highlight-color: transparent;
  }

  .card-scene:disabled {
    opacity: 1;
    cursor: default;
  }

  .card-scene.is-revealed {
    z-index: 4;
  }

  .card-scene.is-clickable {
    cursor: pointer;
  }

  .card-scene.is-clickable:hover {
    z-index: 6;
  }

  .card-lift {
    position: relative;
    display: block;
    width: 100%;
    height: 100%;
    transform-style: preserve-3d;
    -webkit-transform-style: preserve-3d;
    transition: transform 140ms ease;
  }

  .card-scene.is-revealed .card-lift {
    transform: translateY(-5px);
  }

  .card-scene.is-callout {
    z-index: 8;
  }

  .card-scene.is-callout:not(.is-revealed) .card-lift {
    animation: ai-card-jump 500ms cubic-bezier(0.35, 0.8, 0.4, 1);
  }

  .card-scene.is-callout .card-side {
    border-width: 2.75px;
    box-shadow:
      0 0 0 2px var(--accent),
      var(--card-shadow);
  }

  @keyframes ai-card-jump {
    0%,
    50%,
    100% {
      transform: translateY(0);
    }
    18%,
    68% {
      transform: translateY(-9px);
    }
  }

  .card-scene.is-clickable:hover .card-lift {
    transform: translateY(-4px);
  }

  .card-scene.is-clickable:active .card-lift {
    transform: translateY(-1px);
  }

  .card-flipper {
    position: relative;
    display: block;
    width: 100%;
    height: 100%;
    transform-style: preserve-3d;
    -webkit-transform-style: preserve-3d;
    transform: rotateY(0deg);
    transition: transform 300ms cubic-bezier(0.22, 1, 0.36, 1) var(--flip-delay, 0ms);
  }

  .card-flipper.is-face-up {
    transform: rotateY(180deg);
  }

  .card-side {
    position: absolute;
    inset: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--r);
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    transition: box-shadow 140ms ease, border-color 140ms ease;
  }

  .card-back {
    transform: rotateY(0deg) translateZ(0.5px);
    background: var(--card-back-rim);
    border: solid var(--card-back-border);
    border-width: clamp(1.25px, calc(var(--w) * 0.028), 2.25px);
    box-shadow: var(--card-shadow);
  }

  .card-face {
    transform: rotateY(180deg) translateZ(0.5px);
    background: var(--card-face-bg);
    color: var(--card-face-text);
    border: solid var(--card-face-border);
    border-width: clamp(1.25px, calc(var(--w) * 0.028), 2.25px);
    box-shadow: var(--card-shadow);
  }

  .card-face.is-seven {
    color: var(--seven);
    border-color: color-mix(in srgb, var(--seven) 55%, var(--card-face-border));
  }

  .back-panel {
    position: absolute;
    inset: clamp(2px, calc(var(--w) * 0.085), 9px);
    border-radius: max(1.5px, calc(var(--r) - 2px));
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
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }

  .back-panel::before {
    content: '';
    position: absolute;
    inset: clamp(1.5px, calc(var(--w) * 0.055), 6px);
    border-radius: max(1px, calc(var(--r) - 3.5px));
    border: 1px solid var(--card-back-inner-line);
    pointer-events: none;
  }

  .back-hint {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-family: var(--font-card);
    font-weight: 600;
    line-height: 1;
    font-variant-numeric: lining-nums tabular-nums;
    padding: calc(var(--w) * 0.08) calc(var(--w) * 0.09);
    border-radius: 3px;
    background: var(--card-hint-bg);
    color: var(--card-hint-text);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
    white-space: nowrap;
  }

  .back-hint.hint-exact {
    font-size: calc(var(--w) * 0.48);
    letter-spacing: -0.01em;
  }

  .back-hint.hint-exact.hint-seven {
    color: var(--card-hint-seven);
  }

  .back-hint.hint-bounds {
    font-size: calc(var(--w) * 0.34);
    letter-spacing: -0.03em;
    color: var(--card-hint-bound);
    gap: 1px;
  }

  .back-hint.hint-stacked {
    font-size: calc(var(--w) * 0.27);
  }

  .center-num {
    font-family: var(--font-card);
    font-weight: 600;
    font-size: calc(var(--w) * 0.54);
    line-height: 1;
    letter-spacing: -0.01em;
    font-variant-numeric: lining-nums tabular-nums;
  }

  .is-clickable .card-side {
    border-color: var(--accent);
    box-shadow:
      0 0 0 1.5px var(--accent-soft),
      var(--card-shadow);
  }

  .is-clickable:hover .card-side {
    border-color: var(--accent);
    box-shadow:
      0 0 0 2px color-mix(in srgb, var(--accent) 42%, transparent),
      var(--card-shadow-hover);
  }

  .card-face.hl-revealed {
    border-color: var(--accent);
    box-shadow:
      0 0 0 2px color-mix(in srgb, var(--accent) 55%, transparent),
      0 5px 12px var(--shadow);
  }

  .card-face.hl-triplette {
    border-color: var(--ok);
    box-shadow:
      0 0 0 2.5px var(--ok),
      0 5px 14px var(--ok-soft);
  }

  .card-face.hl-mismatch {
    border-color: var(--bad);
    box-shadow:
      0 0 0 2.5px var(--bad),
      0 5px 14px var(--bad-soft);
  }

  @media (prefers-reduced-motion: reduce) {
    .card-flipper {
      transition-duration: 0.01ms;
    }

    .card-scene.is-callout:not(.is-revealed) .card-lift {
      animation: none;
    }
  }
</style>
