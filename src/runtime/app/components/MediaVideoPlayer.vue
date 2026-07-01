<script setup lang="ts">
import { useElementHover, useFocusWithin, onKeyStroke } from "#imports";
import {
  computed,
  nextTick,
  shallowRef,
  useTemplateRef,
  watch,
  onBeforeUnmount,
  useId,
} from "vue";
import type {
  MediaArtworkSource,
  ShakaPlayerInstance,
  MediaVideoPlayerProps,
} from "../types/media.types";
import { normalizeMediaSessionMetadata } from "../lib/viewer/media-viewer.utils";
import {
  useMediaPlayerQuality,
  type QualityOption,
} from "../composables/media/useMediaPlayerQuality";
import { useVideoPlayer } from "../composables/useVideoPlayer";
import { cn } from "../utils/cn.utils";

interface MediaVideoPlayerEmits {
  "ready": [player: ShakaPlayerInstance];
  "loaded": [player: ShakaPlayerInstance];
  "error": [error: Error];
  "quality-change": [option: QualityOption];
  "metadata-loaded": [event: Event];
}

const props = withDefaults(defineProps<MediaVideoPlayerProps>(), {
  src: null,
  sources: () => [],
  mimeType: null,
  autoplay: false,
  controls: true,
  loop: false,
  muted: false,
  playsinline: true,
  preload: "metadata",
  showQualitySelector: true,
});

const emit = defineEmits<MediaVideoPlayerEmits>();

const rootElementRef = useTemplateRef<HTMLDivElement>("root-ref");
const videoElementRef = useTemplateRef<HTMLVideoElement>("video-element-ref");
const qualitySelectorRef = useTemplateRef<HTMLDivElement>(
  "quality-selector-ref",
);
const qualitySelectId = `media-video-quality-${useId()}`;

const isHovered = useElementHover(rootElementRef);
const { focused: isFocusWithin } = useFocusWithin(rootElementRef);

const isTouchControlsVisible = shallowRef(false);
const isQualityMenuOpen = shallowRef(false);
let touchControlsTimer: ReturnType<typeof setTimeout> | undefined;

function showTouchControls() {
  isTouchControlsVisible.value = true;

  if (touchControlsTimer) {
    clearTimeout(touchControlsTimer);
  }

  touchControlsTimer = setTimeout(() => {
    isTouchControlsVisible.value = false;
  }, 2500);
}

function blurQualitySelector() {
  nextTick(() => {
    const active = document.activeElement as HTMLElement | null;

    if (active && qualitySelectorRef.value?.contains(active)) {
      active.blur();
    }
  });
}

function closeQualityMenu() {
  isQualityMenuOpen.value = false;
  blurQualitySelector();
}

function onRootPointerDown(event: PointerEvent) {
  if (event.pointerType !== "touch") return;

  const target = event.target as Node | null;
  const clickedInsideQualitySelector =
    !!target && !!qualitySelectorRef.value?.contains(target);

  if (isQualityMenuOpen.value && !clickedInsideQualitySelector) {
    closeQualityMenu();
    showTouchControls();
    return;
  }

  showTouchControls();
}

watch(isQualityMenuOpen, (open) => {
  if (!open) {
    blurQualitySelector();
  }
});

onBeforeUnmount(() => {
  if (touchControlsTimer) {
    clearTimeout(touchControlsTimer);
  }
});

onKeyStroke(
  ["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"],
  (e: KeyboardEvent) => {
    e.stopPropagation();
  },
  { target: qualitySelectorRef },
);

const showControls = computed(() => {
  return isHovered.value || isFocusWithin.value || isTouchControlsVisible.value;
});

const rootClass = computed(() =>
  cn("group relative w-full", props.containerClass),
);

const videoClass = computed(() =>
  cn(
    "block h-auto max-h-[calc(100dvh-8rem)] w-full max-w-full object-contain",
    props.class,
  ),
);

const resolvedPoster = computed(() => {
  if (props.poster) return props.poster;

  const source = props.src;
  if (!source || typeof source === "string") return undefined;

  return source.poster;
});

const posterArtwork = computed<MediaArtworkSource[] | undefined>(() => {
  if (!resolvedPoster.value) return undefined;

  return [
    {
      src: resolvedPoster.value,
      sizes: "512x512",
    },
  ];
});

const mediaSessionMetadata = computed(() =>
  normalizeMediaSessionMetadata(
    props.metadata,
    props.title,
    posterArtwork.value,
  ),
);

const videoPlayer = useVideoPlayer(videoElementRef, {
  autoAttach: true,
  autoplay: props.autoplay,
  mediaSession: {
    metadata: mediaSessionMetadata.value,
  },
});

const {
  shouldShowQualitySelector,
  selectedQualityValue,
  onQualityChange,
  qualityOptions,
} = useMediaPlayerQuality({
  kind: "video",
  mediaElementRef: videoElementRef,
  player: videoPlayer,
  src: () => props.src,
  sources: () => props.sources,
  mimeType: () => props.mimeType,
  poster: resolvedPoster,
  metadata: mediaSessionMetadata,
  autoplay: () => props.autoplay,
  showQualitySelector: () => props.showQualitySelector,
  onReady: (player) => emit("ready", player),
  onLoaded: (player) => emit("loaded", player),
  onError: (error) => emit("error", error),
  onQualityChange: (option) => emit("quality-change", option),
});

function onLoadedMetadata(event: Event) {
  emit("metadata-loaded", event);
}

defineExpose({
  rootElementRef,
  videoElementRef,
  ...videoPlayer,
});
</script>

<template>
  <div
    ref="root-ref"
    :class="rootClass"
    @pointerdown.capture="onRootPointerDown"
  >
    <video
      ref="video-element-ref"
      :autoplay="autoplay"
      :class="videoClass"
      :controls="controls"
      :loop="loop"
      :muted="muted"
      :playsinline="playsinline"
      :poster="resolvedPoster"
      :preload="preload"
      @loadedmetadata="onLoadedMetadata"
    >
      <track
        v-for="track in textTracks"
        :key="`${track.kind || 'subtitles'}:${track.srclang}:${track.src}`"
        :src="track.src"
        :kind="track.kind || 'subtitles'"
        :srclang="track.srclang"
        :label="track.label"
        :default="track.default"
      >
    </video>

    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      leave-active-class="transition-opacity duration-150 ease-in"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-show="shouldShowQualitySelector && showControls"
        ref="quality-selector-ref"
        class="absolute right-2 top-2 z-100 sm:right-3 sm:top-3"
        @click.stop
      >
        <label :for="qualitySelectId" class="sr-only">Video quality</label>

        <USelect
          :id="qualitySelectId"
          v-model="selectedQualityValue"
          v-model:open="isQualityMenuOpen"
          variant="outline"
          aria-label="Video quality"
          :items="qualityOptions"
          :portal="false"
          :ui="{ content: 'w-fit' }"
          @change="onQualityChange"
        />
      </div>
    </Transition>
  </div>
</template>
