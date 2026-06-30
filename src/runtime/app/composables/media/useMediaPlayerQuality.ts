import type { MaybeRefOrGetter, Ref } from "vue";
import { computed, shallowRef, toValue, watch } from "vue";
import type {
  MediaPlayerKind,
  MediaPlayerQualitySource,
  MediaPlayerSource,
  MediaSessionMetadataInput,
  ShakaPlayerInstance,
  ShakaSourceDefinition,
  ShakaVariantTrack,
} from "../../types/media.types";

type ShakaPlayerControls = {
  player: Ref<ShakaPlayerInstance | null>;
  variantTracks: Ref<ShakaVariantTrack[]>;
  activeVariantTrack: Ref<ShakaVariantTrack | null>;
  isAbrEnabled: Ref<boolean>;
  isReady: Ref<boolean>;
  load: (
    source: MediaPlayerSource,
    options?: {
      autoplay?: boolean;
      mimeType?: string | null;
      poster?: string;
      startTime?: number | null;
      metadata?: MediaSessionMetadataInput;
    },
  ) => Promise<ShakaPlayerInstance>;
  stop: () => void;
  updateMediaSessionMetadata: (
    metadata?: MediaSessionMetadataInput | null,
  ) => void;
  setAbrEnabled: (enabled: boolean) => Promise<void>;
  selectVariantTrack: (
    trackOrId: ShakaVariantTrack | number,
    clearBuffer?: boolean,
  ) => Promise<void>;
};

type QualityOption = {
  value: string;
  label: string;
  mode: "auto" | "source" | "variant";
  sourceIndex?: number;
  trackId?: number;
};

type UseMediaPlayerQualityOptions = {
  kind: MediaPlayerKind;
  mediaElementRef: Ref<HTMLMediaElement | null>;
  player: ShakaPlayerControls;
  src: MaybeRefOrGetter<MediaPlayerSource | null | undefined>;
  sources: MaybeRefOrGetter<MediaPlayerQualitySource[] | undefined>;
  title?: MaybeRefOrGetter<string | undefined>;
  mimeType?: MaybeRefOrGetter<string | null | undefined>;
  poster?: MaybeRefOrGetter<string | undefined>;
  metadata?: MaybeRefOrGetter<MediaSessionMetadataInput | undefined>;
  autoplay?: MaybeRefOrGetter<boolean>;
  showQualitySelector?: MaybeRefOrGetter<boolean>;
  onReady?: (player: ShakaPlayerInstance) => void;
  onLoaded?: (player: ShakaPlayerInstance) => void;
  onError?: (error: Error) => void;
  onQualityChange?: (option: QualityOption) => void;
};

function formatBitrate(bitsPerSecond?: number) {
  if (!bitsPerSecond) return undefined;

  return bitsPerSecond >= 1_000_000
    ? `${(bitsPerSecond / 1_000_000).toFixed(1)} Mbps`
    : `${Math.round(bitsPerSecond / 1_000)} kbps`;
}

function formatSourceLabel(
  source: MediaPlayerQualitySource,
  index: number,
  kind: MediaPlayerKind,
) {
  if (source.label) return source.label;

  if (kind === "video") {
    if (source.height) return `${source.height}p`;
    if (source.width && source.height)
      return `${source.width}×${source.height}`;
  }

  return formatBitrate(source.bitrate) || `Quality ${index + 1}`;
}

function formatVariantTrackLabel(
  track: ShakaVariantTrack,
  kind: MediaPlayerKind,
) {
  const bitrate = formatBitrate(
    track.bandwidth || track.videoBandwidth || track.audioBandwidth,
  );
  const language =
    track.language && track.language !== "und"
      ? track.language.toUpperCase()
      : undefined;

  if (kind === "video") {
    const resolution = track.height ? `${track.height}p` : undefined;

    return (
      [resolution, bitrate, language].filter(Boolean).join(" · ") ||
      `Track ${track.id}`
    );
  }

  const channels = track.channelsCount ? `${track.channelsCount}ch` : undefined;

  return (
    [bitrate, language, channels].filter(Boolean).join(" · ") ||
    `Track ${track.id}`
  );
}

function getVariantTrackKey(track: ShakaVariantTrack, kind: MediaPlayerKind) {
  if (kind === "video") {
    return [
      track.height ?? 0,
      track.width ?? 0,
      track.bandwidth ?? 0,
      track.language ?? "",
    ].join(":");
  }

  return [
    track.bandwidth ?? 0,
    track.language ?? "",
    track.channelsCount ?? 0,
  ].join(":");
}

function dedupeVariantTracks(
  tracks: ShakaVariantTrack[],
  kind: MediaPlayerKind,
) {
  const seen = new Set<string>();
  const sorted = [...tracks].sort((a, b) => {
    if (kind === "video") {
      return (
        (b.height ?? 0) - (a.height ?? 0) ||
        (b.bandwidth ?? 0) - (a.bandwidth ?? 0)
      );
    }

    return (b.bandwidth ?? 0) - (a.bandwidth ?? 0);
  });

  return sorted.filter((track) => {
    const key = getVariantTrackKey(track, kind);

    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

export function useMediaPlayerQuality(options: UseMediaPlayerQualityOptions) {
  const selectedSourceIndex = shallowRef(0);
  const selectedQualityValue = shallowRef("auto");
  const pendingSource = shallowRef<ShakaSourceDefinition | null>(null);

  const normalizedSources = computed<MediaPlayerQualitySource[]>(() => {
    const explicitSources = toValue(options.sources) ?? [];
    const mimeType = toValue(options.mimeType) ?? null;
    const poster = toValue(options.poster);
    const metadata = toValue(options.metadata);

    if (explicitSources.length > 0) {
      return explicitSources.map((source) => ({
        ...source,
        mimeType: source.mimeType ?? mimeType,
        poster: source.poster ?? poster,
        metadata: source.metadata ?? metadata,
      }));
    }

    const src = toValue(options.src);

    if (!src) return [];

    if (typeof src === "string") {
      return [
        {
          src,
          mimeType,
          poster,
          metadata,
        },
      ];
    }

    return [
      {
        ...src,
        mimeType: mimeType ?? src.mimeType,
        poster: poster ?? src.poster,
        metadata: metadata ?? src.metadata,
      },
    ];
  });

  const activeSource = computed<ShakaSourceDefinition | null>(() => {
    return normalizedSources.value[selectedSourceIndex.value] ?? null;
  });

  const sourceQualityOptions = computed<QualityOption[]>(() => {
    if (normalizedSources.value.length <= 1) return [];

    return normalizedSources.value.map((source, index) => ({
      value: `source:${index}`,
      label: formatSourceLabel(source, index, options.kind),
      mode: "source",
      sourceIndex: index,
    }));
  });

  const variantQualityOptions = computed<QualityOption[]>(() => {
    if (sourceQualityOptions.value.length > 0) return [];

    const uniqueTracks = dedupeVariantTracks(
      options.player.variantTracks.value,
      options.kind,
    );

    if (uniqueTracks.length <= 1) return [];

    return [
      {
        value: "auto",
        label: "Auto",
        mode: "auto",
      },
      ...uniqueTracks.map((track) => ({
        value: `variant:${track.id}`,
        label: formatVariantTrackLabel(track, options.kind),
        mode: "variant" as const,
        trackId: track.id,
      })),
    ];
  });

  const qualityOptions = computed(() => {
    return sourceQualityOptions.value.length > 0
      ? sourceQualityOptions.value
      : variantQualityOptions.value;
  });

  const shouldShowQualitySelector = computed(() => {
    return (
      Boolean(toValue(options.showQualitySelector) ?? true) &&
      qualityOptions.value.length > 1
    );
  });

  function resetMediaElement() {
    if (!options.mediaElementRef.value) return;

    options.mediaElementRef.value.pause();
    options.mediaElementRef.value.removeAttribute("src");
    options.mediaElementRef.value.load();
  }

  async function syncSource(
    source: ShakaSourceDefinition | null | undefined,
    preserveCurrentTime = false,
  ) {
    if (!import.meta.client) return;

    // Guard: Wait for the media element to be available
    if (!options.mediaElementRef.value) {
      // Store the source as pending to be loaded when the element is ready
      pendingSource.value = source ?? null;
      return;
    }

    if (!source) {
      options.player.stop();
      resetMediaElement();
      return;
    }

    if (
      options.kind === "video" &&
      options.mediaElementRef.value instanceof HTMLVideoElement
    ) {
      options.mediaElementRef.value.poster =
        source.poster || toValue(options.poster) || "";
    }

    const currentTime = preserveCurrentTime
      ? options.mediaElementRef.value?.currentTime || 0
      : 0;

    try {
      const player = await options.player.load(source, {
        autoplay: Boolean(toValue(options.autoplay)),
        mimeType: source.mimeType ?? toValue(options.mimeType) ?? null,
        poster: source.poster ?? toValue(options.poster),
        metadata: source.metadata ?? toValue(options.metadata),
        startTime: currentTime > 0 ? currentTime : source.startTime,
      });

      options.onLoaded?.(player);
    } catch (error) {
      console.error("Error loading media source:", error);
      options.onError?.(
        error instanceof Error
          ? error
          : new Error(`${options.kind} playback failed.`),
      );
    }
  }

  async function onQualityChange() {
    const option = qualityOptions.value.find(
      (candidate) => candidate.value === selectedQualityValue.value,
    );

    if (!option) return;

    try {
      if (option.mode === "auto") {
        await options.player.setAbrEnabled(true);
        options.onQualityChange?.(option);
        return;
      }

      if (option.mode === "source" && typeof option.sourceIndex === "number") {
        selectedSourceIndex.value = option.sourceIndex;
        await syncSource(activeSource.value, true);
        options.onQualityChange?.(option);
        return;
      }

      if (option.mode === "variant" && typeof option.trackId === "number") {
        await options.player.selectVariantTrack(option.trackId);
        options.onQualityChange?.(option);
      }
    } catch (error) {
      options.onError?.(
        error instanceof Error
          ? error
          : new Error(`Changing ${options.kind} quality failed.`),
      );
    }
  }

  // Watch for source changes and update selectedSourceIndex
  watch(
    normalizedSources,
    (sources) => {
      const defaultIndex = sources.findIndex((source) => source.isDefault);
      selectedSourceIndex.value = defaultIndex >= 0 ? defaultIndex : 0;
      selectedQualityValue.value =
        sources.length > 1 ? `source:${selectedSourceIndex.value}` : "auto";
    },
    { immediate: true },
  );

  // Watch for activeSource changes and sync to player
  // Uses flush: "post" to ensure DOM is updated, but we still guard for mediaElementRef
  watch(
    activeSource,
    async (source) => {
      await syncSource(source);
    },
    { immediate: true, flush: "post" },
  );

  // Watch for media element becoming available and load any pending source
  watch(
    () => options.mediaElementRef.value,
    async (mediaElement) => {
      if (mediaElement && pendingSource.value) {
        const source = pendingSource.value;
        pendingSource.value = null;
        await syncSource(source);
      }
    },
    { flush: "post" },
  );

  // Watch for metadata changes
  watch(
    () => toValue(options.metadata),
    (metadata) => {
      options.player.updateMediaSessionMetadata(metadata);
    },
  );

  // Watch for active variant track changes from the player (e.g., ABR adaptation)
  watch(
    options.player.activeVariantTrack,
    (track) => {
      if (
        !track ||
        options.player.isAbrEnabled.value ||
        sourceQualityOptions.value.length > 0
      )
        return;

      selectedQualityValue.value = `variant:${track.id}`;
    },
    { flush: "post" },
  );

  // Emit ready when player instance becomes available
  watch(
    options.player.player,
    (player) => {
      if (player) options.onReady?.(player);
    },
    { flush: "post" },
  );

  return {
    selectedSourceIndex,
    selectedQualityValue,
    normalizedSources,
    activeSource,
    sourceQualityOptions,
    variantQualityOptions,
    qualityOptions,
    shouldShowQualitySelector,
    syncSource,
    onQualityChange,
  };
}

export type { QualityOption };
