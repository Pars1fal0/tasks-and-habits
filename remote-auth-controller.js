(function (global) {
  function createRemoteAuthController(ctx) {
    let busy = false;

    ctx.els.remoteAuthSignInButton?.addEventListener("click", () => authenticate("signIn"));
    ctx.els.remoteAuthSignUpButton?.addEventListener("click", () => authenticate("signUp"));
    ctx.els.remoteAuthSignOutButton?.addEventListener("click", signOut);
    ctx.els.remoteAuthResetButton?.addEventListener("click", resetPassword);

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

    async function resetPassword() {
      const email = ctx.els.remoteAuthEmail?.value.trim();
      if (!email) {
        ctx.showToast("Укажи email для восстановления пароля");
        ctx.els.remoteAuthEmail?.focus();
        return;
      }
      busy = true;
      render();
      try {
        await ctx.auth.resetPassword(email);
        ctx.showToast("Письмо для восстановления пароля отправлено");
      } catch (error) {
        ctx.showToast(error.message || "Не удалось отправить письмо");
      } finally {
        busy = false;
        render();
      }
    }

    function render() {
      const session = ctx.auth.getSession();
      const email = session?.user?.email || "";
      const projectConfigured = ctx.isProjectConfigured?.() !== false;
      if (ctx.els.remoteAuthStatus) {
        ctx.els.remoteAuthStatus.textContent = busy
          ? "Подключение..."
          : email
            ? `Выполнен вход: ${email}`
            : projectConfigured
              ? "Вход не выполнен. Данные остаются только на этом устройстве."
              : "Сначала заполни параметры проекта Supabase.";
      }
      [ctx.els.remoteAuthEmail, ctx.els.remoteAuthPassword, ctx.els.remoteAuthSignInButton, ctx.els.remoteAuthSignUpButton]
        .filter(Boolean)
        .forEach((element) => { element.disabled = busy || Boolean(session) || !projectConfigured; });
      if (ctx.els.remoteAuthResetButton) ctx.els.remoteAuthResetButton.disabled = busy || Boolean(session) || !projectConfigured;
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
