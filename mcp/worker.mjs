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
import { authenticateSupabaseRequest, createSupabaseStateStore } from "./supabase-state.mjs";

const OAUTH_SCOPES = ["openid", "email"];
const OAUTH_SECURITY = [{ type: "oauth2", scopes: OAUTH_SCOPES }];

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
    { name: "parsitasks", version: "0.1.0" },
    {
      instructions: [
        "Parsitasks stores the user's tasks, habits, goals, and calendar.",
        "Read current data before proposing broad changes.",
        "Never invent task IDs. Use IDs returned by tools.",
        "Do not claim a write succeeded unless the write tool returned success.",
        "Deletion is intentionally unavailable.",
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
      const result = await context.store.mutate((state) => createTaskCommand(state, input, { today }));
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
      const result = await context.store.mutate((state) =>
        completeTaskCommand(state, { ...input, taskId }, { today }));
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

  return server;
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
