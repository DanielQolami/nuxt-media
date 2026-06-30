import { useRuntimeConfig, useSupported } from "#imports";
import { MEDIA_SESSION_ACTIONS } from "../enums/media-session-actions.enum";
import type {
  MediaArtworkSource,
  MediaSessionActionHandlers,
  MediaSessionMetadataInput,
} from "../types/media.types";

type MediaRuntimeConfigShape = {
  public: {
    appMedia?: {
      mediaSession?: {
        enabled?: boolean;
        defaultArtwork?: MediaArtworkSource[];
      };
    };
  };
};

function normalizeArtwork(
  metadata: MediaSessionMetadataInput | null | undefined,
  defaultArtwork: MediaArtworkSource[],
) {
  if (metadata?.artwork && metadata.artwork.length > 0) {
    return metadata.artwork;
  }

  return defaultArtwork;
}

export function useMediaSession() {
  const runtimeConfig = useRuntimeConfig() as MediaRuntimeConfigShape;
  const defaultArtwork =
    runtimeConfig.public.appMedia?.mediaSession?.defaultArtwork ?? [];
  const isEnabledByConfig =
    runtimeConfig.public.appMedia?.mediaSession?.enabled ?? true;
  const isSupported = useSupported(() => {
    return (
      isEnabledByConfig &&
      typeof navigator !== "undefined" &&
      "mediaSession" in navigator
    );
  });

  function getMediaSession() {
    if (!isSupported.value) {
      return null;
    }

    return navigator.mediaSession;
  }

  function setMetadata(metadata: MediaSessionMetadataInput | null | undefined) {
    const mediaSession = getMediaSession();

    if (!mediaSession) {
      return;
    }

    if (!metadata) {
      mediaSession.metadata = null;
      return;
    }

    try {
      mediaSession.metadata = new MediaMetadata({
        title: metadata.title,
        artist: metadata.artist,
        album: metadata.album,
        artwork: normalizeArtwork(metadata, defaultArtwork),
      });
    } catch {
      mediaSession.metadata = null;
    }
  }

  function setPlaybackState(playbackState: MediaSessionPlaybackState) {
    const mediaSession = getMediaSession();

    if (!mediaSession) {
      return;
    }

    mediaSession.playbackState = playbackState;
  }

  function setActionHandler(
    action: MediaSessionAction,
    handler: MediaSessionActionHandler | null,
  ) {
    const mediaSession = getMediaSession();

    if (!mediaSession) {
      return;
    }

    try {
      mediaSession.setActionHandler(action, handler);
    } catch {
      // Some browsers throw when unsupported action handlers are registered.
    }
  }

  function setActionHandlers(handlers: MediaSessionActionHandlers) {
    for (const [action, handler] of Object.entries(handlers)) {
      setActionHandler(action as MediaSessionAction, handler ?? null);
    }
  }

  function clearActionHandlers() {
    for (const action of MEDIA_SESSION_ACTIONS) {
      setActionHandler(action, null);
    }
  }

  function setPositionState(positionState?: MediaPositionState | null) {
    const mediaSession = getMediaSession();

    if (!mediaSession || typeof mediaSession.setPositionState !== "function") {
      return;
    }

    try {
      if (!positionState) {
        mediaSession.setPositionState(undefined);
        return;
      }

      mediaSession.setPositionState(positionState);
    } catch {
      // Browsers may reject invalid duration/position combinations.
    }
  }

  function clear() {
    const mediaSession = getMediaSession();

    if (!mediaSession) {
      return;
    }

    clearActionHandlers();
    setPositionState(null);
    mediaSession.playbackState = "none";
    mediaSession.metadata = null;
  }

  return {
    isSupported,
    setMetadata,
    setPlaybackState,
    setActionHandler,
    setActionHandlers,
    clearActionHandlers,
    setPositionState,
    clear,
  };
}
