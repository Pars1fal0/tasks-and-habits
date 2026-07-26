import { z } from "zod";
import {
  applyNutritionPlanCommand,
  clearNutritionPeriodCommand,
  createMealCommand,
  deleteFoodCommand,
  deleteMealCommand,
  deleteTemplateCommand,
  getNutritionDay,
  getNutritionWeek,
  getShoppingList,
  previewNutritionPlan,
  setMealStatusCommand,
  setPlanPausedCommand,
  setTargetsCommand,
  updateMealCommand,
  upsertFoodCommand,
  upsertTemplateCommand,
} from "./nutrition-service.mjs";

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const REQUEST_ID = z.string().min(8).max(100);
const NUTRITION = z.object({
  calories: z.number().min(0).max(100000).optional(),
  protein: z.number().min(0).max(10000).optional(),
  fat: z.number().min(0).max(10000).optional(),
  carbs: z.number().min(0).max(10000).optional(),
});
const INGREDIENT = z.object({
  foodId: z.string().optional(),
  name: z.string().min(1).max(120),
  quantity: z.number().min(0).max(100000),
  unit: z.string().min(1).max(20).optional(),
});
const MEAL_FIELDS = {
  date: DATE,
  type: z.enum(["breakfast", "snack", "lunch", "dinner", "other"]),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  title: z.string().min(1).max(160),
  servings: z.number().min(0.1).max(100).optional(),
  ingredients: z.array(INGREDIENT).max(80).optional(),
  nutrition: NUTRITION.optional(),
  notes: z.string().max(1000).optional(),
};
const FOOD_FIELDS = {
  name: z.string().min(1).max(120),
  unit: z.string().min(1).max(20).optional(),
  calories: z.number().min(0).max(5000).optional(),
  protein: z.number().min(0).max(1000).optional(),
  fat: z.number().min(0).max(1000).optional(),
  carbs: z.number().min(0).max(1000).optional(),
  source: z.string().max(120).optional(),
  approximate: z.boolean().optional(),
};
const READ_ANNOTATIONS = { readOnlyHint: true, openWorldHint: false, destructiveHint: false };
const WRITE_ANNOTATIONS = { readOnlyHint: false, openWorldHint: false, destructiveHint: false };

export function registerNutritionTools(server, context, helpers) {
  const common = { securitySchemes: helpers.security };

  server.registerTool("get_nutrition_week", {
    title: "План питания на неделю",
    description: "Возвращает все блюда, цели и итоговые калории/БЖУ за неделю.",
    inputSchema: {
      date: DATE.optional().describe("Любая дата нужной недели; по умолчанию сегодня."),
      firstDay: z.enum(["monday", "sunday"]).optional(),
    },
    ...common,
    annotations: READ_ANNOTATIONS,
  }, ({ date, firstDay }) => helpers.readTool(context, (state) =>
    getNutritionWeek(state, date || helpers.todayForState(state, context), firstDay || "monday")));

  server.registerTool("get_nutrition_day", {
    title: "Питание за день",
    description: "Возвращает блюда и итоговые калории/БЖУ за выбранный день.",
    inputSchema: { date: DATE.optional() },
    ...common,
    annotations: READ_ANNOTATIONS,
  }, ({ date }) => helpers.readTool(context, (state) =>
    getNutritionDay(state, date || helpers.todayForState(state, context))));

  server.registerTool("list_nutrition_foods", {
    title: "Список продуктов",
    description: "Возвращает личную базу продуктов с калориями и БЖУ на 100 единиц.",
    inputSchema: {},
    ...common,
    annotations: READ_ANNOTATIONS,
  }, () => helpers.readTool(context, (state) => ({ foods: state.nutritionFoods || [] })));

  server.registerTool("list_meal_templates", {
    title: "Шаблоны блюд",
    description: "Возвращает сохранённые шаблоны блюд.",
    inputSchema: {},
    ...common,
    annotations: READ_ANNOTATIONS,
  }, () => helpers.readTool(context, (state) => ({ templates: state.nutritionTemplates || [] })));

  server.registerTool("get_nutrition_targets", {
    title: "Цели питания",
    description: "Возвращает дневные цели калорий/БЖУ и состояние паузы.",
    inputSchema: {},
    ...common,
    annotations: READ_ANNOTATIONS,
  }, () => helpers.readTool(context, (state) => ({ settings: state.nutritionSettings || {} })));

  server.registerTool("get_shopping_list", {
    title: "Список покупок",
    description: "Собирает продукты из запланированных блюд за период и суммирует одинаковые позиции.",
    inputSchema: { from: DATE, to: DATE },
    ...common,
    annotations: READ_ANNOTATIONS,
  }, ({ from, to }) => helpers.readTool(context, (state) => getShoppingList(state, from, to)));

  server.registerTool("create_nutrition_meal", {
    title: "Добавить блюдо",
    description: "Добавляет блюдо в план питания. Если БЖУ приблизительны, укажи это пользователю.",
    inputSchema: { requestId: REQUEST_ID, ...MEAL_FIELDS },
    ...common,
    annotations: WRITE_ANNOTATIONS,
  }, (input) => helpers.writeTool(context, (state) => createMealCommand(state, input)));

  server.registerTool("update_nutrition_meal", {
    title: "Изменить блюдо",
    description: "Меняет выбранное блюдо, включая дату, состав, статус и калории/БЖУ.",
    inputSchema: {
      requestId: REQUEST_ID,
      mealId: z.string(),
      date: DATE.optional(),
      type: z.enum(["breakfast", "snack", "lunch", "dinner", "other"]).optional(),
      time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
      title: z.string().min(1).max(160).optional(),
      servings: z.number().min(0.1).max(100).optional(),
      ingredients: z.array(INGREDIENT).max(80).optional(),
      nutrition: NUTRITION.optional(),
      status: z.enum(["planned", "eaten", "skipped"]).optional(),
      notes: z.string().max(1000).optional(),
    },
    ...common,
    annotations: WRITE_ANNOTATIONS,
  }, (input) => helpers.writeTool(context, (state) => updateMealCommand(state, input)));

  server.registerTool("set_nutrition_meal_status", {
    title: "Изменить статус блюда",
    description: "Отмечает блюдо запланированным, съеденным или пропущенным.",
    inputSchema: {
      requestId: REQUEST_ID,
      mealId: z.string(),
      status: z.enum(["planned", "eaten", "skipped"]),
    },
    ...common,
    annotations: WRITE_ANNOTATIONS,
  }, (input) => helpers.writeTool(context, (state) => setMealStatusCommand(state, input)));

  server.registerTool("delete_nutrition_meal", {
    title: "Удалить блюдо",
    description: "Удаляет одно блюдо. confirm=true разрешён только после явного подтверждения пользователя.",
    inputSchema: { requestId: REQUEST_ID, mealId: z.string(), confirm: z.boolean() },
    ...common,
    annotations: { ...WRITE_ANNOTATIONS, destructiveHint: true },
  }, (input) => helpers.writeTool(context, (state) => deleteMealCommand(state, input)));

  server.registerTool("upsert_nutrition_food", {
    title: "Сохранить продукт",
    description: "Создаёт или обновляет продукт. Значения задаются на 100 единиц продукта.",
    inputSchema: { requestId: REQUEST_ID, foodId: z.string().optional(), ...FOOD_FIELDS },
    ...common,
    annotations: WRITE_ANNOTATIONS,
  }, (input) => helpers.writeTool(context, (state) => upsertFoodCommand(state, input)));

  server.registerTool("delete_nutrition_food", {
    title: "Удалить продукт",
    description: "Удаляет продукт из личной базы. Состав существующих блюд останется текстом. Требует явного подтверждения.",
    inputSchema: { requestId: REQUEST_ID, foodId: z.string(), confirm: z.boolean() },
    ...common,
    annotations: { ...WRITE_ANNOTATIONS, destructiveHint: true },
  }, (input) => helpers.writeTool(context, (state) => deleteFoodCommand(state, input)));

  server.registerTool("upsert_meal_template", {
    title: "Сохранить шаблон блюда",
    description: "Создаёт или обновляет повторно используемый шаблон блюда.",
    inputSchema: {
      requestId: REQUEST_ID,
      templateId: z.string().optional(),
      title: MEAL_FIELDS.title,
      type: MEAL_FIELDS.type,
      time: MEAL_FIELDS.time,
      servings: MEAL_FIELDS.servings,
      ingredients: MEAL_FIELDS.ingredients,
      nutrition: MEAL_FIELDS.nutrition,
      notes: MEAL_FIELDS.notes,
    },
    ...common,
    annotations: WRITE_ANNOTATIONS,
  }, (input) => helpers.writeTool(context, (state) => upsertTemplateCommand(state, input)));

  server.registerTool("delete_meal_template", {
    title: "Удалить шаблон блюда",
    description: "Удаляет сохранённый шаблон блюда после явного подтверждения пользователя.",
    inputSchema: { requestId: REQUEST_ID, templateId: z.string(), confirm: z.boolean() },
    ...common,
    annotations: { ...WRITE_ANNOTATIONS, destructiveHint: true },
  }, (input) => helpers.writeTool(context, (state) => deleteTemplateCommand(state, input)));

  server.registerTool("set_nutrition_targets", {
    title: "Задать цели питания",
    description: "Обновляет дневную цель калорий, белков, жиров и углеводов.",
    inputSchema: { requestId: REQUEST_ID, targets: NUTRITION },
    ...common,
    annotations: WRITE_ANNOTATIONS,
  }, (input) => helpers.writeTool(context, (state) => setTargetsCommand(state, input)));

  server.registerTool("set_nutrition_plan_paused", {
    title: "Приостановить план питания",
    description: "Приостанавливает или возобновляет план без удаления блюд.",
    inputSchema: { requestId: REQUEST_ID, paused: z.boolean() },
    ...common,
    annotations: WRITE_ANNOTATIONS,
  }, (input) => helpers.writeTool(context, (state) => setPlanPausedCommand(state, input)));

  const planSchema = {
    from: DATE,
    to: DATE,
    mode: z.enum(["merge", "replace"]).optional().describe("merge добавляет блюда; replace заменяет план внутри периода."),
    foods: z.array(z.object(FOOD_FIELDS)).max(200).optional(),
    meals: z.array(z.object(MEAL_FIELDS)).min(1).max(140),
    targets: NUTRITION.optional(),
  };

  server.registerTool("preview_nutrition_plan", {
    title: "Предпросмотр плана питания",
    description: "Проверяет недельный план, считает итоговые БЖУ и покупки, но ничего не сохраняет. Вызови перед apply_nutrition_plan.",
    inputSchema: planSchema,
    ...common,
    annotations: READ_ANNOTATIONS,
  }, (input) => helpers.readTool(context, (state) => previewNutritionPlan(state, input)));

  server.registerTool("apply_nutrition_plan", {
    title: "Применить план питания",
    description: "Атомарно применяет ранее показанный пользователю план. Требует previewToken из preview_nutrition_plan.",
    inputSchema: {
      requestId: REQUEST_ID,
      previewToken: z.string(),
      ...planSchema,
    },
    ...common,
    annotations: WRITE_ANNOTATIONS,
  }, (input) => helpers.writeTool(context, (state) => applyNutritionPlanCommand(state, input)));

  server.registerTool("clear_nutrition_period", {
    title: "Очистить период питания",
    description: "Удаляет все блюда внутри периода. confirm=true разрешён только после явного подтверждения пользователя.",
    inputSchema: { requestId: REQUEST_ID, from: DATE, to: DATE, confirm: z.boolean() },
    ...common,
    annotations: { ...WRITE_ANNOTATIONS, destructiveHint: true },
  }, (input) => helpers.writeTool(context, (state) => clearNutritionPeriodCommand(state, input)));
}
