import { createClient } from "@supabase/supabase-js";

const SESSION_KEY = "rhythm-supabase-session-v1";
const elements = {
  accountEmail: document.querySelector("#accountEmail"),
  approvalPanel: document.querySelector("#approvalPanel"),
  approveButton: document.querySelector("#approveButton"),
  clientLogoFallback: document.querySelector("#clientLogoFallback"),
  clientName: document.querySelector("#clientName"),
  consentStatus: document.querySelector("#consentStatus"),
  denyButton: document.querySelector("#denyButton"),
  loginEmail: document.querySelector("#loginEmail"),
  loginForm: document.querySelector("#loginForm"),
  loginPassword: document.querySelector("#loginPassword"),
};

let authorizationId = new URLSearchParams(location.search).get("authorization_id") || "";
let authDetails = null;
let supabase = null;

initialize().catch((error) => showError(error.message));

async function initialize() {
  if (!authorizationId) throw new Error("В запросе отсутствует authorization_id");
  const response = await fetch("/api/public-config", { headers: { Accept: "application/json" } });
  const config = await response.json();
  if (!response.ok || !config.supabaseUrl || !config.anonKey) {
    throw new Error("Подключение Supabase для Parsitasks ещё не настроено");
  }

  supabase = createClient(config.supabaseUrl, config.anonKey, {
    auth: { autoRefreshToken: true, detectSessionInUrl: false, persistSession: false },
  });
  const stored = readStoredSession();
  if (stored?.access_token && stored?.refresh_token) {
    const { data, error } = await supabase.auth.setSession({
      access_token: stored.access_token,
      refresh_token: stored.refresh_token,
    });
    if (!error && data.session) writeStoredSession(data.session);
  }
  await continueAuthorization();
}

async function continueAuthorization() {
  setStatus("Проверяем аккаунт…");
  const { data } = await supabase.auth.getUser();
  if (!data?.user) {
    elements.loginForm.hidden = false;
    elements.approvalPanel.hidden = true;
    setStatus("Для подтверждения доступа необходимо войти.");
    return;
  }

  elements.loginForm.hidden = true;
  setStatus("Загружаем сведения о подключении…");
  const { data: details, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (error) throw error;
  if (details?.redirect_url) {
    location.assign(details.redirect_url);
    return;
  }
  if (!details?.authorization_id) throw new Error("Запрос подключения недействителен или устарел");
  authDetails = details;
  renderApproval(details);
}

elements.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setBusy(true);
  try {
    setStatus("Входим в аккаунт…");
    const { data, error } = await supabase.auth.signInWithPassword({
      email: elements.loginEmail.value.trim(),
      password: elements.loginPassword.value,
    });
    if (error) throw error;
    if (data.session) writeStoredSession(data.session);
    elements.loginPassword.value = "";
    await continueAuthorization();
  } catch (error) {
    showError(localizeAuthError(error));
  } finally {
    setBusy(false);
  }
});

elements.approveButton.addEventListener("click", () => decide(true));
elements.denyButton.addEventListener("click", () => decide(false));

async function decide(approve) {
  if (!authDetails?.authorization_id) return;
  setBusy(true);
  try {
    setStatus(approve ? "Разрешаем доступ…" : "Отклоняем запрос…");
    const method = approve
      ? supabase.auth.oauth.approveAuthorization.bind(supabase.auth.oauth)
      : supabase.auth.oauth.denyAuthorization.bind(supabase.auth.oauth);
    const { data, error } = await method(authDetails.authorization_id, { skipBrowserRedirect: true });
    if (error) throw error;
    if (!data?.redirect_url) throw new Error("Сервис авторизации не вернул адрес продолжения");
    location.assign(data.redirect_url);
  } catch (error) {
    showError(localizeAuthError(error));
    setBusy(false);
  }
}

function renderApproval(details) {
  elements.clientName.textContent = details.client?.name || "ChatGPT";
  elements.accountEmail.textContent = details.user?.email ? `Аккаунт: ${details.user.email}` : "";
  elements.clientLogoFallback.textContent = String(details.client?.name || "AI").trim().slice(0, 2).toUpperCase();
  elements.approvalPanel.hidden = false;
  setStatus("Проверьте разрешения перед подключением.");
}

function readStoredSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function writeStoredSession(session) {
  if (!session?.access_token) return;
  const expiresAt = session.expires_at || Math.floor(Date.now() / 1000) + Number(session.expires_in || 3600);
  localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, expires_at: expiresAt }));
}

function setBusy(busy) {
  elements.approveButton.disabled = busy;
  elements.denyButton.disabled = busy;
  [...elements.loginForm.elements].forEach((element) => {
    element.disabled = busy;
  });
}

function setStatus(message) {
  elements.consentStatus.textContent = message;
  elements.consentStatus.classList.remove("is-error");
}

function showError(message) {
  elements.consentStatus.textContent = message || "Не удалось обработать подключение";
  elements.consentStatus.classList.add("is-error");
}

function localizeAuthError(error) {
  const message = String(error?.message || "");
  if (/invalid login credentials/i.test(message)) return "Неверный email или пароль";
  if (/email not confirmed/i.test(message)) return "Сначала подтвердите email";
  return message || "Не удалось войти в Parsitasks";
}
