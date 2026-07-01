<script lang="ts">
import type { ComponentPublicInstance, Slots } from "vue";
import type {
  MediaViewerCaptionPlacement,
  MediaViewerItem,
  MediaViewerMediaLayoutHint,
} from "../types/media-viewer.types";
import type { MediaViewerSlideMetricPayload } from "./MediaViewerSlide.vue";

interface MediaViewerGalleryProps<TItem extends MediaViewerItem> {
  galleryKey: string;
  items: TItem[];
  virtualWindowSize?: number;
  maxZoom?: number;
}

interface MediaViewerGalleryEmits {
  metric: [
    payload: {
      type:
        | "open"
        | "close"
        | "slide-change"
        | "download"
        | "zoom-change"
        | "preload";
      galleryKey: string;
      slideId?: string;
      index?: number;
      zoom?: number;
      url?: string;
      direction?: "next" | "previous";
    },
  ];
}

interface MediaViewerGallerySlots extends Slots {
  "media-gallery"(props: {
    items: MediaViewerItem[];
    open: (index: number) => void;
    galleryKey: string;
  }): never;
  "media-item"(props: {
    item: MediaViewerItem;
    index: number;
    open: () => void;
  }): never;
  "thumbnail"(props: { item: MediaViewerItem; index: number }): never;
  "figcaption"(props: { item: MediaViewerItem; index: number }): never;
  "slide-media"(props: {
    item: MediaViewerItem;
    index: number;
    active: boolean;
    preload: boolean;
    zoom: number;
    mediaLayout: MediaViewerMediaLayoutHint;
    setZoom: (value: number) => void;
    setMediaElement: (value: Element | ComponentPublicInstance | null) => void;
    next: () => void;
    previous: () => void;
  }): never;
  "slide-caption"(props: {
    item: MediaViewerItem;
    index: number;
    placement: MediaViewerCaptionPlacement;
  }): never;
}

export type {
  MediaViewerGalleryProps,
  MediaViewerGalleryEmits,
  MediaViewerGallerySlots,
  MediaViewerItem,
};
</script>

<script setup lang="ts" generic="TItem extends MediaViewerItem">
// eslint-disable-next-line import/first
import { useMediaViewerGallery } from "../composables/media-viewer/useMediaViewerGallery";
// eslint-disable-next-line import/first
import type MediaViewerSlide from "./MediaViewerSlide.vue";
// eslint-disable-next-line import/first
import { useTemplateRef } from "vue";

const props = withDefaults(defineProps<MediaViewerGalleryProps<TItem>>(), {
  virtualWindowSize: 5,
  maxZoom: 3,
});
const emit = defineEmits<MediaViewerGalleryEmits>();
const slots = defineSlots<MediaViewerGallerySlots>();

const viewportRef = useTemplateRef<HTMLDivElement>("viewport-ref");
const captionRef = useTemplateRef<HTMLElement>("caption-ref");
const slideRef =
  useTemplateRef<InstanceType<typeof MediaViewerSlide>>("slide-ref");
const customSlideMediaWrapperRef = useTemplateRef<HTMLElement>(
  "custom-slide-media-wrapper-ref",
);
const modalCounterRef = useTemplateRef<HTMLDivElement>("modal-counter-ref");
const downloadBtnRef = useTemplateRef<HTMLButtonElement>("download-btn-ref");
const zoomToggleRef = useTemplateRef<HTMLButtonElement>("zoom-toggle-ref");
const closeBtnRef = useTemplateRef<HTMLButtonElement>("close-btn-ref");
const prevBtnRef = useTemplateRef<HTMLButtonElement>("prev-btn-ref");
const nextBtnRef = useTemplateRef<HTMLButtonElement>("next-btn-ref");

const {
  openAt,
  modalOpen,
  onModalUpdateOpen,
  currentSlideOneBased,
  totalSlides,
  currentDownloadUrl,
  activeItem,
  zoom,
  showSlideCaption,
  currentCaptionPlacement,
  currentMediaLayout,
  hasCustomSlideMediaSlot,
  nextSlide,
  previousSlide,
  onZoomUpdate,
  onDownload,
  activeIndex,
  setCustomMediaElement,
  lastDirection,
} = useMediaViewerGallery({
  props,
  emit,
  slots,
  refs: {
    viewportRef,
    captionRef,
    slideRef,
    customSlideMediaWrapperRef,
    modalCounterRef,
    downloadBtnRef,
    zoomToggleRef,
    closeBtnRef,
    prevBtnRef,
    nextBtnRef,
  },
});
</script>

<template>
  <div class="grid gap-4">
    <slot
      name="media-gallery"
      :items="items"
      :open="openAt"
      :gallery-key="galleryKey"
    >
      <div class="grid auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <template v-for="(item, index) in items" :key="item.id">
          <slot
            name="media-item"
            :item="item"
            :index="index"
            :open="() => openAt(index)"
          >
            <button
              type="button"
              class="group cursor-pointer text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              @click="openAt(index)"
            >
              <figure
                class="h-full overflow-hidden rounded-2xl border border-default bg-elevated shadow-sm transition-transform duration-200 group-hover:-translate-y-0.5"
              >
                <slot name="thumbnail" :item="item" :index="index">
                  <div
                    v-if="item.kind === 'image'"
                    data-kind="image"
                    class="aspect-video bg-muted"
                  >
                    <NuxtImg
                      :src="item.thumbnailSrc || item.src"
                      :alt="item.alt || item.title || ''"
                      :width="item.width"
                      :height="item.height"
                      sizes="100vw sm:50vw lg:33vw"
                      class="size-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>

                  <div
                    v-else-if="item.kind === 'video' || item.kind === 'audio'"
                    class="aspect-video bg-muted"
                  >
                    <NuxtImg
                      v-if="item.poster"
                      :src="item.poster"
                      :alt="item.title || item.kind"
                      class="size-full object-cover"
                      sizes="100vw sm:50vw lg:33vw"
                      loading="lazy"
                      decoding="async"
                    />
                    <div
                      v-else
                      class="flex size-full items-center justify-center px-4 text-sm text-muted-foreground"
                    >
                      {{ item.title || item.kind }}
                    </div>
                  </div>

                  <div
                    v-else
                    class="flex aspect-video size-full items-center justify-center bg-muted px-4 text-sm text-muted-foreground"
                  >
                    {{ item.title || item.kind }}
                  </div>
                </slot>

                <slot name="figcaption" :item="item" :index="index">
                  <figcaption
                    v-if="item.title || item.caption"
                    class="space-y-1 p-4"
                  >
                    <div v-if="item.title" class="font-medium text-foreground">
                      {{ item.title }}
                    </div>

                    <div
                      v-if="item.caption"
                      class="text-sm text-muted-foreground"
                    >
                      {{ item.caption }}
                    </div>
                  </figcaption>
                </slot>
              </figure>
            </button>
          </slot>
        </template>
      </div>
    </slot>

    <UModal
      v-model:open="modalOpen"
      fullscreen
      :dismissible="true"
      :overlay="true"
      :ui="{
        content: 'bg-transparent',
        overlay: 'backdrop-blur-xs',
        body: 'p-0',
      }"
      @update:open="onModalUpdateOpen"
    >
      <template v-slot:default>
        <span class="sr-only">Media viewer</span>
      </template>

      <template v-slot:content="{ close }">
        <div class="flex h-dvh w-dvw flex-col overflow-hidden">
          <header
            class="relative z-50 flex items-center justify-between gap-3 border-b border-default/50 px-4 py-3 sm:px-6"
          >
            <div
              ref="modal-counter-ref"
              class="p-1 text-sm font-medium opacity-80"
            >
              {{ currentSlideOneBased }} / {{ totalSlides }}
            </div>

            <div class="flex items-center gap-2">
              <UButton
                v-if="currentDownloadUrl && activeItem"
                ref="download-btn-ref"
                color="neutral"
                variant="ghost"
                icon="i-lucide-download"
                class="focus-visible:ring-2 focus-visible:ring-inverted/80"
                aria-label="Download media"
                rel="noreferrer"
                target="_blank"
                :href="currentDownloadUrl"
                :download="activeItem.title || activeItem.id || 'download'"
                @click="onDownload"
              />

              <UButton
                v-if="activeItem?.kind === 'image'"
                ref="zoom-toggle-ref"
                color="neutral"
                variant="ghost"
                :icon="zoom === 1 ? 'i-lucide-zoom-in' : 'i-lucide-zoom-out'"
                class="focus-visible:ring-2 focus-visible:ring-inverted/80"
                :aria-label="zoom === 1 ? 'Zoom in' : 'Zoom out'"
                @click="onZoomUpdate(zoom === 1 ? maxZoom : 1)"
              />

              <UButton
                ref="close-btn-ref"
                color="neutral"
                variant="ghost"
                icon="i-lucide-x"
                class="focus-visible:ring-2 focus-visible:ring-inverted/80"
                aria-label="Close viewer"
                @click="close"
              />
            </div>
          </header>

          <div class="relative flex-1 overflow-hidden">
            <UButton
              v-if="totalSlides > 1"
              ref="prev-btn-ref"
              color="neutral"
              variant="ghost"
              icon="i-lucide-chevron-left"
              size="xl"
              class="absolute inset-y-48/100 inset-s-3 z-50 size-10 -translate-y-1/2 rounded-full hover:bg-inverted/10 focus-visible:bg-inverted/10 rtl:rotate-180"
              aria-label="Previous slide"
              @click="previousSlide"
            />

            <UButton
              v-if="totalSlides > 1"
              ref="next-btn-ref"
              color="neutral"
              variant="ghost"
              icon="i-lucide-chevron-right"
              size="xl"
              class="absolute inset-y-48/100 inset-e-3 z-50 size-10 -translate-y-1/2 rounded-full hover:bg-inverted/10 focus-visible:bg-inverted/10 rtl:rotate-180"
              aria-label="Next slide"
              @click="nextSlide"
            />

            <div
              ref="viewport-ref"
              class="flex h-full min-h-0 w-full items-center justify-center"
              :class="zoom > 1 ? 'p-0' : 'p-4 sm:p-6'"
            >
              <div
                v-if="activeItem"
                class="grid h-full min-h-0 w-full gap-3 grid-cols-1"
                :class="[
                  showSlideCaption && currentCaptionPlacement === 'side'
                    ? 'lg:grid-cols-[minmax(0,1fr)_minmax(19rem,28rem)] lg:grid-rows-1 has-[aside:empty]:lg:grid-cols-1'
                    : '',
                  showSlideCaption && currentCaptionPlacement === 'below'
                    ? 'grid-rows-[minmax(0,1fr)_auto]'
                    : 'grid-rows-1',
                ]"
              >
                <section
                  class="relative z-10 grid min-h-0 min-w-0 place-items-center overflow-visible rounded-lg"
                >
                  <Transition
                    :name="
                      lastDirection === 'next'
                        ? 'viewer-slide-next'
                        : 'viewer-slide-previous'
                    "
                    mode="out-in"
                  >
                    <div
                      :key="activeItem.id"
                      class="grid h-full w-full place-items-center"
                    >
                      <div
                        v-if="hasCustomSlideMediaSlot"
                        ref="custom-slide-media-wrapper-ref"
                        class="pointer-events-auto inline-grid max-h-full max-w-full place-items-center"
                      >
                        <slot
                          name="slide-media"
                          :item="activeItem"
                          :index="activeIndex"
                          :active="true"
                          :preload="false"
                          :zoom="zoom"
                          :media-layout="currentMediaLayout"
                          :set-zoom="onZoomUpdate"
                          :set-media-element="setCustomMediaElement"
                          :next="nextSlide"
                          :previous="previousSlide"
                        />
                      </div>

                      <MediaViewerSlide
                        v-else
                        ref="slide-ref"
                        :item="activeItem"
                        :active="true"
                        :preload="false"
                        :zoom="zoom"
                        :max-zoom="maxZoom"
                        @update:zoom="onZoomUpdate"
                        @navigate:next="nextSlide"
                        @navigate:previous="previousSlide"
                        @download="onDownload"
                        @metric="
                          (payload: MediaViewerSlideMetricPayload) =>
                            emit('metric', { ...payload, galleryKey })
                        "
                      />
                    </div>
                  </Transition>
                </section>

                <aside
                  v-if="showSlideCaption"
                  ref="caption-ref"
                  class="min-h-0 min-w-0 overflow-y-auto rounded-3xl border border-muted p-4 empty:hidden empty:border-0 empty:p-0 sm:p-6"
                  :class="
                    currentCaptionPlacement === 'side' ? '' : 'max-h-[17dvh]'
                  "
                >
                  <slot
                    name="slide-caption"
                    :item="activeItem"
                    :index="activeIndex"
                    :placement="currentCaptionPlacement"
                  >
                    <p v-if="activeItem.slideCaption">
                      {{ activeItem.slideCaption }}
                    </p>
                  </slot>
                </aside>
              </div>

              <div
                v-else
                class="grid place-items-center text-sm text-muted-foreground"
              >
                No media item is available.
              </div>
            </div>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
.viewer-slide-next-enter-active,
.viewer-slide-next-leave-active,
.viewer-slide-previous-enter-active,
.viewer-slide-previous-leave-active {
  transition:
    opacity 220ms ease,
    transform 220ms ease;
}

.viewer-slide-next-enter-from {
  opacity: 0;
  transform: translate3d(1rem, 0, 0) scale(0.99);
}

.viewer-slide-next-leave-to {
  opacity: 0;
  transform: translate3d(-1rem, 0, 0) scale(0.99);
}

.viewer-slide-previous-enter-from {
  opacity: 0;
  transform: translate3d(-1rem, 0, 0) scale(0.99);
}

.viewer-slide-previous-leave-to {
  opacity: 0;
  transform: translate3d(1rem, 0, 0) scale(0.99);
}
</style>
