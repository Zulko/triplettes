<script>
  import { tick } from 'svelte';
  import { STRINGS } from '../i18n.js';

  let { open = false, lang = 'fr', onClose, returnFocusTo = null } = $props();

  let s = $derived(STRINGS[lang]);
  let r = $derived(s.rules);

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
      aria-labelledby="rules-modal-title"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      {@attach focusDialog}
    >
      <div class="modal-header">
        <h2 id="rules-modal-title" class="modal-title">{s.rulesTitle}</h2>
        <button
          type="button"
          class="modal-close"
          onclick={handleClose}
          aria-label={s.rulesCloseAria}
        >
          ×
        </button>
      </div>

      <div class="modal-body">
        <p class="rules-credit">{s.rulesCredit}</p>

        <section class="rule-section">
          <h3>{r.goalHeading}</h3>
          <p>
            {r.goalBefore}<strong>{r.goalThree}</strong>{r.goalMid}<strong>{r.goalSeven}</strong>{r.goalAfter}
          </p>
        </section>

        <section class="rule-section">
          <h3>{r.setupHeading}</h3>
          <p>
            {r.setupBefore}<strong>{r.setupRange}</strong>{r.setupAfter}
          </p>
        </section>

        <section class="rule-section">
          <h3>{r.turnHeading}</h3>
          <p>{r.turnIntro}</p>
          <ul>
            <li>
              {r.turnBullet1A}<strong>{r.turnBullet1Low}</strong>{r.turnBullet1B}<strong>{r.turnBullet1High}</strong>{r.turnBullet1C}
            </li>
            <li>
              {r.turnBullet2A}<strong>{r.turnBullet2Center}</strong>{r.turnBullet2B}
            </li>
          </ul>
          <p>
            {r.turnMatchA}<strong>{r.turnMatchThree}</strong>{r.turnMatchB}
          </p>
          <p>{r.turnMismatch}</p>
        </section>

        <section class="rule-section">
          <h3>{r.tipHeading}</h3>
          <p>{r.tipBody}</p>
        </section>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-root {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 18px;
    background: rgba(0, 0, 0, 0.45);
    user-select: text;
    -webkit-user-select: text;
  }

  .modal-dialog {
    position: relative;
    width: 100%;
    max-width: min(94vw, 450px);
    max-height: min(84vh, 600px);
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
      animation: modal-in 0.2s ease-out;
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
    padding: 13px 16px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .modal-title {
    margin: 0;
    font-family: var(--font-display);
    font-size: 1.38rem;
    font-weight: 400;
    letter-spacing: 0.04em;
    color: var(--accent);
  }

  .modal-close {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 1.45rem;
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
    padding: 14px 18px 18px;
    overflow-y: auto;
    font-size: 0.88rem;
    line-height: 1.55;
  }

  .rules-credit {
    margin: 0 0 0.95rem;
    color: var(--text-muted);
    font-size: 0.82rem;
  }

  .rule-section + .rule-section {
    margin-top: 0.95rem;
    padding-top: 0.95rem;
    border-top: 1px solid var(--border-subtle);
  }

  .rule-section h3 {
    margin: 0 0 0.45rem;
    font-family: var(--font-hand);
    font-size: 1.05rem;
    font-weight: 400;
    letter-spacing: 0.04em;
    color: var(--accent);
  }

  .rule-section p {
    margin: 0;
  }

  .rule-section p + p {
    margin-top: 0.55rem;
  }

  .rule-section ul {
    margin: 0.4rem 0 0.55rem;
    padding-left: 1.2rem;
  }

  .rule-section li + li {
    margin-top: 0.25rem;
  }
</style>
