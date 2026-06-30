(function (global) {
  function createConfirmDialog(ctx) {
    let resolver = null;

    function confirmAction({
      cancelLabel = "Отмена",
      confirmLabel = "Подтвердить",
      message = "",
      tone = "default",
      title = "Подтвердить действие?",
    } = {}) {
      if (!ctx.els.confirmModal) return Promise.resolve(window.confirm(message || title));

      close(false, { silent: true });
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
        if (event.key === "Escape" && !ctx.els.confirmModal?.hidden) close(false);
      });
    }

    function close(value, { silent = false } = {}) {
      if (ctx.els.confirmModal) ctx.els.confirmModal.hidden = true;
      if (!silent && resolver) {
        const resolve = resolver;
        resolver = null;
        resolve(value);
      }
    }

    return {
      bindEvents,
      confirm: confirmAction,
    };
  }

  global.RhythmConfirmDialog = { createConfirmDialog };
})(window);
