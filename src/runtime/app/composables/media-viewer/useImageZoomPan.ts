import type { MaybeRefOrGetter, Ref } from "vue";
import { computed, shallowRef, toValue, watch } from "vue";
import { useEventListener } from "#imports";

type ZoomPanMetricPayload = {
  type: "zoom-change";
  zoom: number;
  slideId?: string;
};

type UseImageZoomPanOptions = {
  active: MaybeRefOrGetter<boolean>;
  enabled: MaybeRefOrGetter<boolean>;
  supportsPan?: MaybeRefOrGetter<boolean>;
  stageRef: Ref<HTMLElement | null>;
  zoom: MaybeRefOrGetter<number>;
  maxZoom: MaybeRefOrGetter<number>;
  baseWidth: MaybeRefOrGetter<number>;
  baseHeight: MaybeRefOrGetter<number>;
  slideId?: MaybeRefOrGetter<string | undefined>;
  emitZoom: (value: number) => void;
  emitMetric?: (payload: ZoomPanMetricPayload) => void;
};

type PointerSnapshot = {
  id: number;
  clientX: number;
  clientY: number;
};

function distance(a: PointerSnapshot, b: PointerSnapshot) {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

function midpoint(a: PointerSnapshot, b: PointerSnapshot) {
  return {
    x: (a.clientX + b.clientX) / 2,
    y: (a.clientY + b.clientY) / 2,
  };
}

export function useImageZoomPan(options: UseImageZoomPanOptions) {
  const panX = shallowRef(0);
  const panY = shallowRef(0);
  const isDragging = shallowRef(false);
  const isPinching = shallowRef(false);
  const pointers = new Map<number, PointerSnapshot>();
  const dragPointerId = shallowRef<number | null>(null);
  const dragStartX = shallowRef(0);
  const dragStartY = shallowRef(0);
  const dragOriginX = shallowRef(0);
  const dragOriginY = shallowRef(0);
  const pinchStartDistance = shallowRef(0);
  const pinchStartZoom = shallowRef(1);
  const pinchStartMidpoint = shallowRef({ x: 0, y: 0 });
  const lastTapAt = shallowRef(0);
  const lastTapX = shallowRef(0);
  const lastTapY = shallowRef(0);

  const touchAction = computed(() => (toValue(options.enabled) ? "none" : "auto"));

  function clampZoom(value: number) {
    return Math.max(1, Math.min(value, toValue(options.maxZoom)));
  }

  function maxPanForZoom(zoom: number) {
    const renderedWidth = toValue(options.baseWidth) * zoom;
    const renderedHeight = toValue(options.baseHeight) * zoom;
    const stage = options.stageRef.value;
    const stageWidth = stage?.clientWidth ?? 0;
    const stageHeight = stage?.clientHeight ?? 0;

    return {
      x: Math.max(0, (renderedWidth - stageWidth) / 2),
      y: Math.max(0, (renderedHeight - stageHeight) / 2),
    };
  }

  function clampPanXY(x: number, y: number, zoom: number) {
    const limit = maxPanForZoom(zoom);

    return {
      x: Math.max(-limit.x, Math.min(x, limit.x)),
      y: Math.max(-limit.y, Math.min(y, limit.y)),
    };
  }

  function resetPan() {
    panX.value = 0;
    panY.value = 0;
  }

  function emitMetric(zoom: number) {
    options.emitMetric?.({
      type: "zoom-change",
      zoom,
      slideId: toValue(options.slideId),
    });
  }

  function setZoom(nextZoom: number) {
    const normalized = clampZoom(nextZoom);

    options.emitZoom(normalized);
    emitMetric(normalized);

    if (normalized === 1) {
      resetPan();
      return;
    }

    const nextPan = clampPanXY(panX.value, panY.value, normalized);
    panX.value = nextPan.x;
    panY.value = nextPan.y;
  }

  function zoomAt(clientX: number, clientY: number, nextZoom: number) {
    const stage = options.stageRef.value;

    if (!stage || !toValue(options.enabled)) return;

    const rect = stage.getBoundingClientRect();
    const viewportX = clientX - (rect.left + rect.width / 2);
    const viewportY = clientY - (rect.top + rect.height / 2);
    const currentZoom = toValue(options.zoom);
    const normalizedZoom = clampZoom(nextZoom);

    if (currentZoom === normalizedZoom) return;

    const zoomRatio = normalizedZoom / currentZoom;
    const nextX = zoomRatio * panX.value + (1 - zoomRatio) * viewportX;
    const nextY = zoomRatio * panY.value + (1 - zoomRatio) * viewportY;
    const nextPan = clampPanXY(nextX, nextY, normalizedZoom);

    options.emitZoom(normalizedZoom);
    panX.value = nextPan.x;
    panY.value = nextPan.y;
    emitMetric(normalizedZoom);

    if (normalizedZoom === 1) resetPan();
  }

  function toggleZoomAt(clientX?: number, clientY?: number) {
    if (!toValue(options.enabled)) return;

    const targetZoom = toValue(options.zoom) === 1 ? Math.min(2, toValue(options.maxZoom)) : 1;

    if (clientX != null && clientY != null) {
      zoomAt(clientX, clientY, targetZoom);
      return;
    }

    setZoom(targetZoom);
  }

  function startDrag(pointer: PointerSnapshot) {
    if (!toValue(options.supportsPan ?? true) || toValue(options.zoom) === 1) return;

    dragPointerId.value = pointer.id;
    dragStartX.value = pointer.clientX;
    dragStartY.value = pointer.clientY;
    dragOriginX.value = panX.value;
    dragOriginY.value = panY.value;
    isDragging.value = true;
  }

  function startPinch() {
    const activePointers = [...pointers.values()];

    if (activePointers.length < 2) return;

    isDragging.value = false;
    isPinching.value = true;
    pinchStartDistance.value = distance(activePointers[0]!, activePointers[1]!);
    pinchStartZoom.value = toValue(options.zoom);
    pinchStartMidpoint.value = midpoint(activePointers[0]!, activePointers[1]!);
  }

  function onWheel(event: WheelEvent) {
    if (!toValue(options.active) || !toValue(options.enabled) || !event.ctrlKey) return;

    event.preventDefault();

    const direction = event.deltaY > 0 ? -1 : 1;
    zoomAt(event.clientX, event.clientY, toValue(options.zoom) + direction * 0.12);
  }

  function onPointerDown(event: PointerEvent) {
    if (!toValue(options.active) || !toValue(options.enabled) || event.button !== 0) return;

    const stage = options.stageRef.value;

    pointers.set(event.pointerId, {
      id: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
    });
    stage?.setPointerCapture(event.pointerId);

    if (pointers.size === 1) {
      lastTapX.value = event.clientX;
      lastTapY.value = event.clientY;
      startDrag(pointers.get(event.pointerId)!);
      return;
    }

    if (pointers.size === 2) startPinch();
  }

  function onPointerMove(event: PointerEvent) {
    if (!pointers.has(event.pointerId)) return;

    pointers.set(event.pointerId, {
      id: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
    });

    if (isPinching.value && pointers.size >= 2) {
      event.preventDefault();
      const activePointers = [...pointers.values()];
      const nextDistance = distance(activePointers[0]!, activePointers[1]!);
      const nextMidpoint = midpoint(activePointers[0]!, activePointers[1]!);
      const ratio = nextDistance / Math.max(pinchStartDistance.value, 1);

      zoomAt(nextMidpoint.x, nextMidpoint.y, pinchStartZoom.value * ratio);
      pinchStartMidpoint.value = nextMidpoint;
      return;
    }

    if (!isDragging.value || dragPointerId.value !== event.pointerId) return;

    event.preventDefault();
    const nextX = dragOriginX.value + (event.clientX - dragStartX.value);
    const nextY = dragOriginY.value + (event.clientY - dragStartY.value);
    const nextPan = clampPanXY(nextX, nextY, toValue(options.zoom));

    panX.value = nextPan.x;
    panY.value = nextPan.y;
  }

  function onPointerEnd(event: PointerEvent) {
    const hadPointer = pointers.delete(event.pointerId);

    if (!hadPointer) return;

    options.stageRef.value?.releasePointerCapture?.(event.pointerId);

    if (isPinching.value && pointers.size < 2) {
      isPinching.value = false;
    }

    if (dragPointerId.value === event.pointerId) {
      dragPointerId.value = null;
      isDragging.value = false;
    }

    if (event.pointerType === "touch" && pointers.size === 0 && !isPinching.value) {
      const now = Date.now();

      if (now - lastTapAt.value < 280) {
        toggleZoomAt(lastTapX.value, lastTapY.value);
        lastTapAt.value = 0;
        return;
      }

      lastTapAt.value = now;
    }
  }

  function onDblClick(event: MouseEvent) {
    toggleZoomAt(event.clientX, event.clientY);
  }

  useEventListener(options.stageRef, "wheel", onWheel, { passive: false });
  useEventListener(options.stageRef, "pointerdown", onPointerDown);
  useEventListener(options.stageRef, "pointermove", onPointerMove, { passive: false });
  useEventListener(options.stageRef, "pointerup", onPointerEnd);
  useEventListener(options.stageRef, "pointercancel", onPointerEnd);
  useEventListener(options.stageRef, "dblclick", onDblClick);

  watch(
    () => toValue(options.zoom),
    (zoom) => {
      if (zoom === 1) {
        resetPan();
        return;
      }

      const nextPan = clampPanXY(panX.value, panY.value, zoom);
      panX.value = nextPan.x;
      panY.value = nextPan.y;
    },
  );

  return {
    panX,
    panY,
    isDragging,
    isPinching,
    touchAction,
    setZoom,
    zoomAt,
    toggleZoomAt,
    resetPan,
    clampPanXY,
  };
}
