(function (global) {
  const CAMERA_KEY = "rhythm-board-camera-v1";
  const MIN_ZOOM = 0.35;
  const MAX_ZOOM = 2.2;
  const MAX_UNDO = 30;

  function createBoardView(ctx) {
    let camera = loadCamera();
    let cameraReady = false;
    let selectedId = "";
    let gesture = null;
    let textBeforeEdit = null;
    let saveTextTimer = null;
    let undoStack = [];
    let viewportSize = null;
    const objectUrls = new Map();
    const uploads = new Set();

    function bindEvents() {
      ctx.els.boardAddText?.addEventListener("click", () => addTextAtCenter());
      ctx.els.boardAddImage?.addEventListener("click", () => ctx.els.boardImageInput?.click());
      ctx.els.boardImageInput?.addEventListener("change", async () => {
        const files = [...(ctx.els.boardImageInput.files || [])];
        ctx.els.boardImageInput.value = "";
        await addImageFiles(files, viewportCenter());
      });
      ctx.els.boardUndo?.addEventListener("click", undo);
      ctx.els.boardZoomIn?.addEventListener("click", () => zoomAt(1.16));
      ctx.els.boardZoomOut?.addEventListener("click", () => zoomAt(1 / 1.16));
      ctx.els.boardFocus?.addEventListener("click", focusContent);
      ctx.els.boardViewport?.addEventListener("dblclick", handleDoubleClick);
      ctx.els.boardViewport?.addEventListener("pointerdown", startPan);
      ctx.els.boardViewport?.addEventListener("wheel", handleWheel, { passive: false });
      ctx.els.boardViewport?.addEventListener("dragover", handleDragOver);
      ctx.els.boardViewport?.addEventListener("dragleave", handleDragLeave);
      ctx.els.boardViewport?.addEventListener("drop", handleDrop);
      global.addEventListener("pointermove", handlePointerMove);
      global.addEventListener("pointerup", finishGesture);
      global.addEventListener("pointercancel", cancelGesture);
      global.addEventListener("keydown", handleKeyDown);
      global.addEventListener("paste", handlePaste);
      if (global.ResizeObserver && ctx.els.boardViewport) {
        const resizeObserver = new global.ResizeObserver(handleViewportResize);
        resizeObserver.observe(ctx.els.boardViewport);
      } else {
        global.addEventListener("resize", handleViewportResize);
      }
    }

    function render() {
      if (!ctx.els.boardWorld || !ctx.els.boardViewport) return;
      initializeCamera();
      const items = ctx.getItems();
      const liveIds = new Set(items.filter((item) => item.type === "image").map((item) => item.assetId));
      objectUrls.forEach((url, assetId) => {
        if (liveIds.has(assetId)) return;
        URL.revokeObjectURL(url);
        objectUrls.delete(assetId);
      });

      ctx.els.boardWorld.replaceChildren(...items.map(createItemNode));
      ctx.els.boardEmpty.hidden = items.length > 0;
      ctx.els.boardUndo.disabled = undoStack.length === 0;
      applyCamera();
      items.filter((item) => item.type === "image").forEach(loadImage);
      syncPendingImages(items);
    }

    function createItemNode(item) {
      const node = document.createElement("article");
      node.className = `board-item board-${item.type}`;
      node.dataset.id = item.id;
      node.classList.toggle("is-selected", item.id === selectedId);
      node.style.width = `${item.width}px`;
      node.style.height = `${item.height}px`;
      node.style.transform = `translate(${item.x}px, ${item.y}px)`;
      node.style.zIndex = String(item.z);

      const handle = document.createElement("div");
      handle.className = "board-item-handle";
      handle.dataset.boardDrag = "";
      const grip = icon("icon-grip");
      const label = document.createElement("span");
      label.textContent = item.type === "text" ? "Текст" : item.name || "Изображение";
      handle.append(grip, label);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "board-item-delete";
      remove.setAttribute("aria-label", "Удалить элемент");
      remove.append(icon("icon-trash"));
      remove.addEventListener("click", (event) => {
        event.stopPropagation();
        deleteItem(item.id);
      });
      handle.append(remove);
      node.append(handle);

      if (item.type === "text") {
        const textarea = document.createElement("textarea");
        textarea.className = "board-text-editor";
        textarea.value = item.text;
        textarea.maxLength = ctx.model.MAX_TEXT_LENGTH;
        textarea.placeholder = "Напиши мысль…";
        textarea.setAttribute("aria-label", "Текст заметки");
        textarea.addEventListener("focus", () => {
          selectItem(item.id);
          textBeforeEdit = { items: cloneItems(ctx.getItems()), value: item.text };
        });
        textarea.addEventListener("input", () => scheduleTextSave(item.id, textarea.value));
        textarea.addEventListener("blur", () => finishTextEdit(item.id, textarea.value));
        node.append(textarea);
      } else {
        const image = document.createElement("img");
        image.className = "board-image-content";
        image.alt = item.name || "Изображение на доске";
        image.draggable = false;
        image.dataset.assetId = item.assetId;
        const placeholder = document.createElement("div");
        placeholder.className = "board-image-placeholder";
        placeholder.textContent = "Загружаем изображение…";
        node.append(image, placeholder);
      }

      const resize = document.createElement("button");
      resize.type = "button";
      resize.className = "board-resize-handle";
      resize.dataset.boardResize = "";
      resize.setAttribute("aria-label", "Изменить размер");
      node.append(resize);

      node.addEventListener("pointerdown", (event) => {
        selectItem(item.id);
        if (event.target.closest("[data-board-drag]")) startItemGesture(event, item, "move", node);
        if (event.target.closest("[data-board-resize]")) startItemGesture(event, item, "resize", node);
      });
      return node;
    }

    function addTextAtCenter(point = viewportCenter()) {
      const world = screenToWorld(point.x, point.y);
      pushUndo();
      const item = ctx.model.createTextItem({
        x: world.x - 140,
        y: world.y - 90,
        z: nextZ(),
      }, {
        createId: ctx.createId,
        now: new Date().toISOString(),
      });
      selectedId = item.id;
      commit([...ctx.getItems(), item]);
      requestAnimationFrame(() => ctx.els.boardWorld.querySelector(`[data-id="${cssEscape(item.id)}"] textarea`)?.focus());
      ctx.showToast("Текст добавлен");
    }

    async function addImageFiles(files, point) {
      const images = files.filter((file) => String(file.type || "").startsWith("image/")).slice(0, 8);
      if (!images.length) return;
      const anchor = screenToWorld(point.x, point.y);
      for (let index = 0; index < images.length; index += 1) {
        try {
          setStatus("Подготавливаем изображение…");
          const prepared = await ctx.assets.prepareImage(images[index]);
          const assetId = ctx.createId();
          await ctx.assets.put(assetId, prepared.blob, prepared);
          const fit = fitImage(prepared.width, prepared.height);
          pushUndo();
          const item = ctx.model.createImageItem({
            assetId,
            mime: prepared.mime,
            name: prepared.name,
            width: fit.width,
            height: fit.height,
            x: anchor.x - fit.width / 2 + index * 28,
            y: anchor.y - fit.height / 2 + index * 28,
            z: nextZ(),
          }, {
            createId: ctx.createId,
            now: new Date().toISOString(),
          });
          selectedId = item.id;
          commit([...ctx.getItems(), item]);
          uploadImage(item);
        } catch (error) {
          ctx.showToast(error.message || "Не удалось добавить изображение");
        }
      }
      setStatus("Изменения сохраняются автоматически");
    }

    function startPan(event) {
      if (event.button !== 0 || event.target.closest(".board-item") || event.target.closest(".board-toolbar")) return;
      selectedId = "";
      updateSelection();
      gesture = {
        type: "pan",
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        cameraX: camera.x,
        cameraY: camera.y,
      };
      ctx.els.boardViewport.setPointerCapture?.(event.pointerId);
      ctx.els.boardViewport.classList.add("is-panning");
    }

    function startItemGesture(event, item, type, node) {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      gesture = {
        type,
        pointerId: event.pointerId,
        itemId: item.id,
        node,
        startX: event.clientX,
        startY: event.clientY,
        original: { ...item },
        before: cloneItems(ctx.getItems()),
        moved: false,
      };
      node.setPointerCapture?.(event.pointerId);
      node.classList.add(type === "move" ? "is-dragging" : "is-resizing");
    }

    function handlePointerMove(event) {
      if (!gesture || event.pointerId !== gesture.pointerId) return;
      const dx = event.clientX - gesture.startX;
      const dy = event.clientY - gesture.startY;
      if (gesture.type === "pan") {
        camera.x = gesture.cameraX + dx;
        camera.y = gesture.cameraY + dy;
        applyCamera();
        return;
      }
      const worldDx = dx / camera.zoom;
      const worldDy = dy / camera.zoom;
      gesture.moved ||= Math.abs(dx) + Math.abs(dy) > 3;
      if (gesture.type === "move") {
        gesture.preview = {
          x: gesture.original.x + worldDx,
          y: gesture.original.y + worldDy,
        };
        gesture.node.style.transform = `translate(${gesture.preview.x}px, ${gesture.preview.y}px)`;
      } else {
        const minWidth = gesture.original.type === "image" ? 100 : 180;
        const minHeight = gesture.original.type === "image" ? 80 : 120;
        let width = Math.max(minWidth, gesture.original.width + worldDx);
        let height = Math.max(minHeight, gesture.original.height + worldDy);
        if (gesture.original.type === "image" && !event.shiftKey) {
          const ratio = gesture.original.width / gesture.original.height;
          if (Math.abs(worldDx) >= Math.abs(worldDy)) height = width / ratio;
          else width = height * ratio;
        }
        gesture.preview = { width, height };
        gesture.node.style.width = `${width}px`;
        gesture.node.style.height = `${height}px`;
      }
    }

    function finishGesture(event) {
      if (!gesture || event.pointerId !== gesture.pointerId) return;
      const current = gesture;
      gesture = null;
      ctx.els.boardViewport.classList.remove("is-panning");
      current.node?.classList.remove("is-dragging", "is-resizing");
      if (current.type === "pan") {
        saveCamera();
        return;
      }
      if (!current.moved || !current.preview) return;
      undoStack.push(current.before);
      trimUndo();
      const now = new Date().toISOString();
      const next = ctx.getItems().map((item) => item.id === current.itemId
        ? { ...item, ...current.preview, z: nextZ(), updatedAt: now }
        : item);
      commit(next);
    }

    function cancelGesture() {
      if (!gesture) return;
      gesture.node?.classList.remove("is-dragging", "is-resizing");
      ctx.els.boardViewport.classList.remove("is-panning");
      gesture = null;
      applyCamera();
      render();
    }

    function handleWheel(event) {
      event.preventDefault();
      const factor = Math.exp(-event.deltaY * 0.0012);
      zoomAt(factor, { x: event.clientX, y: event.clientY });
    }

    function handleViewportResize() {
      const rect = ctx.els.boardViewport?.getBoundingClientRect();
      if (!rect?.width || !rect?.height) return;
      if (viewportSize && camera) {
        camera.x += (rect.width - viewportSize.width) / 2;
        camera.y += (rect.height - viewportSize.height) / 2;
        applyCamera();
        saveCamera();
      }
      viewportSize = { width: rect.width, height: rect.height };
    }

    function zoomAt(factor, point = viewportCenter()) {
      const rect = ctx.els.boardViewport.getBoundingClientRect();
      const localX = point.x - rect.left;
      const localY = point.y - rect.top;
      const worldX = (localX - camera.x) / camera.zoom;
      const worldY = (localY - camera.y) / camera.zoom;
      const zoom = clamp(camera.zoom * factor, MIN_ZOOM, MAX_ZOOM);
      camera.x = localX - worldX * zoom;
      camera.y = localY - worldY * zoom;
      camera.zoom = zoom;
      applyCamera();
      saveCamera();
    }

    function focusContent() {
      const content = ctx.model.bounds(ctx.getItems());
      const rect = ctx.els.boardViewport.getBoundingClientRect();
      if (!content) {
        camera = { x: rect.width / 2 - 140, y: Math.max(90, rect.height / 3), zoom: 1 };
      } else {
        const padding = Math.min(120, Math.max(36, rect.width * 0.08));
        const zoom = clamp(Math.min(
          (rect.width - padding * 2) / Math.max(content.width, 1),
          (rect.height - padding * 2) / Math.max(content.height, 1),
          1.3,
        ), MIN_ZOOM, MAX_ZOOM);
        camera = {
          zoom,
          x: rect.width / 2 - (content.left + content.width / 2) * zoom,
          y: rect.height / 2 - (content.top + content.height / 2) * zoom,
        };
      }
      applyCamera();
      saveCamera();
    }

    function handleDoubleClick(event) {
      if (event.target.closest(".board-item") || event.target.closest(".board-toolbar")) return;
      addTextAtCenter({ x: event.clientX, y: event.clientY });
    }

    function handleDragOver(event) {
      if (![...(event.dataTransfer?.items || [])].some((item) => item.type.startsWith("image/"))) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      ctx.els.boardViewport.classList.add("is-drop-target");
    }

    function handleDragLeave(event) {
      if (event.relatedTarget && ctx.els.boardViewport.contains(event.relatedTarget)) return;
      ctx.els.boardViewport.classList.remove("is-drop-target");
    }

    async function handleDrop(event) {
      ctx.els.boardViewport.classList.remove("is-drop-target");
      const files = [...(event.dataTransfer?.files || [])].filter((file) => file.type.startsWith("image/"));
      if (!files.length) return;
      event.preventDefault();
      await addImageFiles(files, { x: event.clientX, y: event.clientY });
    }

    async function handlePaste(event) {
      if (!isBoardActive() || event.target.closest?.("textarea, input, [contenteditable]")) return;
      const files = [...(event.clipboardData?.items || [])]
        .filter((item) => item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .filter(Boolean);
      if (!files.length) return;
      event.preventDefault();
      await addImageFiles(files, viewportCenter());
    }

    function handleKeyDown(event) {
      if (!isBoardActive()) return;
      const editing = event.target.closest?.("textarea, input, [contenteditable]");
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !editing) {
        event.preventDefault();
        undo();
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedId && !editing) {
        event.preventDefault();
        deleteItem(selectedId);
      }
      if (event.key === "Escape") {
        selectedId = "";
        updateSelection();
      }
    }

    function deleteItem(id) {
      const item = ctx.getItems().find((candidate) => candidate.id === id);
      if (!item) return;
      pushUndo();
      selectedId = "";
      ctx.commitItems(ctx.getItems().filter((candidate) => candidate.id !== id), { deletedIds: [id] });
      render();
      ctx.showToast("Элемент удалён — можно отменить на панели доски");
    }

    function undo() {
      const snapshot = undoStack.pop();
      if (!snapshot) return;
      selectedId = "";
      ctx.commitItems(snapshot, { restoreDeleted: true });
      render();
      ctx.showToast("Изменение отменено");
    }

    function scheduleTextSave(id, value) {
      if (saveTextTimer) clearTimeout(saveTextTimer);
      saveTextTimer = setTimeout(() => saveText(id, value), 500);
    }

    function finishTextEdit(id, value) {
      if (saveTextTimer) clearTimeout(saveTextTimer);
      saveTextTimer = null;
      if (textBeforeEdit && textBeforeEdit.value !== value) {
        undoStack.push(textBeforeEdit.items);
        trimUndo();
      }
      textBeforeEdit = null;
      saveText(id, value);
    }

    function saveText(id, value) {
      const current = ctx.getItems().find((item) => item.id === id);
      if (!current || current.text === value) return;
      ctx.commitItems(ctx.getItems().map((item) => item.id === id
        ? { ...item, text: String(value).slice(0, ctx.model.MAX_TEXT_LENGTH), updatedAt: new Date().toISOString() }
        : item), { render: false });
      setStatus("Сохранено");
    }

    function selectItem(id) {
      if (selectedId === id) return;
      selectedId = id;
      updateSelection();
    }

    function updateSelection() {
      ctx.els.boardWorld.querySelectorAll(".board-item").forEach((node) => {
        node.classList.toggle("is-selected", node.dataset.id === selectedId);
      });
    }

    function commit(items) {
      ctx.commitItems(ctx.model.normalizeItems(items, { createId: ctx.createId }));
      render();
    }

    async function loadImage(item) {
      const node = ctx.els.boardWorld.querySelector(`[data-id="${cssEscape(item.id)}"]`);
      const image = node?.querySelector("img");
      const placeholder = node?.querySelector(".board-image-placeholder");
      if (!image) return;
      let url = objectUrls.get(item.assetId);
      if (!url) {
        const blob = await ctx.assets.resolveBlob(item).catch(() => null);
        if (!blob || !image.isConnected) {
          if (placeholder) placeholder.textContent = item.remotePath
            ? "Изображение временно недоступно"
            : "Изображение хранится на другом устройстве";
          return;
        }
        url = URL.createObjectURL(blob);
        objectUrls.set(item.assetId, url);
      }
      image.src = url;
      image.addEventListener("load", () => {
        if (placeholder) placeholder.hidden = true;
      }, { once: true });
    }

    function syncPendingImages(items) {
      items.filter((item) => item.type === "image" && !item.remotePath).forEach(uploadImage);
    }

    async function uploadImage(item) {
      if (uploads.has(item.assetId) || item.remotePath) return;
      uploads.add(item.assetId);
      try {
        const remotePath = await ctx.assets.upload(item);
        if (!remotePath) return;
        const current = ctx.getItems().find((candidate) => candidate.id === item.id);
        if (!current || current.remotePath) return;
        ctx.commitItems(ctx.getItems().map((candidate) => candidate.id === item.id
          ? { ...candidate, remotePath, updatedAt: new Date().toISOString() }
          : candidate), { render: false });
        setStatus("Изображение синхронизировано");
      } catch {
        setStatus("Изображение сохранено локально");
      } finally {
        uploads.delete(item.assetId);
      }
    }

    function pushUndo() {
      undoStack.push(cloneItems(ctx.getItems()));
      trimUndo();
    }

    function trimUndo() {
      if (undoStack.length > MAX_UNDO) undoStack = undoStack.slice(-MAX_UNDO);
      if (ctx.els.boardUndo) ctx.els.boardUndo.disabled = undoStack.length === 0;
    }

    function nextZ() {
      return Math.max(0, ...ctx.getItems().map((item) => item.z || 0)) + 1;
    }

    function initializeCamera() {
      if (cameraReady) return;
      cameraReady = true;
      if (!camera) {
        const rect = ctx.els.boardViewport.getBoundingClientRect();
        camera = { x: rect.width / 2 - 140, y: Math.max(100, rect.height / 3), zoom: 1 };
      }
    }

    function applyCamera() {
      if (!camera) return;
      ctx.els.boardWorld.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`;
      ctx.els.boardZoomLabel.textContent = `${Math.round(camera.zoom * 100)}%`;
    }

    function saveCamera() {
      try {
        global.localStorage.setItem(CAMERA_KEY, JSON.stringify(camera));
      } catch {}
    }

    function loadCamera() {
      try {
        const value = JSON.parse(global.localStorage.getItem(CAMERA_KEY));
        if (!Number.isFinite(value?.x) || !Number.isFinite(value?.y) || !Number.isFinite(value?.zoom)) return null;
        return { x: value.x, y: value.y, zoom: clamp(value.zoom, MIN_ZOOM, MAX_ZOOM) };
      } catch {
        return null;
      }
    }

    function viewportCenter() {
      const rect = ctx.els.boardViewport.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }

    function screenToWorld(clientX, clientY) {
      const rect = ctx.els.boardViewport.getBoundingClientRect();
      return {
        x: (clientX - rect.left - camera.x) / camera.zoom,
        y: (clientY - rect.top - camera.y) / camera.zoom,
      };
    }

    function setStatus(message) {
      if (ctx.els.boardStatus) ctx.els.boardStatus.textContent = message;
    }

    function isBoardActive() {
      return document.body.dataset.view === "board";
    }

    return {
      bindEvents,
      focusContent,
      render,
    };
  }

  function fitImage(width, height) {
    const scale = Math.min(1, 420 / width, 320 / height);
    return {
      width: Math.max(100, Math.round(width * scale)),
      height: Math.max(80, Math.round(height * scale)),
    };
  }

  function icon(name) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "ui-icon");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", `#${name}`);
    svg.append(use);
    return svg;
  }

  function cloneItems(items) {
    return JSON.parse(JSON.stringify(items || []));
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function cssEscape(value) {
    return global.CSS?.escape ? global.CSS.escape(value) : String(value).replace(/["\\]/g, "\\$&");
  }

  const api = { createBoardView, fitImage };
  global.RhythmBoardView = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
