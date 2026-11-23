<script>
  import { tick } from 'svelte';
  import { DIFFICULTIES } from '../game/difficulties.js';
  import { STRINGS, getDifficultyLabel } from '../i18n.js';

  const PLAYER_COUNTS = [3, 4, 5, 6];

  let {
    open = false,
    lang = 'fr',
    numPlayers = $bindable(4),
    difficultyId = $bindable('challenging'),
    showRevealedInfo = $bindable(false),
    onStart,
    onClose,
    returnFocusTo = null,
  } = $props();

  let s = $derived(STRINGS[lang]);

  function lockBodyScroll() {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }

  function focusDialog(node) {
    node.focus({ preventScroll: true });
  }

  function handleWindowKeydown(e) {
    if (open && e.key === 'Escape') void handleClose();
  }

  async function handleClose() {
    onClose?.();
    await tick();
    returnFocusTo?.focus();
  }

  function handleSubmit(e) {
    e.preventDefault();
    onStart?.({
      numPlayers: Number(numPlayers),
      difficultyId,
      showRevealedInfo: Boolean(showRevealedInfo),
    });
  }
</script>

<svelte:window onkeydown={handleWindowKeydown} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="modal-root"
    onclick={handleClose}
    role="presentation"
    {@attach lockBodyScroll}
  >
    <div
      class="modal-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-game-modal-title"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      {@attach focusDialog}
    >
      <div class="modal-header">
        <h2 id="new-game-modal-title" class="modal-title">{s.newGameBtn}</h2>
        <button
          type="button"
          class="modal-close"
          onclick={handleClose}
          aria-label={s.newGameCloseAria}
        >
          ×
        </button>
      </div>

      <form class="modal-body" onsubmit={handleSubmit}>
        <div class="select-row">
          <select
            class="field-select"
            aria-label={s.playersLabel}
            bind:value={numPlayers}
          >
            {#each PLAYER_COUNTS as count (count)}
              <option value={count}>{s.playersOption(count)}</option>
            {/each}
          </select>

          <select
            class="field-select"
            aria-label={s.difficultyLabel}
            bind:value={difficultyId}
          >
            {#each DIFFICULTIES as d (d.id)}
              <option value={d.id}>{getDifficultyLabel(lang, d.id)}</option>
            {/each}
          </select>
        </div>

        <label class="toggle-field">
          <span class="toggle-copy">
            <span class="field-label">{s.showRevealedLabel}</span>
            <span class="field-help">{s.showRevealedHelp}</span>
          </span>
          <span class="switch">
            <input type="checkbox" bind:checked={showRevealedInfo} />
            <span class="switch-track" aria-hidden="true"></span>
          </span>
        </label>

        <button type="submit" class="start-btn">
          {s.startGameBtn}
        </button>
      </form>
    </div>
  </div>
{/if}

<style>
  .modal-root {
    position: fixed;
    inset: 0;
    z-index: 120;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 18px;
    background: rgba(0, 0, 0, 0.45);
  }

  .modal-dialog {
    position: relative;
    width: 100%;
    max-width: min(92vw, 330px);
    display: flex;
    flex-direction: column;
    background: var(--surface);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 12px 38px var(--shadow);
    overflow: hidden;
    outline: none;
  }

  @media (prefers-reduced-motion: no-preference) {
    .modal-dialog {
      animation: modal-in 0.16s ease-out;
    }
  }

  @keyframes modal-in {
    from {
      opacity: 0;
      transform: translateY(6px) scale(0.99);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 11px 16px;
    border-bottom: 1px solid var(--border);
  }

  .modal-title {
    margin: 0;
    font-family: var(--font-display);
    font-size: 1.35rem;
    font-weight: 400;
    letter-spacing: 0.04em;
    color: var(--accent);
  }

  .modal-close {
    flex-shrink: 0;
    width: 30px;
    height: 30px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 1.4rem;
    line-height: 1;
    color: var(--text-muted);
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .modal-close:hover {
    background: var(--btn-bg-hover);
    color: var(--text);
  }

  .modal-body {
    padding: 15px 16px 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .select-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .field-select {
    width: 100%;
    padding: 7px 10px;
    border-radius: 7px;
    border: 1px solid var(--border);
    background: var(--surface-alt);
    color: var(--text);
    font-family: var(--font-hand);
    font-size: 1.02rem;
    font-weight: 400;
    cursor: pointer;
    transition: border-color 0.15s ease;
  }

  .field-select:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  .field-select:hover {
    border-color: var(--accent);
  }

  .toggle-field {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    cursor: pointer;
  }

  .toggle-copy {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .field-label {
    font-family: var(--font-hand);
    font-size: 1.02rem;
    font-weight: 400;
    letter-spacing: 0.02em;
    color: var(--text);
  }

  .field-help {
    font-family: var(--font-hand);
    font-size: 0.86rem;
    line-height: 1.25;
    color: var(--text-muted);
  }

  .switch {
    position: relative;
    flex-shrink: 0;
    width: 38px;
    height: 22px;
    margin-top: 1px;
  }

  .switch input {
    position: absolute;
    opacity: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    cursor: pointer;
  }

  .switch-track {
    position: absolute;
    inset: 0;
    border-radius: 999px;
    background: var(--border);
    transition: background-color 0.18s ease;
  }

  .switch-track::after {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 16px;
    height: 16px;
    border-radius: 999px;
    background: var(--surface);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
    transition: transform 0.18s ease;
  }

  .switch input:checked + .switch-track {
    background: var(--accent);
  }

  .switch input:checked + .switch-track::after {
    transform: translateX(16px);
  }

  .switch input:focus-visible + .switch-track {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .start-btn {
    width: 100%;
    padding: 8px 14px;
    border: none;
    border-radius: 8px;
    background: var(--accent);
    color: #fffdf8;
    font-family: var(--font-hand);
    font-size: 1.08rem;
    font-weight: 400;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: filter 0.15s ease, transform 0.1s ease;
  }

  .start-btn:hover {
    filter: brightness(1.08);
  }

  .start-btn:active {
    transform: translateY(1px);
  }
</style>
