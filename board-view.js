(function (global) {
  const CAMERA_KEY = "rhythm-board-camera-v2";
  const MIN_ZOOM = 0.02;
  const MAX_ZOOM = 8;
  const MAX_UNDO = 50;
  const RESIZE_DIRECTIONS = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

  function createBoardView(ctx) {
    let camera = loadCamera();
    let cameraReady = false;
    let selectedId = "";
    let selectedIds = new Set();
    let editingId = "";
    let gesture = null;
    let textBeforeEdit = null;
    let saveTextTimer = null;
    let undoStack = [];
    let viewportSize = null;
    let imageUploadBusy = false;
    let spacePressed = false;
    const objectUrls = new Map();
    const pendingUploadAttempts = new Map();

    function bindEvents() {
      ctx.els.boardAddText?.addEventListener("click", () => addTextAtCenter());
      ctx.els.boardAddImage?.addEventListener("click", () => {
        if (!imageUploadBusy) ctx.els.boardImageInput?.click();
      });
      ctx.els.boardImageInput?.addEventListener("change", async () => {
        const files = [...(ctx.els.boardImageInput.files || [])];
        ctx.els.boardImageInput.value = "";
        await addImageFiles(files, viewportCenter());
      });
      ctx.els.boardUndo?.addEventListener("click", undo);
      ctx.els.boardZoomIn?.addEventListener("click", () => zoomAt(1.3));
      ctx.els.boardZoomOut?.addEventListener("click", () => zoomAt(1 / 1.3));
      ctx.els.boardFocus?.addEventListener("click", focusContent);
      ctx.els.boardBold?.addEventListener("click", () => {
        toggleBold();
        focusPrimarySelection();
      });
      ctx.els.boardColorPresets?.addEventListener("click", (event) => {
        const swatch = event.target.closest("[data-board-text-color]");
        if (swatch) {
          applyTextColor(swatch.dataset.boardTextColor);
          focusPrimarySelection();
        }
      });
      ctx.els.boardTextColor?.addEventListener("input", () => applyTextColor(ctx.els.boardTextColor.value));
      ctx.els.boardTextColor?.addEventListener("change", focusPrimarySelection);
      ctx.els.boardFontSize?.addEventListener("change", applyFontSize);
      ctx.els.boardFontSize?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          applyFontSize();
          ctx.els.boardFontSize.blur();
        }
      });
      ctx.els.boardViewport?.addEventListener("dblclick", handleCanvasDoubleClick);
      ctx.els.boardViewport?.addEventListener("pointerdown", startPan);
      ctx.els.boardViewport?.addEventListener("wheel", handleWheel, { passive: false });
      ctx.els.boardViewport?.addEventListener("dragover", handleDragOver);
      ctx.els.boardViewport?.addEventListener("dragleave", handleDragLeave);
      ctx.els.boardViewport?.addEventListener("drop", handleDrop);
      global.addEventListener("pointermove", handlePointerMove);
      global.addEventListener("pointerup", finishGesture);
      global.addEventListener("pointercancel", cancelGesture);
      global.addEventListener("keydown", handleKeyDown, true);
      global.addEventListener("keyup", handleKeyUp, true);
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
      const liveIds = new Set(items.map((item) => item.id));
      selectedIds = new Set([...selectedIds].filter((id) => liveIds.has(id)));
      if (selectedId && !liveIds.has(selectedId)) selectedId = [...selectedIds].at(-1) || "";
      if (editingId && !items.some((item) => item.id === editingId)) editingId = "";
      releaseUnusedObjectUrls(items);

      ctx.els.boardWorld.replaceChildren(...items.map(createItemNode));
      ctx.els.boardEmpty.hidden = items.length > 0;
      ctx.els.boardUndo.disabled = undoStack.length === 0;
      applyCamera();
      updateSelection();
      items.filter((item) => item.type === "image").forEach(loadImage);
      syncLegacyImages(items);
    }

    function createItemNode(item) {
      const node = document.createElement("article");
      node.className = `board-item board-${item.type}`;
      node.dataset.id = item.id;
      node.tabIndex = -1;
      node.setAttribute("role", "group");
      node.setAttribute("aria-label", item.type === "text" ? "Текст на доске" : "Изображение на доске");
      applyNodeGeometry(node, item);

      if (item.type === "text") {
        node.append(createTextContent(item, node));
      } else {
        node.append(...createImageContent(item));
      }
      RESIZE_DIRECTIONS.forEach((direction) => node.append(createResizeHandle(direction)));

      node.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        if (spacePressed) return;
        if (event.detail >= 2 && item.type === "text" && event.target.closest(".board-text-content")) {
          event.preventDefault();
          event.stopPropagation();
          setSelection([item.id], item.id);
          startTextEdit(item.id, node);
          return;
        }
        const resizeHandle = event.target.closest("[data-board-resize]");
        const remainsSelected = selectItem(item.id, node, { additive: event.shiftKey, toggle: event.shiftKey });
        if (!remainsSelected) return;
        if (resizeHandle) {
          startItemGesture(event, item, "resize", node, resizeHandle.dataset.boardResize);
          return;
        }
        if (editingId === item.id && event.target.closest(".board-text-content")) return;
        startItemGesture(event, item, "move", node);
      });
      node.addEventListener("focus", () => {
        if (!selectedIds.has(item.id)) selectItem(item.id, node);
      });
      return node;
    }

    function createTextContent(item, node) {
      const content = document.createElement("div");
      content.className = "board-text-content";
      content.textContent = item.text;
      content.spellcheck = true;
      content.dataset.placeholder = "Введите текст";
      content.style.fontSize = `${item.fontSize}px`;
      content.style.fontWeight = String(item.fontWeight);
      content.style.color = item.color;
      content.setAttribute("aria-label", "Текстовый объект");
      content.addEventListener("dblclick", (event) => {
        event.preventDefault();
        event.stopPropagation();
        startTextEdit(item.id, node);
      });
      content.addEventListener("input", () => scheduleTextSave(item.id, editableText(content)));
      content.addEventListener("blur", () => finishTextEdit(item.id, content));
      content.addEventListener("paste", pastePlainText);
      return content;
    }

    function createImageContent(item) {
      const image = document.createElement("img");
      image.className = "board-image-content";
      image.alt = item.name || "Изображение на доске";
      image.draggable = false;
      image.dataset.assetId = item.assetId;
      const placeholder = document.createElement("div");
      placeholder.className = "board-image-placeholder";
      placeholder.textContent = item.remotePath
        ? "Загружаем изображение из Supabase…"
        : "Переносим старое изображение в Supabase…";
      return [image, placeholder];
    }

    function createResizeHandle(direction) {
      const handle = document.createElement("span");
      handle.className = `board-resize-handle is-${direction}`;
      handle.dataset.boardResize = direction;
      handle.setAttribute("aria-hidden", "true");
      return handle;
    }

    function addTextAtCenter(point = viewportCenter()) {
      const world = screenToWorld(point.x, point.y);
      const viewportWidth = ctx.els.boardViewport.getBoundingClientRect().width / camera.zoom;
      const width = clamp(viewportWidth - 32 / camera.zoom, 180, 360);
      const position = findOpenPosition(world.x - width / 2, world.y - 70, width, 140);
      pushUndo();
      const item = ctx.model.createTextItem({
        x: position.x,
        y: position.y,
        width,
        z: nextZ(),
      }, {
        createId: ctx.createId,
        now: new Date().toISOString(),
      });
      selectedId = item.id;
      selectedIds = new Set([item.id]);
      commit([...ctx.getItems(), item]);
      requestAnimationFrame(() => {
        const node = findItemNode(item.id);
        if (node) startTextEdit(item.id, node);
      });
    }

    function findOpenPosition(baseX, baseY, width, height) {
      const directions = [
        [0, 0],
        [-1, 0],
        [1, 0],
        [0, 1],
        [0, -1],
        [-1, 1],
        [1, 1],
        [-1, -1],
        [1, -1],
      ];
      const items = ctx.getItems();
      const stepX = width + 40;
      const stepY = height + 40;
      const viewport = ctx.els.boardViewport.getBoundingClientRect();
      const padding = 16 / camera.zoom;
      const visibleBounds = {
        left: -camera.x / camera.zoom + padding,
        top: -camera.y / camera.zoom + padding,
        right: (viewport.width - camera.x) / camera.zoom - padding,
        bottom: (viewport.height - camera.y) / camera.zoom - padding,
      };
      for (const keepVisible of [true, false]) {
        for (let radius = 0; radius <= 20; radius += 1) {
          for (const [directionX, directionY] of directions) {
            if (radius === 0 && (directionX || directionY)) continue;
            if (radius > 0 && !directionX && !directionY) continue;
            const candidate = {
              x: baseX + directionX * stepX * radius,
              y: baseY + directionY * stepY * radius,
            };
            if (keepVisible && (
              candidate.x < visibleBounds.left
              || candidate.y < visibleBounds.top
              || candidate.x + width > visibleBounds.right
              || candidate.y + height > visibleBounds.bottom
            )) continue;
            const overlaps = items.some((item) =>
              candidate.x < item.x + item.width + 24
              && candidate.x + width + 24 > item.x
              && candidate.y < item.y + item.height + 24
              && candidate.y + height + 24 > item.y);
            if (!overlaps) return candidate;
          }
        }
      }
      return { x: baseX, y: baseY + (items.length + 1) * stepY };
    }

    async function addImageFiles(files, point) {
      const images = files
        .filter((file) => String(file.type || "").startsWith("image/"))
        .slice(0, 8);
      if (!images.length || imageUploadBusy) return;
      imageUploadBusy = true;
      ctx.els.boardAddImage.disabled = true;
      const before = cloneItems(ctx.getItems());
      const added = [];
      const anchor = screenToWorld(point.x, point.y);
      try {
        for (let index = 0; index < images.length; index += 1) {
          try {
            setStatus(`Загружаю фото ${index + 1} из ${images.length} в Supabase…`, "loading");
            const prepared = await ctx.assets.prepareImage(images[index]);
            const assetId = ctx.createId();
            const remotePath = await ctx.assets.uploadPrepared(assetId, prepared);
            cacheImageUrl(assetId, prepared.blob);
            const fit = fitImage(prepared.width, prepared.height);
            const item = ctx.model.createImageItem({
              assetId,
              remotePath,
              mime: prepared.mime,
              name: prepared.name,
              width: fit.width,
              height: fit.height,
              x: anchor.x - fit.width / 2 + index * 32,
              y: anchor.y - fit.height / 2 + index * 32,
              z: nextZ() + index,
            }, {
              createId: ctx.createId,
              now: new Date().toISOString(),
            });
            added.push(item);
          } catch (error) {
            showImageError(error);
          }
        }
        if (added.length) {
          undoStack.push(before);
          trimUndo();
          selectedId = added.at(-1).id;
          selectedIds = new Set([selectedId]);
          commit([...before, ...added]);
          setStatus(
            added.length === 1
              ? "Фото сохранено в Supabase Storage"
              : `Фото сохранены в Supabase Storage: ${added.length}`,
            "cloud",
          );
        }
      } finally {
        imageUploadBusy = false;
        ctx.els.boardAddImage.disabled = false;
      }
    }

    function startPan(event) {
      const shouldPan = event.pointerType === "touch" || event.button === 1 || (event.button === 0 && spacePressed);
      if (
        (!shouldPan && event.button !== 0)
        || (!shouldPan && event.target.closest(".board-item"))
        || event.target.closest(".board-toolbar")
        || event.target.closest(".board-selection-toolbar")
        || event.target.closest(".board-zoom-controls")
      ) return;
      event.preventDefault();
      finishActiveTextEdit();
      if (!shouldPan && !event.shiftKey) setSelection([]);
      gesture = {
        type: shouldPan ? "pan" : "marquee",
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        extendSelection: event.shiftKey,
        initialSelection: new Set(selectedIds),
        cameraX: camera.x,
        cameraY: camera.y,
      };
      ctx.els.boardViewport.setPointerCapture?.(event.pointerId);
      ctx.els.boardViewport.classList.add(shouldPan ? "is-panning" : "is-selecting");
      if (!shouldPan) updateMarquee(event.clientX, event.clientY);
    }

    function startItemGesture(event, item, type, node, direction = "") {
      if (type === "resize") event.preventDefault();
      event.stopPropagation();
      const movingItems = type === "move"
        ? ctx.getItems().filter((candidate) => selectedIds.has(candidate.id))
        : [item];
      gesture = {
        type,
        direction,
        pointerId: event.pointerId,
        itemId: item.id,
        node,
        startX: event.clientX,
        startY: event.clientY,
        original: { ...item },
        originals: new Map(movingItems.map((candidate) => [candidate.id, { ...candidate }])),
        nodes: movingItems.map((candidate) => findItemNode(candidate.id)).filter(Boolean),
        before: cloneItems(ctx.getItems()),
        moved: false,
      };
      gesture.nodes.forEach((itemNode) => itemNode.classList.add(type === "move" ? "is-dragging" : "is-resizing"));
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
      if (gesture.type === "marquee") {
        gesture.moved ||= Math.abs(dx) + Math.abs(dy) > 3;
        updateMarquee(event.clientX, event.clientY);
        previewMarqueeSelection();
        return;
      }
      const worldDx = dx / camera.zoom;
      const worldDy = dy / camera.zoom;
      gesture.moved ||= Math.abs(dx) + Math.abs(dy) > 3;
      if (!gesture.moved) return;
      event.preventDefault();
      if (!gesture.pointerCaptured) {
        gesture.node?.setPointerCapture?.(gesture.pointerId);
        gesture.pointerCaptured = true;
      }
      if (gesture.type === "move") {
        gesture.previews = new Map();
        gesture.originals.forEach((original, id) => {
          const preview = {
            x: original.x + worldDx,
            y: original.y + worldDy,
            width: original.width,
            height: original.height,
          };
          gesture.previews.set(id, preview);
          const itemNode = findItemNode(id);
          if (itemNode) applyNodeGeometry(itemNode, { ...original, ...preview });
        });
        return;
      }
      gesture.preview = resizeGeometry(gesture.original, worldDx, worldDy, gesture.direction);
      applyNodeGeometry(gesture.node, { ...gesture.original, ...gesture.preview });
    }

    function finishGesture(event) {
      if (!gesture || event.pointerId !== gesture.pointerId) return;
      const current = gesture;
      gesture = null;
      ctx.els.boardViewport.classList.remove("is-panning", "is-selecting");
      current.nodes?.forEach((itemNode) => itemNode.classList.remove("is-dragging", "is-resizing"));
      current.node?.classList.remove("is-dragging", "is-resizing");
      if (current.type === "pan") {
        saveCamera();
        return;
      }
      if (current.type === "marquee") {
        hideMarquee();
        if (!current.moved && !current.extendSelection) setSelection([]);
        return;
      }
      if (!current.moved || (current.type === "move" ? !current.previews : !current.preview)) {
        current.node?.focus({ preventScroll: true });
        return;
      }
      undoStack.push(current.before);
      trimUndo();
      const now = new Date().toISOString();
      const topZ = nextZ();
      const movedOrder = new Map(
        [...(current.previews?.keys() || [])].map((id, index) => [id, topZ + index]),
      );
      const next = ctx.getItems().map((item) => {
        if (current.type === "move" && current.previews.has(item.id)) {
          return { ...item, ...current.previews.get(item.id), z: movedOrder.get(item.id), updatedAt: now };
        }
        if (current.type === "resize" && item.id === current.itemId) {
          return { ...item, ...current.preview, z: topZ, updatedAt: now };
        }
        return item;
      });
      commit(next);
    }

    function cancelGesture() {
      if (!gesture) return;
      gesture.nodes?.forEach((itemNode) => itemNode.classList.remove("is-dragging", "is-resizing"));
      gesture.node?.classList.remove("is-dragging", "is-resizing");
      ctx.els.boardViewport.classList.remove("is-panning", "is-selecting");
      hideMarquee();
      gesture = null;
      applyCamera();
      render();
    }

    function updateMarquee(clientX, clientY) {
      if (!gesture || gesture.type !== "marquee" || !ctx.els.boardMarquee) return;
      const viewport = ctx.els.boardViewport.getBoundingClientRect();
      const left = clamp(Math.min(gesture.startX, clientX) - viewport.left, 0, viewport.width);
      const top = clamp(Math.min(gesture.startY, clientY) - viewport.top, 0, viewport.height);
      const right = clamp(Math.max(gesture.startX, clientX) - viewport.left, 0, viewport.width);
      const bottom = clamp(Math.max(gesture.startY, clientY) - viewport.top, 0, viewport.height);
      gesture.marquee = { left, top, right, bottom };
      ctx.els.boardMarquee.hidden = false;
      Object.assign(ctx.els.boardMarquee.style, {
        left: `${left}px`,
        top: `${top}px`,
        width: `${right - left}px`,
        height: `${bottom - top}px`,
      });
    }

    function previewMarqueeSelection() {
      if (!gesture?.marquee) return;
      const viewport = ctx.els.boardViewport.getBoundingClientRect();
      const topLeft = screenToWorld(viewport.left + gesture.marquee.left, viewport.top + gesture.marquee.top);
      const bottomRight = screenToWorld(viewport.left + gesture.marquee.right, viewport.top + gesture.marquee.bottom);
      const ids = ctx.getItems()
        .filter((item) =>
          item.x < bottomRight.x
          && item.x + item.width > topLeft.x
          && item.y < bottomRight.y
          && item.y + item.height > topLeft.y)
        .map((item) => item.id);
      const next = gesture.extendSelection
        ? [...new Set([...gesture.initialSelection, ...ids])]
        : ids;
      setSelection(next, ids.at(-1) || [...gesture.initialSelection].at(-1) || "");
    }

    function hideMarquee() {
      if (!ctx.els.boardMarquee) return;
      ctx.els.boardMarquee.hidden = true;
      ctx.els.boardMarquee.removeAttribute("style");
    }

    function handleWheel(event) {
      event.preventDefault();
      const factor = Math.exp(-event.deltaY * 0.0015);
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
        camera = { x: rect.width / 2 - 180, y: Math.max(90, rect.height / 3), zoom: 1 };
      } else {
        const padding = Math.min(120, Math.max(36, rect.width * 0.08));
        const zoom = clamp(Math.min(
          (rect.width - padding * 2) / Math.max(content.width, 1),
          (rect.height - padding * 2) / Math.max(content.height, 1),
          1.5,
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

    function handleCanvasDoubleClick(event) {
      if (
        event.target.closest(".board-item")
        || event.target.closest(".board-toolbar")
        || event.target.closest(".board-selection-toolbar")
        || event.target.closest(".board-zoom-controls")
      ) return;
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
      if (!isBoardActive() || editingId || event.target.closest?.("input, textarea, [contenteditable]")) return;
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
      const formControl = event.target.closest?.("input, textarea, select, button");
      if (event.code === "Space" && !editingId && !formControl) {
        spacePressed = true;
        ctx.els.boardViewport.classList.add("is-space-pan");
        event.preventDefault();
        return;
      }
      const focusedItemId = document.activeElement?.closest?.(".board-item")?.dataset.id;
      if (!editingId && focusedItemId && !selectedIds.has(focusedItemId)) {
        setSelection([focusedItemId], focusedItemId);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !editingId && !formControl) {
        event.preventDefault();
        undo();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "b" && selectedTexts().length && !editingId) {
        event.preventDefault();
        toggleBold();
        return;
      }
      if (event.key === "Delete" && selectedIds.size && !editingId && !formControl) {
        event.preventDefault();
        event.stopPropagation();
        deleteSelected();
        return;
      }
      if (event.key === "Enter" && selectedIds.size === 1 && selectedText() && !editingId && !formControl) {
        event.preventDefault();
        const node = findItemNode(selectedId);
        if (node) startTextEdit(selectedId, node);
        return;
      }
      if (event.key.startsWith("Arrow") && selectedIds.size && !editingId && !formControl) {
        event.preventDefault();
        moveSelectedWithKeyboard(event.key, event.shiftKey ? 10 : 1);
        return;
      }
      if (event.key === "Escape") {
        if (editingId) {
          event.preventDefault();
          finishActiveTextEdit();
          findItemNode(selectedId)?.focus({ preventScroll: true });
        } else {
          setSelection([]);
        }
      }
    }

    function handleKeyUp(event) {
      if (event.code !== "Space") return;
      spacePressed = false;
      ctx.els.boardViewport?.classList.remove("is-space-pan");
    }

    function deleteSelected() {
      const ids = new Set(selectedIds);
      if (!ids.size) return;
      pushUndo();
      setSelection([]);
      editingId = "";
      commit(ctx.getItems().filter((item) => !ids.has(item.id)), { deletedIds: [...ids] });
      ctx.showToast("Объект удалён · отмена доступна на панели доски");
    }

    function undo() {
      const snapshot = undoStack.pop();
      if (!snapshot) return;
      setSelection([]);
      editingId = "";
      ctx.commitItems(snapshot, { restoreDeleted: true });
      render();
      ctx.showToast("Изменение отменено");
    }

    function startTextEdit(id, node) {
      const item = ctx.getItems().find((candidate) => candidate.id === id);
      const content = node?.querySelector(".board-text-content");
      if (!item || !content) return;
      finishActiveTextEdit();
      setSelection([id], id);
      editingId = id;
      textBeforeEdit = { items: cloneItems(ctx.getItems()), value: item.text };
      node.classList.add("is-selected", "is-editing");
      content.contentEditable = "plaintext-only";
      if (content.contentEditable !== "plaintext-only") content.contentEditable = "true";
      content.focus({ preventScroll: true });
      placeCaretAtEnd(content);
      updateSelection();
    }

    function finishActiveTextEdit() {
      if (!editingId) return;
      const content = findItemNode(editingId)?.querySelector(".board-text-content");
      if (content) finishTextEdit(editingId, content);
      else editingId = "";
    }

    function scheduleTextSave(id, value) {
      if (saveTextTimer) clearTimeout(saveTextTimer);
      saveTextTimer = setTimeout(() => saveText(id, value), 350);
    }

    function finishTextEdit(id, content) {
      if (editingId !== id) return;
      if (saveTextTimer) clearTimeout(saveTextTimer);
      saveTextTimer = null;
      const value = editableText(content);
      if (textBeforeEdit && textBeforeEdit.value !== value) {
        undoStack.push(textBeforeEdit.items);
        trimUndo();
      }
      saveText(id, value, Math.ceil(content.scrollHeight));
      textBeforeEdit = null;
      editingId = "";
      content.contentEditable = "false";
      content.closest(".board-item")?.classList.remove("is-editing");
      updateSelection();
    }

    function saveText(id, value, minimumHeight = 0) {
      const current = ctx.getItems().find((item) => item.id === id);
      if (!current) return;
      const height = Math.max(current.height, minimumHeight);
      if (current.text === value && current.height === height) return;
      ctx.commitItems(ctx.getItems().map((item) => item.id === id
        ? {
            ...item,
            text: String(value).slice(0, ctx.model.MAX_TEXT_LENGTH),
            height,
            updatedAt: new Date().toISOString(),
          }
        : item), { render: false });
      const node = findItemNode(id);
      if (node) node.style.height = `${height}px`;
      setStatus("Сохранено · фото хранятся в Supabase Storage", "saved");
    }

    function pastePlainText(event) {
      event.preventDefault();
      const text = event.clipboardData?.getData("text/plain") || "";
      global.document.execCommand("insertText", false, text);
    }

    function selectItem(id, node = findItemNode(id), options = {}) {
      if (editingId && editingId !== id) finishActiveTextEdit();
      const preserveGroup = !options.additive && selectedIds.size > 1 && selectedIds.has(id);
      const next = new Set(options.additive || preserveGroup ? selectedIds : []);
      if (options.toggle && next.has(id)) next.delete(id);
      else next.add(id);
      setSelection([...next], next.has(id) ? id : [...next].at(-1) || "");
      if (next.has(id)) node?.focus({ preventScroll: true });
      return next.has(id);
    }

    function setSelection(ids, primaryId = "") {
      selectedIds = new Set((ids || []).filter(Boolean));
      selectedId = selectedIds.has(primaryId) ? primaryId : [...selectedIds].at(-1) || "";
      updateSelection();
    }

    function updateSelection() {
      const selected = ctx.getItems().find((item) => item.id === selectedId);
      const textItems = selectedTexts();
      ctx.els.boardWorld.querySelectorAll(".board-item").forEach((node) => {
        const active = selectedIds.has(node.dataset.id);
        node.classList.toggle("is-selected", active);
        node.classList.toggle("is-editing", active && node.dataset.id === editingId);
        node.classList.toggle("is-multi-selected", active && selectedIds.size > 1);
        node.setAttribute("aria-selected", String(active));
      });
      const showTextTools = textItems.length > 0;
      if (ctx.els.boardSelectionToolbar) ctx.els.boardSelectionToolbar.hidden = !showTextTools;
      if (showTextTools) {
        const reference = selected?.type === "text" ? selected : textItems[0];
        const allBold = textItems.every((item) => item.fontWeight >= 600);
        ctx.els.boardFontSize.value = String(reference.fontSize);
        ctx.els.boardBold.setAttribute("aria-pressed", String(allBold));
        ctx.els.boardBold.classList.toggle("is-active", allBold);
        ctx.els.boardTextColor.value = reference.color;
        ctx.els.boardColorPresets?.querySelectorAll("[data-board-text-color]").forEach((swatch) => {
          swatch.classList.toggle("is-active", swatch.dataset.boardTextColor === reference.color);
        });
      }
    }

    function applyFontSize() {
      const item = selectedText() || selectedTexts()[0];
      if (!item) return;
      const fontSize = clamp(
        Math.round(Number(ctx.els.boardFontSize.value) || item.fontSize),
        ctx.model.MIN_FONT_SIZE,
        ctx.model.MAX_FONT_SIZE,
      );
      updateSelectedText((candidate) => {
        const content = findItemNode(candidate.id)?.querySelector(".board-text-content");
        let height = candidate.height;
        if (content) {
          const previousSize = content.style.fontSize;
          content.style.fontSize = `${fontSize}px`;
          height = Math.max(height, Math.ceil(content.scrollHeight));
          content.style.fontSize = previousSize;
        }
        return { fontSize, height };
      });
    }

    function toggleBold() {
      const items = selectedTexts();
      if (!items.length) return;
      const fontWeight = items.every((item) => item.fontWeight >= 600) ? 400 : 700;
      updateSelectedText({ fontWeight });
    }

    function applyTextColor(color) {
      if (!/^#[0-9a-f]{6}$/i.test(String(color || ""))) return;
      updateSelectedText({ color: String(color).toLowerCase() });
    }

    function updateSelectedText(patch) {
      const ids = new Set(selectedTexts().map((item) => item.id));
      if (!ids.size) return;
      pushUndo();
      commit(ctx.getItems().map((candidate) => ids.has(candidate.id)
        ? {
            ...candidate,
            ...(typeof patch === "function" ? patch(candidate) : patch),
            updatedAt: new Date().toISOString(),
          }
        : candidate));
    }

    function selectedText() {
      const item = ctx.getItems().find((candidate) => candidate.id === selectedId);
      return item?.type === "text" ? item : null;
    }

    function selectedTexts() {
      return ctx.getItems().filter((item) => selectedIds.has(item.id) && item.type === "text");
    }

    function focusPrimarySelection() {
      findItemNode(selectedId)?.focus({ preventScroll: true });
    }

    function moveSelectedWithKeyboard(key, distance) {
      if (!selectedIds.size) return;
      const delta = {
        ArrowLeft: { x: -distance, y: 0 },
        ArrowRight: { x: distance, y: 0 },
        ArrowUp: { x: 0, y: -distance },
        ArrowDown: { x: 0, y: distance },
      }[key];
      if (!delta) return;
      pushUndo();
      commit(ctx.getItems().map((candidate) => selectedIds.has(candidate.id)
        ? {
            ...candidate,
            x: candidate.x + delta.x,
            y: candidate.y + delta.y,
            updatedAt: new Date().toISOString(),
          }
        : candidate));
    }

    function commit(items, options = {}) {
      ctx.commitItems(ctx.model.normalizeItems(items, { createId: ctx.createId }), options);
      render();
    }

    async function loadImage(item) {
      const node = findItemNode(item.id);
      const image = node?.querySelector("img");
      const placeholder = node?.querySelector(".board-image-placeholder");
      if (!image) return;
      let url = objectUrls.get(item.assetId);
      try {
        if (!url) {
          const blob = await ctx.assets.resolveBlob(item);
          if (!blob) throw new Error(item.remotePath
            ? "Не удалось загрузить фото из Supabase"
            : "Фото ещё не перенесено в Supabase");
          if (!image.isConnected) return;
          url = cacheImageUrl(item.assetId, blob);
        }
      } catch (error) {
        showBrokenImage(placeholder, error?.message);
        return;
      }

      image.addEventListener("load", () => {
        if (placeholder) {
          placeholder.hidden = true;
          delete placeholder.dataset.state;
        }
      }, { once: true });
      image.addEventListener("error", () => {
        const cachedUrl = objectUrls.get(item.assetId);
        if (cachedUrl === url) {
          URL.revokeObjectURL(cachedUrl);
          objectUrls.delete(item.assetId);
        }
        showBrokenImage(placeholder, "Файл изображения повреждён или недоступен");
      }, { once: true });
      image.src = url;
    }

    function cacheImageUrl(assetId, blob) {
      const previous = objectUrls.get(assetId);
      if (previous) URL.revokeObjectURL(previous);
      const url = URL.createObjectURL(blob);
      objectUrls.set(assetId, url);
      return url;
    }

    function showBrokenImage(placeholder, message) {
      if (!placeholder) return;
      placeholder.hidden = false;
      placeholder.textContent = message || "Не удалось отобразить изображение";
      placeholder.dataset.state = "error";
    }

    function syncLegacyImages(items) {
      items
        .filter((item) => item.type === "image" && !item.remotePath)
        .forEach((item) => {
          const lastAttempt = pendingUploadAttempts.get(item.assetId) || 0;
          if (Date.now() - lastAttempt < 30000) return;
          pendingUploadAttempts.set(item.assetId, Date.now());
          uploadLegacyImage(item);
        });
    }

    async function uploadLegacyImage(item) {
      try {
        const remotePath = await ctx.assets.upload(item);
        if (!remotePath) return;
        const current = ctx.getItems().find((candidate) => candidate.id === item.id);
        if (!current || current.remotePath) return;
        ctx.commitItems(ctx.getItems().map((candidate) => candidate.id === item.id
          ? { ...candidate, remotePath, updatedAt: new Date().toISOString() }
          : candidate), { render: false });
        pendingUploadAttempts.delete(item.assetId);
        setStatus("Старое фото перенесено в Supabase Storage", "cloud");
      } catch (error) {
        setStatus(error.message || "Не удалось перенести фото в Supabase", "error");
      }
    }

    function releaseUnusedObjectUrls(items) {
      const liveIds = new Set(items.filter((item) => item.type === "image").map((item) => item.assetId));
      objectUrls.forEach((url, assetId) => {
        if (liveIds.has(assetId)) return;
        URL.revokeObjectURL(url);
        objectUrls.delete(assetId);
      });
    }

    function showImageError(error) {
      const message = error?.message || "Не удалось загрузить изображение в Supabase";
      setStatus(message, "error");
      ctx.showToast(message);
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
        camera = { x: rect.width / 2 - 180, y: Math.max(100, rect.height / 3), zoom: 1 };
      }
    }

    function applyCamera() {
      if (!camera) return;
      ctx.els.boardWorld.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`;
      ctx.els.boardWorld.style.setProperty("--board-unit", `${1 / camera.zoom}px`);
      ctx.els.boardZoomLabel.textContent = formatZoom(camera.zoom);
      ctx.els.boardViewport.style.setProperty("--board-grid-size", `${Math.max(6, 24 * camera.zoom)}px`);
      ctx.els.boardViewport.style.setProperty("--board-grid-x", `${camera.x}px`);
      ctx.els.boardViewport.style.setProperty("--board-grid-y", `${camera.y}px`);
      ctx.els.boardViewport.classList.toggle("is-grid-hidden", camera.zoom < 0.12);
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

    function findItemNode(id) {
      return ctx.els.boardWorld.querySelector(`[data-id="${cssEscape(id)}"]`);
    }

    function setStatus(message, state = "") {
      if (!ctx.els.boardStatus) return;
      ctx.els.boardStatus.textContent = message;
      ctx.els.boardStatus.dataset.state = state;
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

  function resizeGeometry(item, dx, dy, direction) {
    const minWidth = item.type === "image" ? 40 : 40;
    const minHeight = item.type === "image" ? 40 : 24;
    const maxSize = 10000;
    const hasWest = direction.includes("w");
    const hasEast = direction.includes("e");
    const hasNorth = direction.includes("n");
    const hasSouth = direction.includes("s");
    const isCorner = (hasWest || hasEast) && (hasNorth || hasSouth);

    if (item.type === "image" && isCorner) {
      const rawWidth = clamp(item.width + (hasEast ? dx : -dx), minWidth, maxSize);
      const rawHeight = clamp(item.height + (hasSouth ? dy : -dy), minHeight, maxSize);
      const ratio = item.width / Math.max(item.height, 1);
      const widthChange = Math.abs(rawWidth - item.width) / Math.max(item.width, 1);
      const heightChange = Math.abs(rawHeight - item.height) / Math.max(item.height, 1);
      let width = rawWidth;
      let height = clamp(width / ratio, minHeight, maxSize);
      if (heightChange > widthChange) {
        height = rawHeight;
        width = clamp(height * ratio, minWidth, maxSize);
      }
      return {
        x: hasWest ? item.x + item.width - width : item.x,
        y: hasNorth ? item.y + item.height - height : item.y,
        width,
        height,
      };
    }

    let left = item.x;
    let top = item.y;
    let right = item.x + item.width;
    let bottom = item.y + item.height;
    if (hasWest) left = Math.min(right - minWidth, left + dx);
    if (hasEast) right = Math.max(left + minWidth, right + dx);
    if (hasNorth) top = Math.min(bottom - minHeight, top + dy);
    if (hasSouth) bottom = Math.max(top + minHeight, bottom + dy);
    return {
      x: left,
      y: top,
      width: clamp(right - left, minWidth, maxSize),
      height: clamp(bottom - top, minHeight, maxSize),
    };
  }

  function fitImage(width, height) {
    const scale = Math.min(1, 520 / width, 420 / height);
    return {
      width: Math.max(80, Math.round(width * scale)),
      height: Math.max(80, Math.round(height * scale)),
    };
  }

  function applyNodeGeometry(node, item) {
    node.style.width = `${item.width}px`;
    node.style.height = `${item.height}px`;
    node.style.transform = `translate(${item.x}px, ${item.y}px)`;
    node.style.zIndex = String(item.z);
  }

  function editableText(node) {
    return String(node.innerText || node.textContent || "")
      .replace(/\u00a0/g, " ")
      .replace(/\r\n?/g, "\n")
      .slice(0, 20000);
  }

  function placeCaretAtEnd(node) {
    const selection = global.getSelection?.();
    if (!selection) return;
    const range = global.document.createRange();
    range.selectNodeContents(node);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function formatZoom(zoom) {
    const percent = zoom * 100;
    return percent < 10 ? `${percent.toFixed(1)}%` : `${Math.round(percent)}%`;
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

  const api = {
    MAX_ZOOM,
    MIN_ZOOM,
    createBoardView,
    fitImage,
    resizeGeometry,
  };
  global.RhythmBoardView = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
