import type {
  MediaArtworkSource,
  MediaPlayerQualitySource,
  MediaSessionMetadataDraft,
} from "./media.types";

type MediaViewerKind = "image" | "video" | "audio" | "map" | "pdf";
type MediaViewerCaptionPlacement = "side" | "below";
type MediaViewerCaptionPlacementPreference =
  | MediaViewerCaptionPlacement
  | "auto";
type MediaViewerLayoutKind = MediaViewerKind | "custom";

interface MediaViewerMediaLayoutHint {
  kind?: MediaViewerLayoutKind;
  width?: number;
  height?: number;
  aspectRatio?: number | null;
  preferredCaptionPlacement?: MediaViewerCaptionPlacementPreference;
  minSideWidth?: number;
  maxSideWidth?: number;
  minMainWidth?: number;
  gap?: number;
}

interface MediaViewerBaseItem {
  id: string;
  kind: MediaViewerKind;

  title?: string;
  caption?: string;
  slideCaption?: string | null;

  alt?: string;
  description?: string;

  downloadUrl?: string;
  hideDownload?: boolean;

  lqip?: string;
  viewerLayout?: MediaViewerMediaLayoutHint;
}

interface MediaViewerImageItem extends MediaViewerBaseItem {
  kind: "image";
  src: string;
  thumbnailSrc?: string;
  width?: number;
  height?: number;
  srcSet?: string;
  sizes?: string;
}

interface MediaViewerVideoTextTrack {
  src: string;
  srclang: string;
  label: string;
  kind?: "subtitles" | "captions" | "descriptions" | "chapters" | "metadata";
  default?: boolean;
}

interface MediaViewerVideoItem extends MediaViewerBaseItem {
  kind: "video";
  src: string;
  sources?: MediaPlayerQualitySource[];
  mimeType?: string;
  poster?: string;
  metadata?: MediaSessionMetadataDraft;
  textTracks?: MediaViewerVideoTextTrack[];
  width?: number;
  height?: number;
}

interface MediaViewerAudioItem extends MediaViewerBaseItem {
  kind: "audio";
  src: string;
  sources?: MediaPlayerQualitySource[];
  mimeType?: string;
  poster?: string;
  metadata?: MediaSessionMetadataDraft;
}

interface MediaViewerMapItem extends MediaViewerBaseItem {
  kind: "map";
  src: string;
  width?: number;
  height?: number;
}

interface MediaViewerPdfItem extends MediaViewerBaseItem {
  kind: "pdf";
  src: string;
  width?: number;
  height?: number;
}

type MediaViewerItem =
  | MediaViewerImageItem
  | MediaViewerVideoItem
  | MediaViewerAudioItem
  | MediaViewerMapItem
  | MediaViewerPdfItem;

interface MediaViewerCacheEntry {
  id: string;
  kind: MediaViewerKind;

  src: string;
  sources?: MediaPlayerQualitySource[];
  thumbnailSrc?: string;
  poster?: string;
  width?: number;
  height?: number;
  lqip?: string;

  title?: string;
  caption?: string;
  slideCaption?: string | null;

  downloadUrl?: string;
  viewerLayout?: MediaViewerMediaLayoutHint;
}

export type {
  MediaArtworkSource,
  MediaViewerKind,
  MediaViewerCaptionPlacement,
  MediaViewerCaptionPlacementPreference,
  MediaViewerLayoutKind,
  MediaViewerMediaLayoutHint,
  MediaViewerBaseItem,
  MediaViewerImageItem,
  MediaViewerVideoTextTrack,
  MediaViewerVideoItem,
  MediaViewerAudioItem,
  MediaViewerMapItem,
  MediaViewerPdfItem,
  MediaViewerItem,
  MediaViewerCacheEntry,
};
