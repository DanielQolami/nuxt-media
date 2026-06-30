import type { MaybeRefOrGetter, HTMLAttributes } from "vue";
import type { MediaViewerVideoTextTrack } from "./media-viewer.types";

type ShakaPlayerNamespace = (typeof import("shaka-player"))["default"];
type ShakaPlayerInstance = InstanceType<ShakaPlayerNamespace["Player"]>;
type ShakaPlayerConfigurationInput = Record<string, unknown>;

type MediaPlayerKind = "audio" | "video";

type MediaArtworkSource = {
  src: string;
  sizes?: string;
  type?: string;
};

type MediaSessionMetadataInput = {
  title: string;
  artist?: string;
  album?: string;
  artwork?: MediaArtworkSource[];
};

type MediaSessionMetadataDraft = Partial<
  Omit<MediaSessionMetadataInput, "artwork">
> & {
  artwork?: MediaArtworkSource[];
};

type MediaSessionActionHandlers = Partial<
  Record<MediaSessionAction, MediaSessionActionHandler | null>
>;

type ShakaSourceDefinition = {
  src: string;
  mimeType?: string | null;
  poster?: string;
  startTime?: number | null;
  metadata?: MediaSessionMetadataInput;
};

type MediaPlayerQualitySource = ShakaSourceDefinition & {
  id?: string;
  label?: string;
  width?: number;
  height?: number;
  bitrate?: number;
  codecs?: string;
  isDefault?: boolean;
};

type MediaPlayerSource = string | ShakaSourceDefinition;

type ShakaVariantTrack = {
  id: number;
  active?: boolean;
  type?: string;
  bandwidth?: number;
  language?: string;
  label?: string;
  width?: number;
  height?: number;
  frameRate?: number;
  channelsCount?: number;
  audioBandwidth?: number;
  videoBandwidth?: number;
  audioCodec?: string;
  videoCodec?: string;
  audioId?: number;
  videoId?: number;
  roles?: string[];
  forced?: boolean;
  [key: string]: unknown;
};

type UseShakaPlayerOptions = {
  kind?: MediaPlayerKind;
  autoAttach?: boolean;
  autoplay?: boolean;
  playerConfig?: ShakaPlayerConfigurationInput;
  mediaSession?: {
    enabled?: boolean;
    metadata?: MediaSessionMetadataInput;
    actionHandlers?: MediaSessionActionHandlers;
    seekOffsetSeconds?: number;
  };
};

type ShakaLoadOptions = {
  autoplay?: boolean;
  mimeType?: string | null;
  poster?: string;
  startTime?: number | null;
  metadata?: MediaSessionMetadataInput;
  playerConfig?: ShakaPlayerConfigurationInput;
};

type UseAudioPlayerOptions = Omit<UseShakaPlayerOptions, "kind">;
type UseVideoPlayerOptions = Omit<UseShakaPlayerOptions, "kind">;

type MediaPlayerElementRef = MaybeRefOrGetter<
  HTMLMediaElement | null | undefined
>;

// Components
interface MediaVideoPlayerProps {
  src?: MediaPlayerSource | null;
  sources?: MediaPlayerQualitySource[];
  title?: string;
  mimeType?: string | null;
  metadata?: MediaSessionMetadataDraft;
  textTracks?: MediaViewerVideoTextTrack[];
  autoplay?: boolean;
  controls?: boolean;
  loop?: boolean;
  muted?: boolean;
  playsinline?: boolean;
  preload?: "none" | "metadata" | "auto";
  poster?: string;
  showQualitySelector?: boolean;
  class?: HTMLAttributes["class"];
  containerClass?: HTMLAttributes["class"];
}

interface MediaAudioPlayerProps {
  src?: MediaPlayerSource | null;
  sources?: MediaPlayerQualitySource[];
  title?: string;
  mimeType?: string | null;
  metadata?: MediaSessionMetadataDraft;
  autoplay?: boolean;
  controls?: boolean;
  loop?: boolean;
  muted?: boolean;
  preload?: "none" | "metadata" | "auto";
  showQualitySelector?: boolean;
  class?: HTMLAttributes["class"];
  containerClass?: HTMLAttributes["class"];
}

export type {
  MediaArtworkSource,
  MediaPlayerElementRef,
  MediaPlayerKind,
  MediaPlayerQualitySource,
  MediaPlayerSource,
  MediaSessionActionHandlers,
  MediaSessionMetadataDraft,
  MediaSessionMetadataInput,
  ShakaLoadOptions,
  ShakaPlayerConfigurationInput,
  ShakaPlayerInstance,
  ShakaPlayerNamespace,
  ShakaSourceDefinition,
  ShakaVariantTrack,
  UseAudioPlayerOptions,
  UseShakaPlayerOptions,
  UseVideoPlayerOptions,
  MediaVideoPlayerProps,
  MediaAudioPlayerProps,
};
