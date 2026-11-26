<script>
  import { tick } from 'svelte';
  import { STRINGS } from '../i18n.js';
  import { detectInstallPlatform } from '../pwaInstall.js';

  let { open = false, lang = 'fr', onClose, returnFocusTo = null } = $props();

  let s = $derived(STRINGS[lang]);
  let instructions = $derived(s.install[detectInstallPlatform()] ?? s.install.other);

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
      aria-labelledby="install-modal-title"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      {@attach focusDialog}
    >
      <div class="modal-header">
        <h2 id="install-modal-title" class="modal-title">{instructions.title}</h2>
        <button
          type="button"
          class="modal-close"
          onclick={handleClose}
          aria-label={s.installCloseAria}
        >
          ×
        </button>
      </div>

      <div class="modal-body">
        <ol class="install-steps">
          {#each instructions.steps as step, i (i)}
            <li>{step}</li>
          {/each}
        </ol>
        {#if instructions.note}
          <p class="install-note">{instructions.note}</p>
        {/if}
        <button type="button" class="install-done" onclick={handleClose}>
          {s.installGotIt}
        </button>
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
    max-width: min(94vw, 400px);
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
    font-size: 1.28rem;
    font-weight: 400;
    letter-spacing: 0.03em;
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
    padding: 14px 18px 16px;
  }

  .install-steps {
    margin: 0;
    padding-left: 1.2rem;
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 0.9rem;
    line-height: 1.45;
  }

  .install-note {
    margin: 12px 0 0;
    font-size: 0.8rem;
    line-height: 1.4;
    color: var(--text-muted);
  }

  .install-done {
    display: block;
    width: 100%;
    margin-top: 14px;
    padding: 8px 14px;
    border: none;
    border-radius: 8px;
    background: var(--accent);
    color: #fffdf8;
    font-family: var(--font-hand);
    font-size: 1.05rem;
    letter-spacing: 0.04em;
    cursor: pointer;
  }

  .install-done:hover {
    filter: brightness(1.08);
  }

  .install-done:active {
    transform: translateY(1px);
  }
</style>
