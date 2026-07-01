import { defu } from "defu";
import { shallowRef, toValue, watch } from "vue";
import {
  tryOnScopeDispose,
  useEventListener,
  useRuntimeConfig,
} from "#imports";
import type {
  MediaPlayerElementRef,
  MediaPlayerSource,
  MediaSessionActionHandlers,
  MediaSessionMetadataInput,
  ShakaLoadOptions,
  ShakaPlayerConfigurationInput,
  ShakaPlayerInstance,
  ShakaPlayerNamespace,
  ShakaSourceDefinition,
  ShakaVariantTrack,
  UseShakaPlayerOptions,
} from "../types/media.types";
import { useShakaLoader } from "./media/useShakaLoader";
import { useMediaSession } from "./useMediaSession";

type MediaRuntimeConfigShape = {
  public: {
    appMedia?: {
      enabled?: boolean;
      shaka?: {
        preload?: "none" | "metadata" | "auto";
        preferredAudio?: string;
        preferredText?: string;
        playerConfig?: ShakaPlayerConfigurationInput;
      };
      mediaSession?: {
        enabled?: boolean;
      };
    };
  };
};

type ShakaErrorEvent = {
  detail?: {
    code?: number;
    severity?: number;
    category?: number;
    message?: string;
  };
};

function normalizePlayerError(error: unknown) {
  if (error instanceof Error) {
    return error;
  }

  if (error && typeof error === "object" && "detail" in error) {
    const detail = (error as ShakaErrorEvent).detail;

    return new Error(
      detail?.message
      || `Shaka Player error${detail?.code ? ` (${detail.code})` : ""}.`,
    );
  }

  return new Error("Unknown media playback error.");
}

/**
 * Merges multiple player configurations into a single configuration.
 */
function mergePlayerConfigurations(
  ...configurations: Array<ShakaPlayerConfigurationInput | undefined>
): ShakaPlayerConfigurationInput {
  return configurations.reduce<ShakaPlayerConfigurationInput>(
    (mergedConfig, currentConfig) => {
      if (!currentConfig) {
        return mergedConfig;
      }

      return defu(currentConfig, mergedConfig);
    },
    {},
  );
}

function createPreferenceConfig(params: {
  preferredAudio?: string;
  preferredText?: string;
}): ShakaPlayerConfigurationInput {
  return {
    ...(params.preferredAudio
      ? {
          preferredAudio: [
            {
              language: params.preferredAudio,
            },
          ],
        }
      : {}),
    ...(params.preferredText
      ? {
          preferredText: [
            {
              language: params.preferredText,
            },
          ],
        }
      : {}),
  };
}

function normalizeSourceDefinition(
  source: MediaPlayerSource,
  loadOptions?: ShakaLoadOptions,
): ShakaSourceDefinition {
  if (typeof source === "string") {
    return {
      src: source,
      mimeType: loadOptions?.mimeType,
      poster: loadOptions?.poster,
      startTime: loadOptions?.startTime,
      metadata: loadOptions?.metadata,
    };
  }

  return {
    ...source,
    mimeType: loadOptions?.mimeType ?? source.mimeType,
    poster: loadOptions?.poster ?? source.poster,
    startTime: loadOptions?.startTime ?? source.startTime,
    metadata: loadOptions?.metadata ?? source.metadata,
  };
}

function createDefaultActionHandlers(
  mediaElement: HTMLMediaElement,
  seekOffsetSeconds: number,
  controls: {
    play: () => Promise<void>;
    pause: () => void;
    stop: () => void;
    syncPositionState: () => void;
  },
): MediaSessionActionHandlers {
  async function play() {
    await controls.play();
  }
  function pause() {
    controls.pause();
  }
  function stop() {
    controls.stop();
  }
  function seekbackward(details: MediaSessionActionDetails) {
    mediaElement.currentTime = Math.max(
      0,
      mediaElement.currentTime - (details.seekOffset || seekOffsetSeconds),
    );
    controls.syncPositionState();
  }
  function seekforward(details: MediaSessionActionDetails) {
    const duration = Number.isFinite(mediaElement.duration)
      ? mediaElement.duration
      : mediaElement.currentTime;

    mediaElement.currentTime = Math.min(
      duration,
      mediaElement.currentTime + (details.seekOffset || seekOffsetSeconds),
    );
    controls.syncPositionState();
  }
  function seekto(details: MediaSessionActionDetails) {
    if (typeof details.seekTime !== "number") {
      return;
    }

    mediaElement.currentTime = details.seekTime;
    controls.syncPositionState();
  }

  return {
    play,
    pause,
    stop,
    seekbackward,
    seekforward,
    seekto,
  };
}

export function useShakaPlayer(
  mediaElementRef: MediaPlayerElementRef,
  options: UseShakaPlayerOptions = {},
) {
  const runtimeConfig = useRuntimeConfig() as MediaRuntimeConfigShape;
  const mediaSession = useMediaSession();
  const shakaLoader = useShakaLoader();

  const player = shallowRef<ShakaPlayerInstance | null>(null);
  const shaka = shallowRef<ShakaPlayerNamespace | null>(null);
  const error = shallowRef<Error | null>(null);
  const activeSource = shallowRef<ShakaSourceDefinition | null>(null);
  const activeMetadata = shallowRef<MediaSessionMetadataInput | null>(
    options.mediaSession?.metadata ?? null,
  );
  const variantTracks = shallowRef<ShakaVariantTrack[]>([]);
  const activeVariantTrack = shallowRef<ShakaVariantTrack | null>(null);
  const isAbrEnabled = shallowRef(true);
  const isLoading = shallowRef(false);
  const isReady = shallowRef(false);
  const isBrowserSupported = shallowRef(false);
  const isEnabled = runtimeConfig.public.appMedia?.enabled ?? true;
  const runtimePlayerConfig =
    runtimeConfig.public.appMedia?.shaka?.playerConfig;
  const runtimeMediaSessionEnabled =
    runtimeConfig.public.appMedia?.mediaSession?.enabled ?? true;
  let mediaElementListenerCleanupCallbacks: Array<() => void> = [];
  let playerListenerCleanupCallbacks: Array<() => void> = [];

  function resolveMediaElement() {
    const mediaElement = toValue(mediaElementRef);

    if (!mediaElement) {
      throw new Error(
        "A media element ref is required before attaching a Shaka player.",
      );
    }

    return mediaElement;
  }

  function syncPlaybackState() {
    const mediaElement = toValue(mediaElementRef);

    if (
      !mediaElement
      || !mediaSession.isSupported.value
      || !runtimeMediaSessionEnabled
    ) {
      return;
    }

    if (mediaElement.ended) {
      mediaSession.setPlaybackState("none");
      return;
    }

    mediaSession.setPlaybackState(mediaElement.paused ? "paused" : "playing");
  }

  function syncPositionState() {
    const mediaElement = toValue(mediaElementRef);

    if (
      !mediaElement
      || !mediaSession.isSupported.value
      || !runtimeMediaSessionEnabled
    ) {
      return;
    }

    if (!Number.isFinite(mediaElement.duration) || mediaElement.duration <= 0) {
      mediaSession.setPositionState(null);
      return;
    }

    mediaSession.setPositionState({
      duration: mediaElement.duration,
      position: mediaElement.currentTime,
      playbackRate: mediaElement.playbackRate || 1,
    });
  }

  function updateMediaSessionMetadata(
    metadata?: MediaSessionMetadataInput | null,
  ) {
    activeMetadata.value = metadata ?? null;

    if (
      !runtimeMediaSessionEnabled
      || options.mediaSession?.enabled === false
    ) {
      return;
    }

    mediaSession.setMetadata(activeMetadata.value);
  }

  function refreshVariantTracks() {
    if (!player.value || typeof player.value.getVariantTracks !== "function") {
      variantTracks.value = [];
      activeVariantTrack.value = null;
      return;
    }

    const tracks = player.value.getVariantTracks() as ShakaVariantTrack[];

    variantTracks.value = tracks;
    activeVariantTrack.value = tracks.find((track) => track.active) ?? null;
  }

  function bindMediaElementEvents(mediaElement: HTMLMediaElement) {
    clearMediaElementEventListeners();

    function onPlay() {
      syncPlaybackState();
      syncPositionState();
    }
    function onPause() {
      syncPlaybackState();
      syncPositionState();
    }
    function onTimeUpdate() {
      syncPositionState();
    }
    function onLoadedMetadata() {
      syncPositionState();
      refreshVariantTracks();
    }
    function onRateChange() {
      syncPositionState();
    }
    function onEnded() {
      syncPlaybackState();
      syncPositionState();
    }

    mediaElementListenerCleanupCallbacks = [
      useEventListener(mediaElement, "play", onPlay),
      useEventListener(mediaElement, "pause", onPause),
      useEventListener(mediaElement, "timeupdate", onTimeUpdate),
      useEventListener(mediaElement, "loadedmetadata", onLoadedMetadata),
      useEventListener(mediaElement, "ratechange", onRateChange),
      useEventListener(mediaElement, "ended", onEnded),
    ];
  }

  function bindPlayerEvents(playerInstance: ShakaPlayerInstance) {
    clearPlayerEventListeners();

    function refreshTracks() {
      refreshVariantTracks();
    }

    playerListenerCleanupCallbacks = [
      useEventListener(
        playerInstance as unknown as EventTarget,
        "error",
        (event: Event) => {
          error.value = normalizePlayerError(event);
        },
      ),
      useEventListener(
        playerInstance as unknown as EventTarget,
        "trackschanged",
        refreshTracks,
      ),
      useEventListener(
        playerInstance as unknown as EventTarget,
        "variantchanged",
        refreshTracks,
      ),
      useEventListener(
        playerInstance as unknown as EventTarget,
        "adaptation",
        refreshTracks,
      ),
      useEventListener(
        playerInstance as unknown as EventTarget,
        "loaded",
        refreshTracks,
      ),
    ];
  }

  function clearMediaElementEventListeners() {
    for (const cleanupCallback of mediaElementListenerCleanupCallbacks) {
      cleanupCallback();
    }

    mediaElementListenerCleanupCallbacks = [];
  }

  function clearPlayerEventListeners() {
    for (const cleanupCallback of playerListenerCleanupCallbacks) {
      cleanupCallback();
    }

    playerListenerCleanupCallbacks = [];
  }

  async function play() {
    const mediaElement = resolveMediaElement();

    await mediaElement.play();
    syncPlaybackState();
    syncPositionState();
  }

  function pause() {
    const mediaElement = resolveMediaElement();

    mediaElement.pause();
    syncPlaybackState();
  }

  function stop() {
    const mediaElement = resolveMediaElement();

    mediaElement.pause();
    mediaElement.currentTime = 0;
    syncPlaybackState();
    syncPositionState();
  }

  function applyMediaSessionActionHandlers(mediaElement: HTMLMediaElement) {
    if (
      !runtimeMediaSessionEnabled
      || options.mediaSession?.enabled === false
    ) {
      return;
    }

    const handlers = {
      ...createDefaultActionHandlers(
        mediaElement,
        options.mediaSession?.seekOffsetSeconds ?? 10,
        {
          play,
          pause,
          stop,
          syncPositionState,
        },
      ),
      ...(options.mediaSession?.actionHandlers || {}),
    } satisfies MediaSessionActionHandlers;

    mediaSession.setActionHandlers(handlers);
  }

  async function resolveShaka() {
    const shakaNamespace = await shakaLoader.load();

    shaka.value = shakaNamespace;
    isBrowserSupported.value = shakaNamespace.Player.isBrowserSupported();

    if (!isBrowserSupported.value) {
      throw new Error("Shaka Player is not supported in this browser.");
    }

    return shakaNamespace;
  }

  /**
   * Attaches the Shaka Player instance to the media element.
   * If a player instance already exists and is attached to a different media element,
   * it will be re-attached to the new media element.
   */
  async function attach() {
    if (!isEnabled) {
      throw new Error("The media module is disabled in runtime config.");
    }

    const mediaElement = resolveMediaElement();
    const shakaNamespace = await resolveShaka();

    if (!player.value) {
      const nextPlayer = new shakaNamespace.Player();

      nextPlayer.configure(
        mergePlayerConfigurations(
          createPreferenceConfig({
            preferredAudio:
              runtimeConfig.public.appMedia?.shaka?.preferredAudio,
            preferredText: runtimeConfig.public.appMedia?.shaka?.preferredText,
          }),
          runtimePlayerConfig,
          options.playerConfig,
        ),
      );

      await nextPlayer.attach(mediaElement);
      bindPlayerEvents(nextPlayer);
      player.value = nextPlayer;
    }
    else if (player.value.getMediaElement() !== mediaElement) {
      await player.value.attach(mediaElement);
    }

    mediaElement.preload =
      runtimeConfig.public.appMedia?.shaka?.preload ?? "metadata";
    bindMediaElementEvents(mediaElement);
    applyMediaSessionActionHandlers(mediaElement);
    refreshVariantTracks();
    isReady.value = true;

    if (!player.value) {
      throw new Error("Shaka Player instance could not be created.");
    }

    return player.value;
  }

  async function configure(configuration: ShakaPlayerConfigurationInput) {
    const playerInstance = await attach();

    playerInstance.configure(configuration);
    refreshVariantTracks();
  }

  async function setAbrEnabled(enabled: boolean) {
    const playerInstance = await attach();

    playerInstance.configure({
      abr: {
        enabled,
      },
    });
    isAbrEnabled.value = enabled;
    refreshVariantTracks();
  }

  async function selectVariantTrack(
    trackOrId: ShakaVariantTrack | number,
    clearBuffer = true,
  ) {
    const playerInstance = await attach();
    const track =
      typeof trackOrId === "number"
        ? variantTracks.value.find((candidate) => candidate.id === trackOrId)
        : trackOrId;

    if (!track) {
      throw new Error("The requested media quality track is not available.");
    }

    playerInstance.configure({
      abr: {
        enabled: false,
      },
    });
    isAbrEnabled.value = false;
    playerInstance.selectVariantTrack(
      track as Parameters<ShakaPlayerInstance["selectVariantTrack"]>[0],
      clearBuffer,
    );
    refreshVariantTracks();
    syncPositionState();
  }

  /**
   * Loads a media source into the player with optional load-time configurations.
   * If the player is not yet attached to a media element, it will attempt to attach before loading.
   * During the loading process, playback will not start automatically unless specified in the options.
   */
  async function load(
    source: MediaPlayerSource,
    loadOptions: ShakaLoadOptions = {},
  ) {
    const playerInstance = await attach();
    const normalizedSource = normalizeSourceDefinition(source, loadOptions);
    const mediaElement = resolveMediaElement();

    isLoading.value = true;
    error.value = null;

    try {
      if (loadOptions.playerConfig) {
        playerInstance.configure(loadOptions.playerConfig);
      }

      if (normalizedSource.poster && mediaElement instanceof HTMLVideoElement) {
        mediaElement.poster = normalizedSource.poster;
      }

      await playerInstance.load(
        normalizedSource.src,
        normalizedSource.startTime ?? null,
        normalizedSource.mimeType ?? null,
      );

      activeSource.value = normalizedSource;
      updateMediaSessionMetadata(
        normalizedSource.metadata
        ?? loadOptions.metadata
        ?? options.mediaSession?.metadata
        ?? null,
      );
      refreshVariantTracks();
      syncPlaybackState();
      syncPositionState();

      if (loadOptions.autoplay ?? options.autoplay) {
        await play();
      }

      return playerInstance;
    }
    catch (loadError) {
      error.value = normalizePlayerError(loadError);
      throw error.value;
    }
    finally {
      isLoading.value = false;
    }
  }

  async function destroy() {
    clearMediaElementEventListeners();
    clearPlayerEventListeners();

    if (runtimeMediaSessionEnabled && options.mediaSession?.enabled !== false) {
      mediaSession.clear();
    }

    if (!player.value) {
      activeSource.value = null;
      variantTracks.value = [];
      activeVariantTrack.value = null;
      isReady.value = false;
      return;
    }

    await player.value.destroy();
    player.value = null;
    activeSource.value = null;
    variantTracks.value = [];
    activeVariantTrack.value = null;
    isReady.value = false;
  }

  // Auto-attach when media element becomes available
  watch(
    () => toValue(mediaElementRef),
    async (nextMediaElement) => {
      if (
        !import.meta.client
        || options.autoAttach === false
        || !nextMediaElement
      ) {
        return;
      }

      try {
        await attach();
      }
      catch (attachError) {
        error.value = normalizePlayerError(attachError);
      }
    },
    {
      flush: "post",
    },
  );

  tryOnScopeDispose(() => {
    void destroy();
  });

  return {
    player,
    shaka,
    error,
    activeSource,
    activeMetadata,
    variantTracks,
    activeVariantTrack,
    isAbrEnabled,
    isLoading,
    isReady,
    isBrowserSupported,
    attach,
    configure,
    load,
    play,
    pause,
    stop,
    setAbrEnabled,
    selectVariantTrack,
    refreshVariantTracks,
    syncPlaybackState,
    syncPositionState,
    updateMediaSessionMetadata,
    destroy,
  };
}
