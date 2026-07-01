import type { ComponentPublicInstance, ShallowRef, EmitFn } from "vue";
import { computed, onBeforeUnmount, shallowRef, unref, watch } from "vue";
import {
  navigateTo,
  onClickOutside,
  useDebounceFn,
  useElementSize,
  useEventListener,
  useMutationObserver,
  useRoute,
} from "#imports";
import { useMediaViewerCache } from "./useMediaViewerCache";
import type MediaViewerSlide from "../../components/MediaViewerSlide.vue";
import type {
  MediaViewerCaptionPlacement,
  MediaViewerItem,
  MediaViewerMediaLayoutHint,
} from "../../types/media-viewer.types";
import {
  chooseCaptionPlacement,
  getAspectRatioFromSize,
  getDefaultMediaAspectRatio,
  getMediaAspectRatio,
  resolveDownloadUrl,
  resolveMediaLayoutHint,
  wrapIndex,
} from "../../lib/viewer/media-viewer.utils";

import type {
  MediaViewerGalleryProps,
  MediaViewerGalleryEmits,
  MediaViewerGallerySlots,
} from "../../components/MediaViewerGallery.vue";

type UseMediaViewerGalleryOptions<TItem extends MediaViewerItem> = {
  props: MediaViewerGalleryProps<TItem>;
  emit: EmitFn<MediaViewerGalleryEmits>;
  slots: MediaViewerGallerySlots;
  refs: {
    viewportRef: Readonly<ShallowRef<HTMLDivElement | null>>;
    captionRef: Readonly<ShallowRef<HTMLElement | null>>;
    slideRef: Readonly<
      ShallowRef<InstanceType<typeof MediaViewerSlide> | null>
    >;
    customSlideMediaWrapperRef: Readonly<ShallowRef<HTMLElement | null>>;
    modalCounterRef: Readonly<ShallowRef<HTMLDivElement | null>>;
    downloadBtnRef: Readonly<ShallowRef<HTMLButtonElement | null>>;
    zoomToggleRef: Readonly<ShallowRef<HTMLButtonElement | null>>;
    closeBtnRef: Readonly<ShallowRef<HTMLButtonElement | null>>;
    prevBtnRef: Readonly<ShallowRef<HTMLButtonElement | null>>;
    nextBtnRef: Readonly<ShallowRef<HTMLButtonElement | null>>;
  };
};

type MaybeExposedElement =
  | HTMLElement
  | ShallowRef<HTMLElement | null>
  | null
  | undefined;

function resolveMaybeExposedElement(
  value: MaybeExposedElement,
): HTMLElement | null {
  return unref(value) ?? null;
}

function resolveElement(
  value: Element | ComponentPublicInstance | null,
): HTMLElement | null {
  if (!value || typeof HTMLElement === "undefined") return null;
  if (value instanceof HTMLElement) return value;

  const element = (value as ComponentPublicInstance).$el;

  return element instanceof HTMLElement ? element : null;
}

export function useMediaViewerGallery<
  TItem extends MediaViewerItem = MediaViewerItem,
>(options: UseMediaViewerGalleryOptions<TItem>) {
  const { props, emit, slots, refs } = options;
  const route = useRoute();
  const cache = useMediaViewerCache();

  const modalOpen = shallowRef(false);
  const activeIndex = shallowRef(0);
  const zoom = shallowRef(1);
  const previousScrollY = shallowRef(0);
  const lastDirection = shallowRef<"next" | "previous">("next");
  const customMediaElement = shallowRef<HTMLElement | null>(null);

  const { width: viewportWidth, height: viewportHeight } = useElementSize(
    refs.viewportRef,
  );
  const { width: captionWidth, height: captionHeight } = useElementSize(
    refs.captionRef,
  );

  const hasCustomSlideMediaSlot = computed(() => Boolean(slots["slide-media"]));
  const shouldBeOpen = computed(
    () =>
      route.query.gallery === props.galleryKey
      && typeof route.query.slide === "string",
  );
  const activeItem = computed<TItem | null>(
    () => props.items[activeIndex.value] ?? null,
  );
  const totalSlides = computed(() => props.items.length);
  const currentSlideOneBased = computed(() =>
    activeItem.value ? activeIndex.value + 1 : 0,
  );

  const defaultSlideMediaElement = computed(() => {
    return resolveMaybeExposedElement(
      refs.slideRef.value?.mediaElementRef as MaybeExposedElement,
    );
  });

  const mediaElementRef = computed<HTMLElement | null>(() => {
    if (customMediaElement.value) return customMediaElement.value;
    if (
      hasCustomSlideMediaSlot.value
      && refs.customSlideMediaWrapperRef.value
    ) {
      return refs.customSlideMediaWrapperRef.value;
    }

    return defaultSlideMediaElement.value;
  });

  const { width: mediaElementWidth, height: mediaElementHeight } =
    useElementSize(mediaElementRef);

  const currentMediaLayout = computed<MediaViewerMediaLayoutHint>(() => {
    const item = activeItem.value;
    const measuredWidth =
      mediaElementWidth.value > 0 ? mediaElementWidth.value : undefined;
    const measuredHeight =
      mediaElementHeight.value > 0 ? mediaElementHeight.value : undefined;
    const measuredAspectRatio = getAspectRatioFromSize(
      measuredWidth,
      measuredHeight,
    );

    if (!item) {
      return resolveMediaLayoutHint(null, {
        kind: "custom",
        width: measuredWidth,
        height: measuredHeight,
        aspectRatio: measuredAspectRatio,
      });
    }

    const layoutKind = hasCustomSlideMediaSlot.value
      ? (item.viewerLayout?.kind ?? "custom")
      : item.kind;

    return resolveMediaLayoutHint(item, {
      kind: layoutKind,
      width: measuredWidth,
      height: measuredHeight,
      aspectRatio:
        measuredAspectRatio
        ?? item.viewerLayout?.aspectRatio
        ?? getMediaAspectRatio(item)
        ?? getDefaultMediaAspectRatio(layoutKind),
    });
  });

  const currentCaptionPlacement = computed<MediaViewerCaptionPlacement>(() => {
    const layout = currentMediaLayout.value;

    return chooseCaptionPlacement({
      containerWidth: viewportWidth.value,
      containerHeight: viewportHeight.value,
      mediaKind: layout.kind,
      mediaAspectRatio: layout.aspectRatio,
      mediaWidth: layout.width,
      mediaHeight: layout.height,
      preferredPlacement: layout.preferredCaptionPlacement,
      minSideWidth: layout.minSideWidth,
      maxSideWidth: layout.maxSideWidth,
      minMainWidth: layout.minMainWidth,
      gap: layout.gap,
    });
  });

  const hasSlideCaption = computed(() => {
    const item = activeItem.value;

    if (!item) return false;

    return Boolean(item.slideCaption || slots["slide-caption"]);
  });
  const showSlideCaption = computed(() =>
    Boolean(activeItem.value && hasSlideCaption.value && zoom.value === 1),
  );
  const currentDownloadUrl = computed(() =>
    activeItem.value ? resolveDownloadUrl(activeItem.value) : undefined,
  );

  function cleanQuery(): Record<string, string | string[]> {
    const nextQuery: Record<string, string | string[]> = {
      ...route.query,
    } as Record<string, string | string[]>;

    delete nextQuery.gallery;
    delete nextQuery.slide;

    return nextQuery;
  }

  async function pushRoute(index: number): Promise<void> {
    await navigateTo(
      {
        path: route.path,
        query: {
          ...cleanQuery(),
          gallery: props.galleryKey,
          slide: String(index + 1),
        },
        hash: route.hash,
      },
      { replace: true },
    );
  }

  function restoreScrollPosition(): void {
    if (!import.meta.client) return;

    const y = previousScrollY.value;

    requestAnimationFrame(() => {
      window.scrollTo({ top: y, left: 0, behavior: "auto" });
    });
  }

  function resetZoom() {
    zoom.value = 1;
  }

  function preloadMediaAsset(item: MediaViewerItem): void {
    if (!import.meta.client) return;

    if (item.kind === "image") {
      const image = new Image();
      image.decoding = "async";
      image.loading = "eager";
      image.src = item.src;

      if (item.srcSet) image.srcset = item.srcSet;
      return;
    }

    if ((item.kind === "video" || item.kind === "audio") && item.poster) {
      const image = new Image();
      image.decoding = "async";
      image.src = item.poster;
    }
  }

  const warmWindow = useDebounceFn((centerIndex: number) => {
    if (props.items.length === 0) return;

    const radius = Math.floor((props.virtualWindowSize ?? 5) / 2);
    const ids: string[] = [];

    for (let offset = -radius; offset <= radius; offset += 1) {
      const index = wrapIndex(centerIndex + offset, props.items.length);
      const item = props.items[index];

      if (!item) continue;

      ids.push(item.id);
      cache.primeItem(item);
      preloadMediaAsset(item);
    }

    emit("metric", {
      type: "preload",
      galleryKey: props.galleryKey,
      slideId: activeItem.value?.id,
      index: centerIndex,
      url: ids.join(","),
    });
  }, 50);

  function warmCurrentWindow(): void {
    warmWindow(activeIndex.value);
  }

  function syncFromRoute(): void {
    if (!shouldBeOpen.value || props.items.length === 0) {
      modalOpen.value = false;
      return;
    }

    const parsed = Number.parseInt(String(route.query.slide ?? "1"), 10);
    const nextIndex = Number.isFinite(parsed) ? parsed - 1 : 0;

    activeIndex.value = wrapIndex(nextIndex, props.items.length);
    modalOpen.value = true;
    warmCurrentWindow();
  }

  function openAt(index: number): void {
    if (props.items.length === 0) return;

    previousScrollY.value = import.meta.client ? window.scrollY : 0;
    activeIndex.value = wrapIndex(index, props.items.length);
    modalOpen.value = true;
    lastDirection.value = "next";

    void pushRoute(activeIndex.value);
    warmCurrentWindow();
    emit("metric", {
      type: "open",
      galleryKey: props.galleryKey,
      slideId: activeItem.value?.id,
      index: activeIndex.value,
    });
  }

  async function closeViewer(): Promise<void> {
    const closingItem = activeItem.value;
    const closingIndex = activeIndex.value;

    if (!shouldBeOpen.value) {
      modalOpen.value = false;
      resetZoom();
      return;
    }

    await navigateTo(
      {
        path: route.path,
        query: cleanQuery(),
        hash: route.hash,
      },
      { replace: true },
    );

    modalOpen.value = false;
    resetZoom();
    customMediaElement.value = null;
    emit("metric", {
      type: "close",
      galleryKey: props.galleryKey,
      slideId: closingItem?.id,
      index: closingIndex,
    });

    restoreScrollPosition();
  }

  function goToIndex(index: number): void {
    if (props.items.length === 0) return;

    const previousIndex = activeIndex.value;
    const nextIndex = wrapIndex(index, props.items.length);
    const direction = index > previousIndex ? "next" : "previous";

    if (nextIndex === previousIndex) return;

    lastDirection.value = direction;
    activeIndex.value = nextIndex;
    customMediaElement.value = null;
    resetZoom();

    void pushRoute(nextIndex);
    warmCurrentWindow();

    emit("metric", {
      type: "slide-change",
      galleryKey: props.galleryKey,
      slideId: activeItem.value?.id,
      index: nextIndex,
      direction,
    });
  }

  function nextSlide(): void {
    goToIndex(activeIndex.value + 1);
  }

  function previousSlide(): void {
    goToIndex(activeIndex.value - 1);
  }

  function firstSlide(): void {
    goToIndex(0);
  }

  function lastSlide(): void {
    goToIndex(props.items.length - 1);
  }

  function onDownload(): void {
    const url = currentDownloadUrl.value;

    if (!url || !import.meta.client) return;

    emit("metric", {
      type: "download",
      galleryKey: props.galleryKey,
      slideId: activeItem.value?.id,
      index: activeIndex.value,
      url,
    });
  }

  function onZoomUpdate(nextZoom: number): void {
    zoom.value = Math.max(1, Math.min(nextZoom, props.maxZoom ?? 3));

    emit("metric", {
      type: "zoom-change",
      galleryKey: props.galleryKey,
      slideId: activeItem.value?.id,
      index: activeIndex.value,
      zoom: zoom.value,
    });
  }

  function shouldIgnoreKeyboardEvent(event: KeyboardEvent) {
    const target = event.target;

    if (!(target instanceof HTMLElement)) return false;

    return Boolean(
      target.closest(
        "input, textarea, select, button, [contenteditable='true'], audio, video",
      ),
    );
  }

  function onKeydown(event: KeyboardEvent): void {
    if (!modalOpen.value || shouldIgnoreKeyboardEvent(event)) return;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      nextSlide();
      return;
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      previousSlide();
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      firstSlide();
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      lastSlide();
    }
  }

  function onModalUpdateOpen(value: boolean): void {
    modalOpen.value = value;

    if (!value) void closeViewer();
  }

  function setCustomMediaElement(
    value: Element | ComponentPublicInstance | null,
  ) {
    customMediaElement.value = resolveElement(value);
  }

  watch(
    shouldBeOpen,
    (value) => {
      if (!value) {
        modalOpen.value = false;
        customMediaElement.value = null;
        return;
      }

      syncFromRoute();
    },
    { immediate: true },
  );

  watch(
    () => props.items.length,
    (length) => {
      if (length === 0) {
        modalOpen.value = false;
        activeIndex.value = 0;
        resetZoom();
        return;
      }

      if (activeIndex.value > length - 1) activeIndex.value = length - 1;
      if (shouldBeOpen.value) syncFromRoute();
    },
  );

  watch(activeIndex, (newIndex, previousIndex) => {
    if (newIndex !== previousIndex) {
      resetZoom();
      customMediaElement.value = null;
    }
  });

  watch(
    [
      viewportWidth,
      viewportHeight,
      captionWidth,
      captionHeight,
      mediaElementWidth,
      mediaElementHeight,
    ],
    () => {
      if (modalOpen.value) warmCurrentWindow();
    },
  );

  useMutationObserver(
    refs.captionRef,
    () => {
      if (modalOpen.value) warmCurrentWindow();
    },
    { childList: true, subtree: true, characterData: true },
  );

  if (import.meta.client) {
    useEventListener(window, "keydown", onKeydown);
  }

  onClickOutside(
    mediaElementRef,
    () => {
      if (modalOpen.value) void closeViewer();
    },
    {
      ignore: [
        refs.modalCounterRef,
        refs.downloadBtnRef,
        refs.zoomToggleRef,
        refs.closeBtnRef,
        refs.prevBtnRef,
        refs.nextBtnRef,
        refs.captionRef,
      ],
    },
  );

  onBeforeUnmount(() => {
    modalOpen.value = false;
  });

  return {
    modalOpen,
    activeIndex,
    zoom,
    previousScrollY,
    lastDirection,
    customMediaElement,
    viewportWidth,
    viewportHeight,
    captionWidth,
    captionHeight,
    mediaElementWidth,
    mediaElementHeight,
    hasCustomSlideMediaSlot,
    shouldBeOpen,
    activeItem,
    totalSlides,
    currentSlideOneBased,
    defaultSlideMediaElement,
    mediaElementRef,
    currentMediaLayout,
    currentCaptionPlacement,
    hasSlideCaption,
    showSlideCaption,
    currentDownloadUrl,
    syncFromRoute,
    openAt,
    closeViewer,
    goToIndex,
    nextSlide,
    previousSlide,
    firstSlide,
    lastSlide,
    onDownload,
    onZoomUpdate,
    resetZoom,
    warmCurrentWindow,
    setCustomMediaElement,
    onModalUpdateOpen,
  };
}
