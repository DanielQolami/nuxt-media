<script setup lang="ts">
import { computed, useTemplateRef, useId } from "vue";
import type {
  ShakaPlayerInstance,
  MediaAudioPlayerProps,
} from "../types/media.types";
import { normalizeMediaSessionMetadata } from "../lib/viewer/media-viewer.utils";
import {
  useMediaPlayerQuality,
  type QualityOption,
} from "../composables/media/useMediaPlayerQuality";
import { useAudioPlayer } from "../composables/useAudioPlayer";
import { cn } from "../utils/cn.utils";

interface MediaAudioPlayerEmits {
  "ready": [player: ShakaPlayerInstance];
  "loaded": [player: ShakaPlayerInstance];
  "error": [error: Error];
  "quality-change": [option: QualityOption];
}

const props = withDefaults(defineProps<MediaAudioPlayerProps>(), {
  src: null,
  sources: () => [],
  mimeType: null,
  autoplay: false,
  controls: true,
  loop: false,
  muted: false,
  preload: "metadata",
  showQualitySelector: true,
  class: undefined,
});
const emit = defineEmits<MediaAudioPlayerEmits>();

const audioElementRef = useTemplateRef<HTMLAudioElement>("audio-element-ref");
const qualitySelectId = `media-audio-quality-${useId()}`;

const mediaSessionMetadata = computed(() => {
  return normalizeMediaSessionMetadata(props.metadata, props.title);
});

const audioPlayer = useAudioPlayer(audioElementRef, {
  autoAttach: true,
  autoplay: props.autoplay,
  mediaSession: {
    metadata: mediaSessionMetadata.value,
  },
});

const rootClass = computed(() => {
  return cn("grid w-full gap-2", props.containerClass);
});
const audioClass = computed(() => {
  return cn("w-full", props.class);
});

const {
  shouldShowQualitySelector,
  selectedQualityValue,
  qualityOptions,
  onQualityChange,
} = useMediaPlayerQuality({
  kind: "audio",
  mediaElementRef: audioElementRef,
  player: audioPlayer,
  src: () => props.src,
  sources: () => props.sources,
  mimeType: () => props.mimeType,
  metadata: mediaSessionMetadata,
  autoplay: () => props.autoplay,
  showQualitySelector: () => props.showQualitySelector,
  onReady: (player) => emit("ready", player),
  onLoaded: (player) => emit("loaded", player),
  onError: (error) => emit("error", error),
  onQualityChange: (option) => emit("quality-change", option),
});

defineExpose({
  audioElementRef,
  ...audioPlayer,
});
</script>

<template>
  <div :class="rootClass">
    <audio
      ref="audio-element-ref"
      :autoplay="autoplay"
      :class="audioClass"
      :controls="controls"
      :loop="loop"
      :muted="muted"
      :preload="preload"
    />

    <div v-if="shouldShowQualitySelector" class="flex justify-end">
      <label :for="qualitySelectId" class="sr-only">Audio quality</label>
      <select
        :id="qualitySelectId"
        v-model="selectedQualityValue"
        class="h-8 rounded-lg border border-default bg-default px-2 text-xs text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label="Audio quality"
        @change="onQualityChange"
      >
        <option
          v-for="option in qualityOptions"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </select>
    </div>
  </div>
</template>
