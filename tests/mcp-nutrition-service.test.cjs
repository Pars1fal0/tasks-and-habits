const assert = require("node:assert/strict");

module.exports = [
  {
    name: "previews and atomically applies an idempotent weekly plan",
    async fn() {
      const service = await import("../mcp/nutrition-service.mjs");
      const base = state();
      const previewInput = planInput();
      const preview = service.previewNutritionPlan(base, previewInput);
      assert.equal(preview.meals.length, 1);
      assert.equal(preview.shoppingList[0].name, "Гречка");
      assert.equal(preview.totals.calories, 390);

      const applied = service.applyNutritionPlanCommand(base, {
        ...previewInput,
        requestId: "nutrition-plan-001",
        previewToken: preview.previewToken,
      }, { now: "2026-07-26T12:00:00.000Z" });
      assert.equal(applied.changed, true);
      assert.equal(applied.state.nutritionMeals.length, 1);
      assert.equal(applied.state.nutritionFoods.length, 1);
      assert.equal(
        applied.state.nutritionMeals[0].ingredients[0].foodId,
        applied.state.nutritionFoods[0].id,
      );
      assert.equal(applied.state.nutritionSettings.targets.calories, 2200);
      assert.ok(applied.activity.inverse.entities.nutritionMeals);

      const retry = service.applyNutritionPlanCommand(applied.state, {
        ...previewInput,
        requestId: "nutrition-plan-001",
        previewToken: preview.previewToken,
      });
      assert.equal(retry.changed, false);
      assert.equal(retry.state.nutritionMeals.length, 1);
    },
  },
  {
    name: "pauses without deleting meals and protects deletion",
    async fn() {
      const service = await import("../mcp/nutrition-service.mjs");
      const base = state();
      const created = service.createMealCommand(base, {
        requestId: "create-meal-001",
        date: "2026-07-27",
        type: "lunch",
        title: "Обед",
      });
      assert.throws(() => service.deleteMealCommand(created.state, {
        requestId: "delete-meal-001",
        mealId: created.meal.id,
        confirm: false,
      }), /подтверждение/);

      const paused = service.setPlanPausedCommand(created.state, {
        requestId: "pause-plan-001",
        paused: true,
      });
      assert.equal(paused.state.nutritionSettings.paused, true);
      assert.equal(paused.state.nutritionMeals.length, 1);
    },
  },
];

function planInput() {
  return {
    from: "2026-07-27",
    to: "2026-08-02",
    mode: "replace",
    foods: [{
      name: "Гречка",
      unit: "г",
      calories: 343,
      protein: 13,
      fat: 3.4,
      carbs: 72,
      approximate: true,
    }],
    meals: [{
      date: "2026-07-27",
      type: "breakfast",
      title: "Гречка с яйцом",
      ingredients: [{ name: "Гречка", quantity: 80, unit: "г" }],
      nutrition: { calories: 390, protein: 19, fat: 12, carbs: 51 },
    }],
    targets: { calories: 2200, protein: 140, fat: 70, carbs: 250 },
  };
}

function state() {
  return {
    nutritionFoods: [],
    nutritionMeals: [],
    nutritionTemplates: [],
    nutritionSettings: {},
    mcpActivity: [],
    tombstones: {
      tasks: {},
      habits: {},
      goals: {},
      journalEntries: {},
      categories: {},
      nutritionFoods: {},
      nutritionMeals: {},
      nutritionTemplates: {},
    },
    syncMeta: { entityFields: {} },
  };
}
