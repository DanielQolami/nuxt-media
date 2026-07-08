<script lang="ts">
interface MediaViewerSlideMetricPayload {
  type:
    | "open"
    | "close"
    | "slide-change"
    | "download"
    | "zoom-change"
    | "preload";
  [key: string]: unknown;
}

interface MediaViewerSlideEmits {
  "update:zoom": [value: number];
  "navigate:previous": [];
  "navigate:next": [];
  "download": [];
  "metric": [
    payload: MediaViewerSlideMetricPayload,
  ];
}

export type { MediaViewerSlideEmits, MediaViewerSlideMetricPayload };
</script>

<script setup lang="ts">
// eslint-disable-next-line import/first
import type MediaAudioPlayer from "./MediaAudioPlayer.vue";
// eslint-disable-next-line import/first
import type MediaVideoPlayer from "./MediaVideoPlayer.vue";
// eslint-disable-next-line import/first
import { useMediaViewerSlide } from "../composables/media-viewer/useMediaViewerSlide";
// eslint-disable-next-line import/first
import { computed, useTemplateRef } from "vue";
// eslint-disable-next-line import/first
import type { MediaViewerSlideProps } from "../lib/viewer/media-viewer.types";

const props = withDefaults(defineProps<MediaViewerSlideProps>(), {
  preload: false,
  maxZoom: 2.5,
});
const emit = defineEmits<MediaViewerSlideEmits>();

const stageRef = useTemplateRef<HTMLDivElement>("stage-ref");
const imageElementRef = useTemplateRef<HTMLImageElement>("image-element-ref");
const imageSkeletonRef = useTemplateRef<HTMLElement>("image-skeleton-ref");
const audioCardRef = useTemplateRef<HTMLElement>("audio-card-ref");
const fallbackMediaRef = useTemplateRef<HTMLElement>("fallback-media-ref");
const videoPlayerRef =
  useTemplateRef<InstanceType<typeof MediaVideoPlayer>>("video-player-ref");
const audioPlayerRef =
  useTemplateRef<InstanceType<typeof MediaAudioPlayer>>("audio-player-ref");

const itemRef = computed(() => props.item);
const activeRef = computed(() => props.active);
const preloadRef = computed(() => props.preload);
const zoomRef = computed(() => props.zoom);
const maxZoomRef = computed(() => props.maxZoom);

const {
  mediaElementRef,
  loaded,
  rendererLayoutHint,
  supportsZoom,
  supportsPan,
  isDragging,
  isPinching,
  touchAction,
  panX,
  panY,
  onImageLoad,
  onImageError,
  imageItem,
  videoItem,
  audioItem,
  imageMeasurements,
  mediaSessionMetadata,
  imageBoxStyle,
  currentRenderer,
} = useMediaViewerSlide({
  item: itemRef,
  active: activeRef,
  preload: preloadRef,
  zoom: zoomRef,
  maxZoom: maxZoomRef,
  emit,
  refs: {
    stageRef,
    imageElementRef,
    imageSkeletonRef,
    audioCardRef,
    fallbackMediaRef,
    videoPlayerRef,
    audioPlayerRef,
  },
});

defineExpose({
  mediaElementRef: mediaElementRef,
  rendererLayoutHint: rendererLayoutHint,
});
</script>

<template>
  <div
    ref="stage-ref"
    class="relative flex h-full min-h-0 w-full items-center justify-center overflow-visible"
    :class="[
      active ? 'opacity-100' : 'opacity-60',
      supportsZoom ? 'select-none' : '',
      supportsPan && zoom > 1
        ? isDragging
          ? 'cursor-grabbing'
          : 'cursor-grab'
        : '',
    ]"
    :style="{ touchAction: touchAction }"
  >
    <div
      v-if="imageItem"
      class="pointer-events-none absolute inset-0 grid place-items-center"
    >
      <NuxtImg
        v-if="active || preload"
        ref="image-element-ref"
        :src="imageItem.src"
        :srcset="imageItem.srcSet"
        :alt="imageItem.alt || imageItem.title || ''"
        :width="imageMeasurements.measuredDimensions.value.width"
        :height="imageMeasurements.measuredDimensions.value.height"
        :sizes="imageItem.sizes || '100vw'"
        fit="contain"
        class="pointer-events-auto block touch-none select-none object-contain transition-opacity duration-300"
        :class="loaded ? 'opacity-100' : 'opacity-0'"
        :style="{
          ...imageBoxStyle,
          transform: `translate3d(${panX}px, ${panY}px, 0) scale(${zoom})`,
          transformOrigin: 'center center',
          willChange:
            zoom > 1 || isDragging || isPinching ? 'transform' : 'auto',
        }"
        :loading="preload ? 'eager' : 'lazy'"
        decoding="async"
        draggable="false"
        @load="onImageLoad"
        @error="onImageError"
      />

      <div
        v-if="!loaded"
        ref="image-skeleton-ref"
        class="pointer-events-auto grid place-content-center"
        :style="imageBoxStyle"
      >
        <USkeleton class="size-full rounded-xl" />
      </div>
    </div>

    <div v-else-if="videoItem" class="grid h-full w-full place-items-center">
      <ClientOnly>
        <MediaVideoPlayer
          v-if="active"
          ref="video-player-ref"
          :src="videoItem.src"
          :sources="videoItem.sources"
          :title="videoItem.title"
          :mime-type="videoItem.mimeType"
          :poster="videoItem.poster"
          :metadata="mediaSessionMetadata"
          :text-tracks="videoItem.textTracks"
          class="pointer-events-auto rounded-lg"
        />
      </ClientOnly>
    </div>

    <div
      v-else-if="audioItem"
      class="grid h-full w-full place-items-center p-4"
    >
      <div
        v-if="active"
        ref="audio-card-ref"
        class="pointer-events-auto grid w-[min(100%,48rem)] gap-4 rounded-3xl border border-default/60 bg-default/60 p-4 shadow-xl backdrop-blur sm:p-6"
      >
        <NuxtImg
          v-if="audioItem.poster"
          :src="audioItem.poster"
          :alt="audioItem.title || 'Audio poster'"
          class="mx-auto aspect-video w-full max-w-xl rounded-2xl object-cover"
          sizes="92vw sm:40rem"
          loading="lazy"
          decoding="async"
        />

        <ClientOnly>
          <MediaAudioPlayer
            ref="audio-player-ref"
            :src="audioItem.src"
            :sources="audioItem.sources"
            :title="audioItem.title"
            :mime-type="audioItem.mimeType"
            :metadata="mediaSessionMetadata"
            class="w-full"
          />
        </ClientOnly>
      </div>
    </div>

    <div v-else class="grid h-full w-full place-items-center p-4">
      <div
        ref="fallback-media-ref"
        class="pointer-events-auto grid w-[min(100%,56rem)] gap-4 rounded-3xl border border-default/60 bg-default/60 p-6 text-center shadow-xl backdrop-blur"
      >
        <div
          class="mx-auto grid size-14 place-items-center rounded-full bg-muted text-xl text-muted-foreground"
        >
          <UIcon
            :name="
              currentRenderer.kind === 'pdf'
                ? 'i-lucide-file-text'
                : 'i-lucide-map'
            "
          />
        </div>

        <div class="space-y-1">
          <h3 class="text-base font-semibold text-foreground">
            {{
              item.title
                || (currentRenderer.kind === "pdf" ? "PDF preview" : "Map preview")
            }}
          </h3>
          <p class="text-sm text-muted-foreground">
            A dedicated {{ currentRenderer.kind }} renderer can be registered
            here later.
          </p>
        </div>

        <UButton
          color="neutral"
          variant="soft"
          trailing-icon="i-lucide-external-link"
          :href="item.src"
          target="_blank"
          rel="noreferrer"
          class="justify-self-center"
        >
          Open {{ currentRenderer.kind }}
        </UButton>
      </div>
    </div>
  </div>
</template>
