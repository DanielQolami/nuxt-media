import type { ShallowRef, EmitFn, ComputedRef } from "vue";
import { computed, shallowRef, unref, watch } from "vue";
import { useElementSize } from "#imports";
import type MediaAudioPlayer from "../../components/MediaAudioPlayer.vue";
import type MediaVideoPlayer from "../../components/MediaVideoPlayer.vue";
import type {
  MediaViewerItem,
  MediaViewerKind,
  MediaViewerMediaLayoutHint,
} from "../../types/media-viewer.types";
import {
  createMediaSessionMetadataFromViewerItem,
  getMediaAspectRatio,
  resolveMediaLayoutHint,
} from "../../lib/viewer/media-viewer.utils";
import { useImageZoomPan } from "./useImageZoomPan";
import { useMediaElementMeasurements } from "./useMediaElementMeasurements";
import type { MediaViewerSlideEmits } from "../../components/MediaViewerSlide.vue";

type MediaViewerRendererDefinition = {
  kind: MediaViewerKind;
  supportsZoom: boolean;
  supportsPan: boolean;
  supportsNativePlayback: boolean;
  fallbackAspectRatio: number | null;
  getLayoutHint: (item: MediaViewerItem) => MediaViewerMediaLayoutHint;
};

const MEDIA_VIEWER_RENDERERS = {
  image: {
    kind: "image",
    supportsZoom: true,
    supportsPan: true,
    supportsNativePlayback: false,
    fallbackAspectRatio: 4 / 3,
    getLayoutHint: (item) => resolveMediaLayoutHint(item, { kind: "image" }),
  },
  video: {
    kind: "video",
    supportsZoom: false,
    supportsPan: false,
    supportsNativePlayback: true,
    fallbackAspectRatio: 16 / 9,
    getLayoutHint: (item) =>
      resolveMediaLayoutHint(item, {
        kind: "video",
        aspectRatio: getMediaAspectRatio(item) ?? 16 / 9,
      }),
  },
  audio: {
    kind: "audio",
    supportsZoom: false,
    supportsPan: false,
    supportsNativePlayback: true,
    fallbackAspectRatio: null,
    getLayoutHint: (item) =>
      resolveMediaLayoutHint(item, { kind: "audio", minMainWidth: 360 }),
  },
  map: {
    kind: "map",
    supportsZoom: false,
    supportsPan: false,
    supportsNativePlayback: false,
    fallbackAspectRatio: 16 / 9,
    getLayoutHint: (item) =>
      resolveMediaLayoutHint(item, {
        kind: "map",
        aspectRatio: getMediaAspectRatio(item) ?? 16 / 9,
      }),
  },
  pdf: {
    kind: "pdf",
    supportsZoom: false,
    supportsPan: false,
    supportsNativePlayback: false,
    fallbackAspectRatio: 3 / 4,
    getLayoutHint: (item) =>
      resolveMediaLayoutHint(item, {
        kind: "pdf",
        aspectRatio: getMediaAspectRatio(item) ?? 3 / 4,
      }),
  },
} satisfies Record<MediaViewerKind, MediaViewerRendererDefinition>;

type UseMediaViewerSlideOptions = {
  item: ComputedRef<MediaViewerItem>;
  active: ShallowRef<boolean>;
  preload: ShallowRef<boolean>;
  zoom: ShallowRef<number>;
  maxZoom: ShallowRef<number>;
  emit: EmitFn<MediaViewerSlideEmits>;
  refs: {
    stageRef: Readonly<ShallowRef<HTMLDivElement | null>>;
    imageElementRef: Readonly<ShallowRef<HTMLImageElement | null>>;
    imageSkeletonRef: Readonly<ShallowRef<HTMLElement | null>>;
    audioCardRef: Readonly<ShallowRef<HTMLElement | null>>;
    fallbackMediaRef: Readonly<ShallowRef<HTMLElement | null>>;
    videoPlayerRef: Readonly<
      ShallowRef<InstanceType<typeof MediaVideoPlayer> | null>
    >;
    audioPlayerRef: Readonly<
      ShallowRef<InstanceType<typeof MediaAudioPlayer> | null>
    >;
  };
};

type MaybeExposedElement =
  | HTMLElement
  | ShallowRef<HTMLElement | null>
  | null
  | undefined;

function resolveExposedElement(value: MaybeExposedElement): HTMLElement | null {
  return unref(value) ?? null;
}

export function useMediaViewerSlide(options: UseMediaViewerSlideOptions) {
  const loaded = shallowRef(false);
  const {
    stageRef,
    imageElementRef,
    imageSkeletonRef,
    audioCardRef,
    fallbackMediaRef,
    videoPlayerRef,
    audioPlayerRef,
  } = options.refs;
  const { width: stageWidth, height: stageHeight } = useElementSize(stageRef);

  const currentRenderer = computed(
    () => MEDIA_VIEWER_RENDERERS[options.item.value.kind],
  );
  const imageItem = computed(() =>
    options.item.value.kind === "image" ? options.item.value : null,
  );
  const videoItem = computed(() =>
    options.item.value.kind === "video" ? options.item.value : null,
  );
  const audioItem = computed(() =>
    options.item.value.kind === "audio" ? options.item.value : null,
  );
  const supportsZoom = computed(() => currentRenderer.value.supportsZoom);
  const supportsPan = computed(() => currentRenderer.value.supportsPan);

  const declaredImageDimensions = computed(() => ({
    width: imageItem.value?.width,
    height: imageItem.value?.height,
    aspectRatio: getMediaAspectRatio(imageItem.value),
  }));

  const imageMeasurements = useMediaElementMeasurements(imageElementRef, {
    fallbackDimensions: declaredImageDimensions,
  });

  const imageAspect = computed(() => {
    return (
      imageMeasurements.measuredDimensions.value.aspectRatio ??
      currentRenderer.value.fallbackAspectRatio
    );
  });

  const mediaSessionMetadata = computed(() =>
    createMediaSessionMetadataFromViewerItem(options.item.value),
  );

  const rendererLayoutHint = computed(() => {
    const base = currentRenderer.value.getLayoutHint(options.item.value);

    if (options.item.value.kind === "image") {
      return resolveMediaLayoutHint(options.item.value, {
        ...base,
        width: imageMeasurements.measuredDimensions.value.width,
        height: imageMeasurements.measuredDimensions.value.height,
        aspectRatio: imageAspect.value,
      });
    }

    return base;
  });

  const mediaElementRef = computed<HTMLElement | null>(() => {
    if (options.item.value.kind === "image") {
      return imageElementRef.value ?? imageSkeletonRef.value ?? null;
    }

    if (options.item.value.kind === "video") {
      return resolveExposedElement(
        videoPlayerRef.value?.rootElementRef as MaybeExposedElement,
      );
    }

    if (options.item.value.kind === "audio") {
      return (
        audioCardRef.value ??
        resolveExposedElement(
          audioPlayerRef.value?.audioElementRef as MaybeExposedElement,
        )
      );
    }

    return fallbackMediaRef.value ?? null;
  });

  const baseImageWidth = computed(() => {
    if (!supportsZoom.value || !imageAspect.value) return 0;

    const viewportPadding = 32;
    const availableWidth = Math.max(stageWidth.value - viewportPadding, 1);
    const availableHeight = Math.max(stageHeight.value - viewportPadding, 1);

    return Math.min(availableWidth, availableHeight * imageAspect.value);
  });

  const baseImageHeight = computed(() => {
    if (!supportsZoom.value || !imageAspect.value) return 0;

    return baseImageWidth.value / imageAspect.value;
  });

  const imageBoxStyle = computed(() => {
    if (!supportsZoom.value || !imageAspect.value) return {};

    return {
      width: `${Math.round(baseImageWidth.value)}px`,
      height: `${Math.round(baseImageHeight.value)}px`,
    };
  });

  const zoomPan = useImageZoomPan({
    active: options.active,
    enabled: supportsZoom,
    supportsPan,
    stageRef,
    zoom: options.zoom,
    maxZoom: options.maxZoom,
    baseWidth: baseImageWidth,
    baseHeight: baseImageHeight,
    slideId: computed(() => options.item.value.id),
    emitZoom: (value) => options.emit("update:zoom", value),
    emitMetric: (payload) => options.emit("metric", payload),
  });

  function onImageLoad(event: Event) {
    imageMeasurements.onImageLoad(event);
    loaded.value = true;
  }

  function onImageError() {
    loaded.value = true;
  }

  watch(
    () => options.item.value.id,
    () => {
      loaded.value = false;
      zoomPan.resetPan();
      imageMeasurements.refreshIntrinsicSize();
    },
    { flush: "post" },
  );

  return {
    MEDIA_VIEWER_RENDERERS,
    loaded,
    stageWidth,
    stageHeight,
    currentRenderer,
    imageItem,
    videoItem,
    audioItem,
    supportsZoom,
    supportsPan,
    imageAspect,
    imageMeasurements,
    mediaSessionMetadata,
    rendererLayoutHint,
    mediaElementRef,
    baseImageWidth,
    baseImageHeight,
    imageBoxStyle,
    onImageLoad,
    onImageError,
    ...zoomPan,
  };
}

export type { MediaViewerRendererDefinition };
