import { z } from "zod";

export function registerParsitasksPrompts(server) {
  server.registerPrompt(
    "plan_week",
    {
      title: "Спланировать неделю",
      description: "Разобрать текущие задачи и подготовить безопасный недельный план.",
      argsSchema: {
        focus: z.string().max(300).optional(),
      },
    },
    async ({ focus }) => promptResult([
      "Получи календарь на ближайшие семь дней и backlog.",
      "Учитывай приоритеты, временные конфликты и уже занятые блоки.",
      focus ? `Особый фокус пользователя: ${focus}.` : "",
      "Сначала вызови preview_task_plan и покажи понятный список изменений.",
      "Не вызывай apply_task_plan, пока пользователь явно не подтвердит этот список.",
    ]),
  );

  server.registerPrompt(
    "review_backlog",
    {
      title: "Разобрать накопившиеся задачи",
      description: "Сгруппировать backlog и предложить, что перенести, выполнить или признать просмотренным.",
      argsSchema: {
        days: z.string().optional(),
      },
    },
    async ({ days }) => promptResult([
      `Получи backlog${days ? ` за ${days} дней` : ""} и категории.`,
      "Сгруппируй задачи по важности и контексту.",
      "Не удаляй задачи и не скрывай просрочки без отдельного подтверждения пользователя.",
      "Для переносов используй preview_task_plan перед применением.",
    ]),
  );

  server.registerPrompt(
    "monthly_review",
    {
      title: "Подвести итог месяца",
      description: "Подготовить спокойный итог месяца по задачам, привычкам и целям.",
      argsSchema: {
        from: z.string().describe("Начало периода YYYY-MM-DD"),
        to: z.string().describe("Конец периода YYYY-MM-DD"),
      },
    },
    async ({ from, to }) => promptResult([
      `Получи статистику продуктивности и календарь за период ${from}–${to}.`,
      "Отметь устойчивый прогресс, незавершённые направления и перегруженные дни.",
      "Не оценивай пользователя и не выдумывай причины.",
      "Заверши тремя конкретными, необязательными предложениями на следующий месяц.",
    ]),
  );
}

function promptResult(lines) {
  return {
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: lines.filter(Boolean).join(" "),
      },
    }],
  };
}
