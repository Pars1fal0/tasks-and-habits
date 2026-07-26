(function (global) {
  const ITEM_TYPES = new Set(["text", "image"]);
  const MAX_TEXT_LENGTH = 20000;

  function normalizeItems(value, options = {}) {
    const createId = options.createId || (() => `board-${Date.now().toString(36)}`);
    const seen = new Set();
    return (Array.isArray(value) ? value : [])
      .map((item, index) => normalizeItem(item, { createId, index }))
      .filter(Boolean)
      .filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      })
      .sort((left, right) => left.z - right.z || left.createdAt.localeCompare(right.createdAt));
  }

  function normalizeItem(value, options = {}) {
    if (!value || !ITEM_TYPES.has(value.type)) return null;
    const now = options.now || new Date().toISOString();
    const type = value.type;
    const assetId = cleanText(value.assetId, 160);
    if (type === "image" && !assetId) return null;
    return {
      id: cleanText(value.id, 160) || options.createId?.() || `board-${Date.now().toString(36)}`,
      type,
      x: finiteNumber(value.x, -100000, 100000, 0),
      y: finiteNumber(value.y, -100000, 100000, 0),
      width: finiteNumber(value.width, type === "image" ? 100 : 180, type === "image" ? 2400 : 1600, type === "image" ? 320 : 260),
      height: finiteNumber(value.height, type === "image" ? 80 : 120, type === "image" ? 2400 : 1600, type === "image" ? 220 : 180),
      z: Math.round(finiteNumber(value.z, 0, 1000000, options.index || 0)),
      text: type === "text" ? cleanText(value.text, MAX_TEXT_LENGTH, true) : "",
      assetId: type === "image" ? assetId : "",
      remotePath: type === "image" ? cleanText(value.remotePath, 500) : "",
      mime: type === "image" && /^image\/[a-z0-9.+-]+$/i.test(String(value.mime || "")) ? String(value.mime) : "",
      name: type === "image" ? cleanText(value.name, 240) : "",
      createdAt: validTimestamp(value.createdAt) || now,
      updatedAt: validTimestamp(value.updatedAt) || validTimestamp(value.createdAt) || now,
    };
  }

  function createTextItem(input = {}, options = {}) {
    return normalizeItem({
      id: options.createId?.(),
      type: "text",
      x: input.x,
      y: input.y,
      width: input.width || 280,
      height: input.height || 180,
      z: input.z,
      text: input.text || "",
      createdAt: options.now,
      updatedAt: options.now,
    }, options);
  }

  function createImageItem(input = {}, options = {}) {
    return normalizeItem({
      id: options.createId?.(),
      type: "image",
      x: input.x,
      y: input.y,
      width: input.width || 360,
      height: input.height || 240,
      z: input.z,
      assetId: input.assetId,
      remotePath: input.remotePath,
      mime: input.mime,
      name: input.name,
      createdAt: options.now,
      updatedAt: options.now,
    }, options);
  }

  function bounds(items = []) {
    if (!items.length) return null;
    const left = Math.min(...items.map((item) => item.x));
    const top = Math.min(...items.map((item) => item.y));
    const right = Math.max(...items.map((item) => item.x + item.width));
    const bottom = Math.max(...items.map((item) => item.y + item.height));
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  }

  function cleanText(value, maxLength, preserveWhitespace = false) {
    const text = String(value || "").replace(/\u0000/g, "");
    return (preserveWhitespace ? text : text.trim()).slice(0, maxLength);
  }

  function finiteNumber(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
  }

  function validTimestamp(value) {
    return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : "";
  }

  const api = {
    MAX_TEXT_LENGTH,
    bounds,
    createImageItem,
    createTextItem,
    normalizeItem,
    normalizeItems,
  };
  global.RhythmBoardModel = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
