(function (global) {
  function createRemoteAuthController(ctx) {
    let busy = false;

    ctx.els.remoteAuthSignInButton?.addEventListener("click", () => authenticate("signIn"));
    ctx.els.remoteAuthSignUpButton?.addEventListener("click", () => authenticate("signUp"));
    ctx.els.remoteAuthSignOutButton?.addEventListener("click", signOut);

    async function authenticate(method) {
      if (busy) return;
      const email = ctx.els.remoteAuthEmail?.value.trim();
      const password = ctx.els.remoteAuthPassword?.value || "";
      if (!email || password.length < 6) {
        ctx.showToast("Укажи email и пароль не короче 6 символов");
        return;
      }
      busy = true;
      render();
      try {
        const result = await ctx.auth[method](email, password);
        ctx.els.remoteAuthPassword.value = "";
        if (result.access_token) {
          ctx.showToast(method === "signUp" ? "Аккаунт создан" : "Вход выполнен");
          await ctx.syncLatest?.({ silent: true });
        } else {
          ctx.showToast("Проверь почту и подтверди регистрацию");
        }
      } catch (error) {
        ctx.showToast(error.message || "Не удалось войти");
      } finally {
        busy = false;
        render();
        ctx.renderSyncStatus?.();
      }
    }

    async function signOut() {
      if (busy) return;
      busy = true;
      render();
      await ctx.auth.signOut();
      busy = false;
      render();
      ctx.renderSyncStatus?.();
      ctx.showToast("Вы вышли из аккаунта синхронизации");
    }

    function render() {
      const session = ctx.auth.getSession();
      const email = session?.user?.email || "";
      if (ctx.els.remoteAuthStatus) {
        ctx.els.remoteAuthStatus.textContent = busy
          ? "Подключение..."
          : email
            ? `Выполнен вход: ${email}`
            : "Вход не выполнен. Данные остаются только на этом устройстве.";
      }
      [ctx.els.remoteAuthEmail, ctx.els.remoteAuthPassword, ctx.els.remoteAuthSignInButton, ctx.els.remoteAuthSignUpButton]
        .filter(Boolean)
        .forEach((element) => { element.disabled = busy || Boolean(session); });
      if (ctx.els.remoteAuthSignOutButton) {
        ctx.els.remoteAuthSignOutButton.hidden = !session;
        ctx.els.remoteAuthSignOutButton.disabled = busy;
      }
    }

    render();
    return { render };
  }

  const api = { createRemoteAuthController };
  global.RhythmRemoteAuthController = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
