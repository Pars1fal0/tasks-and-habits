(function () {
  function createToastController({ element, restoreUndoSnapshot, defaultTimeout = 2600, undoTimeout = 10000 }) {
    let toastTimer = null;
    let undoTimer = null;

    function showToast(message, options = {}) {
      element.replaceChildren();
      const text = document.createElement("span");
      text.textContent = message;
      element.appendChild(text);

      if (options.undo) {
        const undoButton = document.createElement("button");
        undoButton.type = "button";
        undoButton.textContent = "Отменить";
        undoButton.addEventListener("click", () => {
          clearTimeout(toastTimer);
          clearTimeout(undoTimer);
          restoreUndoSnapshot(options.undo);
        });
        element.appendChild(undoButton);
      }

      element.classList.add("is-visible");
      element.classList.toggle("has-action", Boolean(options.undo));
      clearTimeout(toastTimer);
      clearTimeout(undoTimer);
      const timeout = options.undo ? undoTimeout : defaultTimeout;
      toastTimer = setTimeout(() => {
        element.classList.remove("is-visible");
        element.classList.remove("has-action");
      }, timeout);
      undoTimer = setTimeout(() => {}, timeout);
    }

    return { showToast };
  }

  window.RhythmToast = { createToastController };
})();
