(function (global) {
  function createConfirmDialog(ctx) {
    let resolver = null;
    let previouslyFocused = null;

    function confirmAction({
      cancelLabel = "Отмена",
      confirmLabel = "Подтвердить",
      message = "",
      tone = "default",
      title = "Подтвердить действие?",
    } = {}) {
      if (!ctx.els.confirmModal) return Promise.resolve(false);

      close(false, { silent: true });
      previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      ctx.els.confirmTitle.textContent = title;
      ctx.els.confirmMessage.textContent = message;
      ctx.els.confirmCancel.textContent = cancelLabel;
      ctx.els.confirmAccept.textContent = confirmLabel;
      ctx.els.confirmAccept.dataset.tone = tone;
      ctx.els.confirmModal.hidden = false;
      ctx.els.confirmAccept.focus();

      return new Promise((resolve) => {
        resolver = resolve;
      });
    }

    function bindEvents() {
      ctx.els.confirmAccept?.addEventListener("click", () => close(true));
      ctx.els.confirmCancel?.addEventListener("click", () => close(false));
      ctx.els.confirmModal?.querySelector("[data-confirm-cancel]")?.addEventListener("click", () => close(false));
      document.addEventListener("keydown", (event) => {
        if (ctx.els.confirmModal?.hidden) return;
        if (event.key === "Escape") {
          event.preventDefault();
          close(false);
          return;
        }
        if (event.key === "Tab") trapFocus(event);
      });
    }

    function close(value, { silent = false } = {}) {
      if (ctx.els.confirmModal) ctx.els.confirmModal.hidden = true;
      const focusTarget = previouslyFocused;
      previouslyFocused = null;
      if (!silent && focusTarget?.isConnected) focusTarget.focus();
      if (!silent && resolver) {
        const resolve = resolver;
        resolver = null;
        resolve(value);
      }
    }

    function trapFocus(event) {
      const focusable = getFocusableElements();
      if (!focusable.length) {
        event.preventDefault();
        ctx.els.confirmAccept?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function getFocusableElements() {
      return [...ctx.els.confirmModal.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")].filter(
        (element) => !element.disabled && element.offsetParent !== null,
      );
    }

    return {
      bindEvents,
      confirm: confirmAction,
    };
  }

  global.RhythmConfirmDialog = { createConfirmDialog };
})(window);
