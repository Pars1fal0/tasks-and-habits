import { createMcpHandler } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  completeTaskCommand,
  createTaskCommand,
  fetchKnowledge,
  getTodayOverview,
  searchKnowledge,
  toDateKey,
} from "./task-service.mjs";
import { normalizeMcpActivity, recordMcpActivity } from "./activity-service.mjs";
import { registerManagementTools } from "./management-tools.mjs";
import {
  createGoalCommand,
  deleteTaskCommand,
  getDayBrief,
  setHabitValueCommand,
  undoMcpCommand,
  updateGoalCheckpointCommand,
  updateTaskCommand,
} from "./write-service.mjs";
import { authenticateSupabaseRequest, createSupabaseStateStore } from "./supabase-state.mjs";

const OAUTH_SCOPES = ["openid", "email"];
const OAUTH_SECURITY = [{ type: "oauth2", scopes: OAUTH_SCOPES }];
const requestWindows = new Map();

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    try {
      if (request.method === "OPTIONS") return corsResponse();
      if (isProtectedResourceMetadataPath(url.pathname)) {
        return jsonResponse(protectedResourceMetadata(url, env));
      }
      if (url.pathname === "/api/public-config") return publicConfigResponse(env);
      if (url.pathname === "/oauth/consent") return consentPage(request, env);
      if (url.pathname === "/mcp/health") {
        return jsonResponse({ ok: true, service: "Parsitasks MCP", authConfigured: hasSupabaseConfig(env) });
      }
      if (url.pathname === "/mcp") return handleMcp(request, env, ctx);
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error("MCP worker error", error);
      return jsonResponse(
        { error: "internal_error", message: "Внутренняя ошибка Parsitasks MCP" },
        { status: 500 },
      );
    }
  },
};

async function handleMcp(request, env, ctx) {
  if (!hasSupabaseConfig(env)) {
    return jsonResponse(
      { error: "server_not_configured", message: "Для Worker не заданы SUPABASE_URL и SUPABASE_ANON_KEY" },
      { status: 503 },
    );
  }

  const auth = await authenticateSupabaseRequest(request, {
    supabaseUrl: env.SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY,
  });
  if (!auth) return unauthorizedResponse(request);
  if (request.method === "POST" && !allowMcpRequest(auth.user.id)) {
    return jsonResponse(
      { error: "rate_limited", message: "Слишком много команд. Повтори через минуту." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const store = createSupabaseStateStore({
    supabaseUrl: env.SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY,
    accessToken: auth.accessToken,
    userId: auth.user.id,
  });
  const baseUrl = String(env.APP_BASE_URL || new URL(request.url).origin).replace(/\/+$/, "");
  const timeZone = String(env.APP_TIME_ZONE || "Europe/Moscow");
  const server = createParsitasksServer({ baseUrl, store, timeZone });
  const handler = createMcpHandler(server, {
    route: "/mcp",
    authContext: { props: { email: auth.user.email || "", userId: auth.user.id } },
  });
  return handler(request, env, ctx);
}

export function createParsitasksServer(context) {
  const server = new McpServer(
    { name: "parsitasks", version: "0.3.0" },
    {
      instructions: [
        "Parsitasks stores the user's tasks, habits, goals, and calendar.",
        "Read current data before proposing broad changes.",
        "Never invent task IDs. Use IDs returned by tools.",
        "Do not claim a write succeeded unless the write tool returned success.",
        "For recurring tasks always ask which scope to use: occurrence, following, or series.",
        "Never set confirm=true for deletion until the user explicitly confirms the exact scope.",
        "Habit edits are dated. Preserve history by using fromDate instead of rewriting past days.",
        "Use calendar and backlog tools before suggesting broad rescheduling.",
        "Use a unique requestId for every intended write and reuse it only for retries.",
      ].join(" "),
    },
  );

  server.registerTool(
    "get_today_overview",
    {
      title: "Получить обзор дня",
      description: "Возвращает задачи, привычки и активные цели пользователя на выбранную дату.",
      inputSchema: {
        date: z.string().optional().describe("Дата YYYY-MM-DD. Если не указана, используется сегодняшний день."),
      },
      outputSchema: {
        date: z.string(),
        tasks: z.array(z.record(z.string(), z.unknown())),
        habits: z.array(z.record(z.string(), z.unknown())),
        activeGoals: z.array(z.record(z.string(), z.unknown())),
        summary: z.record(z.string(), z.number()),
      },
      securitySchemes: OAUTH_SECURITY,
      annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
    },
    async ({ date }) => safeTool(async () => {
      const dateKey = date || toDateKey(new Date(), context.timeZone);
      const snapshot = await context.store.read();
      const result = getTodayOverview(snapshot.state, dateKey);
      return toolResult(result, `Обзор Parsitasks за ${dateKey} загружен`);
    }),
  );

  server.registerTool(
    "search",
    {
      title: "Поиск в Parsitasks",
      description: "Ищет задачи, привычки и цели пользователя по тексту.",
      inputSchema: {
        query: z.string().max(200).describe("Поисковая строка"),
        limit: z.number().int().min(1).max(50).optional(),
      },
      outputSchema: {
        results: z.array(z.object({
          id: z.string(),
          title: z.string(),
          url: z.string(),
          type: z.string(),
        })),
      },
      securitySchemes: OAUTH_SECURITY,
      annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
    },
    async ({ query, limit }) => safeTool(async () => {
      const snapshot = await context.store.read();
      const result = searchKnowledge(snapshot.state, query, { baseUrl: context.baseUrl, limit });
      return toolResult(result, JSON.stringify(result));
    }),
  );

  server.registerTool(
    "fetch",
    {
      title: "Получить объект Parsitasks",
      description: "Возвращает подробности задачи, привычки или цели по ID из результата поиска.",
      inputSchema: { id: z.string().describe("ID вида task:..., habit:... или goal:...") },
      outputSchema: {
        id: z.string(),
        title: z.string(),
        text: z.string(),
        url: z.string(),
        metadata: z.record(z.string(), z.string()),
      },
      securitySchemes: OAUTH_SECURITY,
      annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
    },
    async ({ id }) => safeTool(async () => {
      const snapshot = await context.store.read();
      const result = fetchKnowledge(snapshot.state, id, { baseUrl: context.baseUrl });
      if (!result) throw new Error("Объект Parsitasks не найден");
      return toolResult(result, result.text);
    }),
  );

  server.registerTool(
    "create_task",
    {
      title: "Создать задачу",
      description: "Создаёт одну задачу Parsitasks. Повторный вызов с тем же requestId не создаст дубль.",
      inputSchema: {
        requestId: z.string().min(8).max(100).describe("Сгенерируй уникальный UUID и повторно используй его при retry."),
        title: z.string().min(1).max(200),
        date: z.string().optional().describe("Дата YYYY-MM-DD"),
        time: z.string().optional().describe("Дедлайн HH:mm"),
        startTime: z.string().optional().describe("Начало временного блока HH:mm, шаг 15 минут"),
        endTime: z.string().optional().describe("Конец временного блока HH:mm, шаг 15 минут"),
        category: z.string().max(60).optional(),
        priority: z.enum(["low", "medium", "high"]).optional(),
        repeat: z.enum(["none", "daily", "every2days", "every3days", "weekdays", "weekends", "weekly", "monthly", "yearly"]).optional(),
        repeatUntil: z.string().optional().describe("Последняя дата повтора YYYY-MM-DD"),
        reminderOffset: z.enum(["none", "0", "5", "15", "30", "60", "1440"]).optional(),
      },
      outputSchema: {
        created: z.boolean(),
        saved: z.boolean(),
        task: z.record(z.string(), z.unknown()),
      },
      securitySchemes: OAUTH_SECURITY,
      annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
    },
    async (input) => safeTool(async () => {
      const today = toDateKey(new Date(), context.timeZone);
      const result = await context.store.mutate((state) => {
        const mutation = createTaskCommand(state, input, { today });
        if (!mutation.changed) return mutation;
        const summary = `Задача «${mutation.task.title}» создана на ${mutation.task.date}`;
        const activity = recordMcpActivity(state, mutation.state, {
          requestId: input.requestId,
          type: "create_task",
          title: "Создание задачи",
          summary,
        });
        return { ...mutation, activity };
      });
      const payload = { created: result.created, saved: result.saved, task: result.task };
      const summary = result.created
        ? `Задача «${result.task.title}» создана на ${result.task.date}`
        : `Задача «${result.task.title}» уже была создана этим запросом`;
      return toolResult(payload, summary);
    }),
  );

  server.registerTool(
    "complete_task",
    {
      title: "Изменить выполнение задачи",
      description: "Отмечает конкретное выполнение задачи завершённым или возвращает его в работу.",
      inputSchema: {
        requestId: z.string().min(8).max(100),
        taskId: z.string().describe("ID задачи. Можно передать task:ID из поиска."),
        date: z.string().optional().describe("Дата выполнения YYYY-MM-DD"),
        completed: z.boolean().optional().describe("true — выполнить, false — вернуть в работу"),
      },
      outputSchema: {
        completed: z.boolean(),
        date: z.string(),
        saved: z.boolean(),
        taskId: z.string(),
        title: z.string(),
      },
      securitySchemes: OAUTH_SECURITY,
      annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
    },
    async (input) => safeTool(async () => {
      const today = toDateKey(new Date(), context.timeZone);
      const taskId = String(input.taskId || "").replace(/^task:/, "");
      const result = await context.store.mutate((state) => {
        const previousActivity = (state.mcpActivity || [])
          .find((activity) => activity?.requestId === input.requestId);
        if (previousActivity) {
          const task = (state.tasks || []).find((item) => item.id === taskId)
            || { id: taskId, title: "Task" };
          return {
            changed: false,
            state,
            task,
            date: input.date || today,
            completed: input.completed !== false,
            activity: previousActivity,
          };
        }
        const mutation = completeTaskCommand(state, { ...input, taskId }, { today });
        if (!mutation.changed) return mutation;
        const summary = mutation.completed
          ? `Задача «${mutation.task.title}» выполнена за ${mutation.date}`
          : `Задача «${mutation.task.title}» возвращена в работу за ${mutation.date}`;
        const activity = recordMcpActivity(state, mutation.state, {
          requestId: input.requestId,
          type: "complete_task",
          title: "Статус задачи",
          summary,
        });
        return { ...mutation, activity };
      });
      const payload = {
        completed: result.completed,
        date: result.date,
        saved: result.saved,
        taskId: result.task.id,
        title: result.task.title,
      };
      return toolResult(
        payload,
        result.completed
          ? `Задача «${result.task.title}» отмечена выполненной`
          : `Задача «${result.task.title}» возвращена в работу`,
      );
    }),
  );

  registerExtendedTools(server, context);
  registerManagementTools(server, context, {
    readTool,
    security: OAUTH_SECURITY,
    writeTool,
  });
  return server;
}

function registerExtendedTools(server, context) {
  server.registerTool(
    "update_task",
    {
      title: "Изменить задачу",
      description: "Меняет задачу, переносит её или обновляет расписание. Для повторяющейся задачи scope обязателен.",
      inputSchema: {
        requestId: z.string().min(8).max(100),
        taskId: z.string(),
        occurrenceDate: z.string().optional().describe("Дата конкретного повторения YYYY-MM-DD"),
        scope: z.enum(["occurrence", "following", "series"]).optional(),
        title: z.string().min(1).max(200).optional(),
        date: z.string().optional(),
        category: z.string().max(60).optional(),
        priority: z.enum(["low", "medium", "high"]).optional(),
        scheduleMode: z.enum(["none", "deadline", "block"]).optional(),
        time: z.string().optional(),
        startTime: z.string().optional(),
        endTime: z.string().optional(),
        reminderOffset: z.enum(["none", "0", "5", "15", "30", "60", "1440"]).optional(),
        repeat: z.enum(["none", "daily", "every2days", "every3days", "weekdays", "weekends", "weekly", "monthly", "yearly"]).optional(),
        repeatUntil: z.string().optional(),
      },
      outputSchema: {
        saved: z.boolean(),
        scope: z.string(),
        task: z.record(z.string(), z.unknown()),
        actionId: z.string(),
      },
      securitySchemes: OAUTH_SECURITY,
      annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
    },
    async (input) => writeTool(context, (state) =>
      updateTaskCommand(state, input, { requestId: input.requestId })),
  );

  server.registerTool(
    "delete_task",
    {
      title: "Удалить задачу",
      description: "Удаляет задачу только после явного подтверждения. Для повторов поддерживает один день, последующие или всю серию.",
      inputSchema: {
        requestId: z.string().min(8).max(100),
        taskId: z.string(),
        occurrenceDate: z.string().optional(),
        scope: z.enum(["occurrence", "following", "series"]).optional(),
        confirm: z.boolean().describe("Передай true только после явного подтверждения пользователя"),
      },
      outputSchema: {
        saved: z.boolean(),
        scope: z.string(),
        taskId: z.string(),
        actionId: z.string(),
      },
      securitySchemes: OAUTH_SECURITY,
      annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: true },
    },
    async (input) => writeTool(context, (state) => deleteTaskCommand(state, input)),
  );

  server.registerTool(
    "set_habit_value",
    {
      title: "Отметить привычку",
      description: "Отмечает чек-привычку или устанавливает числовое значение за выбранный день.",
      inputSchema: {
        requestId: z.string().min(8).max(100),
        habitId: z.string(),
        date: z.string().optional(),
        completed: z.boolean().optional(),
        value: z.number().min(0).optional(),
      },
      outputSchema: {
        saved: z.boolean(),
        date: z.string(),
        habit: z.record(z.string(), z.unknown()),
        actionId: z.string(),
      },
      securitySchemes: OAUTH_SECURITY,
      annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
    },
    async (input) => {
      const today = toDateKey(new Date(), context.timeZone);
      return writeTool(context, (state) => setHabitValueCommand(state, input, { today }));
    },
  );

  server.registerTool(
    "create_goal",
    {
      title: "Создать цель",
      description: "Создаёт цель с датой и собственными чекпоинтами.",
      inputSchema: {
        requestId: z.string().min(8).max(100),
        title: z.string().min(1).max(200),
        dueDate: z.string().optional(),
        why: z.string().max(500).optional(),
        checkpoints: z.array(z.string().min(1).max(200)).max(50).optional(),
      },
      outputSchema: {
        created: z.boolean(),
        saved: z.boolean(),
        goal: z.record(z.string(), z.unknown()),
        actionId: z.string().optional(),
      },
      securitySchemes: OAUTH_SECURITY,
      annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
    },
    async (input) => writeTool(context, (state) => createGoalCommand(state, input)),
  );

  server.registerTool(
    "update_goal_checkpoint",
    {
      title: "Изменить чекпоинт цели",
      description: "Добавляет, переименовывает, завершает или удаляет чекпоинт цели.",
      inputSchema: {
        requestId: z.string().min(8).max(100),
        goalId: z.string(),
        action: z.enum(["add", "rename", "complete", "delete"]),
        checkpointId: z.string().optional(),
        title: z.string().max(200).optional(),
        completed: z.boolean().optional(),
        confirm: z.boolean().optional(),
      },
      outputSchema: {
        saved: z.boolean(),
        goal: z.record(z.string(), z.unknown()),
        actionId: z.string(),
      },
      securitySchemes: OAUTH_SECURITY,
      annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: true },
    },
    async (input) => writeTool(context, (state) => updateGoalCheckpointCommand(state, input)),
  );

  server.registerTool(
    "get_day_brief",
    {
      title: "План или итог дня",
      description: "Возвращает данные для утреннего плана или вечернего итога, включая конфликты таймлайна.",
      inputSchema: {
        date: z.string().optional(),
        mode: z.enum(["plan", "review"]).optional(),
      },
      outputSchema: {
        date: z.string(),
        mode: z.string(),
        tasks: z.array(z.record(z.string(), z.unknown())),
        habits: z.array(z.record(z.string(), z.unknown())),
        conflicts: z.array(z.array(z.string())),
        summary: z.record(z.string(), z.number()),
      },
      securitySchemes: OAUTH_SECURITY,
      annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
    },
    async ({ date, mode }) => safeTool(async () => {
      const dateKey = date || toDateKey(new Date(), context.timeZone);
      const snapshot = await context.store.read();
      const result = getDayBrief(snapshot.state, dateKey, mode || "plan");
      return toolResult(result, `${mode === "review" ? "Итог" : "План"} на ${dateKey} подготовлен`);
    }),
  );

  server.registerTool(
    "list_mcp_activity",
    {
      title: "Журнал действий ChatGPT",
      description: "Показывает последние изменения, выполненные через MCP.",
      inputSchema: { limit: z.number().int().min(1).max(100).optional() },
      outputSchema: { actions: z.array(z.record(z.string(), z.unknown())) },
      securitySchemes: OAUTH_SECURITY,
      annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
    },
    async ({ limit }) => safeTool(async () => {
      const snapshot = await context.store.read();
      const actions = normalizeMcpActivity(snapshot.state.mcpActivity)
        .slice(0, limit || 20)
        .map(({ inverse, ...action }) => action);
      return toolResult({ actions }, JSON.stringify(actions));
    }),
  );

  server.registerTool(
    "undo_mcp_action",
    {
      title: "Отменить действие ChatGPT",
      description: "Отменяет ранее выполненное MCP-действие по actionId из журнала.",
      inputSchema: { actionId: z.string() },
      outputSchema: {
        saved: z.boolean(),
        action: z.record(z.string(), z.unknown()),
      },
      securitySchemes: OAUTH_SECURITY,
      annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
    },
    async (input) => safeTool(async () => {
      const result = await context.store.mutate((state) => undoMcpCommand(state, input));
      const { inverse, ...action } = result.activity;
      return toolResult({ saved: result.saved, action }, `Действие «${action.summary}» отменено`);
    }),
  );
}

async function writeTool(context, mutator) {
  return safeTool(async () => {
    const result = await context.store.mutate(mutator);
    const payload = {
      ...result,
      state: undefined,
      activity: undefined,
      saved: result.saved,
      actionId: result.activity?.id,
    };
    return toolResult(payload, result.summary || "Изменение сохранено в Parsitasks");
  });
}

async function readTool(context, selector) {
  return safeTool(async () => {
    const snapshot = await context.store.read();
    const result = selector(snapshot.state);
    return toolResult(result, JSON.stringify(result));
  });
}

function allowMcpRequest(userId) {
  const now = Date.now();
  const current = requestWindows.get(userId);
  if (!current || now - current.startedAt >= 60_000) {
    requestWindows.set(userId, { count: 1, startedAt: now });
    return true;
  }
  current.count += 1;
  if (requestWindows.size > 1000) {
    for (const [id, window] of requestWindows) {
      if (now - window.startedAt >= 60_000) requestWindows.delete(id);
    }
  }
  return current.count <= 120;
}

async function safeTool(operation) {
  try {
    return await operation();
  } catch (error) {
    return {
      isError: true,
      content: [{ type: "text", text: error?.message || "Не удалось выполнить действие Parsitasks" }],
    };
  }
}

function toolResult(structuredContent, text) {
  return {
    structuredContent,
    content: [{ type: "text", text: String(text || JSON.stringify(structuredContent)) }],
  };
}

function protectedResourceMetadata(url, env) {
  const origin = String(env.APP_BASE_URL || url.origin).replace(/\/+$/, "");
  return {
    resource: `${origin}/mcp`,
    authorization_servers: [`${String(env.SUPABASE_URL || "").replace(/\/+$/, "")}/auth/v1`],
    scopes_supported: OAUTH_SCOPES,
    resource_documentation: `${origin}/mcp/health`,
  };
}

function unauthorizedResponse(request) {
  const url = new URL(request.url);
  const metadataUrl = `${url.origin}/.well-known/oauth-protected-resource`;
  const challenge = `Bearer resource_metadata="${metadataUrl}", scope="${OAUTH_SCOPES.join(" ")}", error="invalid_token", error_description="Sign in to Parsitasks"`;
  return jsonResponse(
    { error: "unauthorized", message: "Требуется вход в Parsitasks" },
    {
      status: 401,
      headers: { "WWW-Authenticate": challenge },
    },
  );
}

function publicConfigResponse(env) {
  if (!hasSupabaseConfig(env)) {
    return jsonResponse({ error: "not_configured" }, { status: 503 });
  }
  return jsonResponse({
    supabaseUrl: String(env.SUPABASE_URL),
    anonKey: String(env.SUPABASE_ANON_KEY),
  }, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}

function consentPage(request, env) {
  const assetUrl = new URL("/oauth-consent.html", request.url);
  return env.ASSETS.fetch(new Request(assetUrl, request));
}

function isProtectedResourceMetadataPath(pathname) {
  return pathname === "/.well-known/oauth-protected-resource"
    || pathname === "/.well-known/oauth-protected-resource/mcp";
}

function hasSupabaseConfig(env) {
  return Boolean(String(env.SUPABASE_URL || "").trim() && String(env.SUPABASE_ANON_KEY || "").trim());
}

function corsResponse() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Headers": "authorization, content-type, mcp-protocol-version",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function jsonResponse(value, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", headers.get("Cache-Control") || "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(JSON.stringify(value), { ...options, headers });
}
