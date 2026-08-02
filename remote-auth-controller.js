(function (global) {
  function createRemoteAuthController(ctx) {
    let busy = false;

    ctx.els.remoteAuthSignInButton?.addEventListener("click", () => authenticate("signIn"));
    ctx.els.remoteAuthSignUpButton?.addEventListener("click", () => authenticate("signUp"));
    ctx.els.remoteAuthSignOutButton?.addEventListener("click", signOut);
    ctx.els.remoteAuthResetButton?.addEventListener("click", resetPassword);
    ctx.els.remoteAuthUpdatePasswordButton?.addEventListener("click", updatePassword);

    async function authenticate(method) {
      if (busy) return;
      const email = ctx.els.remoteAuthEmail?.value.trim();
      const password = ctx.els.remoteAuthPassword?.value || "";
      const minimumLength = method === "signUp" ? 8 : 6;
      if (!email || password.length < minimumLength) {
        ctx.showToast(`Укажи email и пароль не короче ${minimumLength} символов`);
        return;
      }
      busy = true;
      render();
      try {
        const result = await ctx.auth[method](email, password);
        ctx.els.remoteAuthPassword.value = "";
        if (result.access_token) {
          ctx.showToast(method === "signUp" ? "Аккаунт создан" : "Вход выполнен");
          if (ctx.onAuthenticated) await ctx.onAuthenticated();
          else await ctx.syncLatest?.({ silent: true });
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

    async function updatePassword() {
      if (busy) return;
      const password = ctx.els.remoteAuthPassword?.value || "";
      if (password.length < 8) {
        ctx.showToast("Новый пароль должен содержать не меньше 8 символов");
        ctx.els.remoteAuthPassword?.focus();
        return;
      }
      busy = true;
      render();
      try {
        await ctx.auth.updatePassword(password);
        ctx.els.remoteAuthPassword.value = "";
        ctx.showToast("Пароль обновлён");
      } catch (error) {
        ctx.showToast(error.message || "Не удалось обновить пароль");
      } finally {
        busy = false;
        render();
        ctx.renderSyncStatus?.();
      }
    }

    function render() {
      const session = ctx.auth.getSession();
      const recoveryMode = ctx.auth.isRecoveryMode?.() === true;
      const email = session?.user?.email || "";
      const projectConfigured = ctx.isProjectConfigured?.() !== false;
      if (ctx.els.remoteAuthStatus) {
        ctx.els.remoteAuthStatus.textContent = busy
          ? "Подключение..."
          : recoveryMode
            ? "Введите новый пароль и сохраните его"
          : email
            ? `Выполнен вход: ${email}`
            : projectConfigured
              ? "Вход не выполнен. Данные остаются только на этом устройстве."
              : "Сначала заполни параметры проекта Supabase.";
      }
      [ctx.els.remoteAuthEmail, ctx.els.remoteAuthSignInButton, ctx.els.remoteAuthSignUpButton]
        .filter(Boolean)
        .forEach((element) => {
          element.disabled = busy || Boolean(session) || recoveryMode || !projectConfigured;
          element.hidden = recoveryMode;
        });
      if (ctx.els.remoteAuthPassword) {
        ctx.els.remoteAuthPassword.disabled = busy || (Boolean(session) && !recoveryMode) || !projectConfigured;
        ctx.els.remoteAuthPassword.autocomplete = recoveryMode ? "new-password" : "current-password";
        ctx.els.remoteAuthPassword.placeholder = recoveryMode ? "Новый пароль" : "Пароль";
      }
      if (ctx.els.remoteAuthResetButton) {
        ctx.els.remoteAuthResetButton.disabled = busy || Boolean(session) || recoveryMode || !projectConfigured;
        ctx.els.remoteAuthResetButton.hidden = recoveryMode;
      }
      if (ctx.els.remoteAuthUpdatePasswordButton) {
        ctx.els.remoteAuthUpdatePasswordButton.hidden = !recoveryMode;
        ctx.els.remoteAuthUpdatePasswordButton.disabled = busy || !projectConfigured;
      }
      if (ctx.els.remoteAuthSignOutButton) {
        ctx.els.remoteAuthSignOutButton.hidden = !session || recoveryMode;
        ctx.els.remoteAuthSignOutButton.disabled = busy;
      }
      ctx.syncCloudControls?.();
    }

    render();
    return { render };
  }

  const api = { createRemoteAuthController };
  global.RhythmRemoteAuthController = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
