import type {
  MediaArtworkSource,
  MediaSessionMetadataDraft,
  MediaSessionMetadataInput,
} from "../../types/media.types";
import type {
  MediaViewerCacheEntry,
  MediaViewerCaptionPlacement,
  MediaViewerItem,
  MediaViewerLayoutKind,
  MediaViewerMediaLayoutHint,
} from "../../types/media-viewer.types";

interface MediaViewerMetricEvent {
  type:
    | "open"
    | "close"
    | "slide-change"
    | "zoom-change"
    | "download"
    | "preload";
  galleryKey: string;
  slideId?: string;
  index?: number;
  zoom?: number;
  url?: string;
  direction?: "next" | "previous";
}

interface MediaDimensions {
  width?: number;
  height?: number;
  aspectRatio?: number | null;
}

interface ChooseCaptionPlacementInput {
  containerWidth: number;
  containerHeight: number;
  mediaKind?: MediaViewerLayoutKind;
  mediaAspectRatio?: number | null;
  mediaWidth?: number;
  mediaHeight?: number;
  preferredPlacement?: "auto" | MediaViewerCaptionPlacement;
  minSideWidth?: number;
  maxSideWidth?: number;
  minMainWidth?: number;
  gap?: number;
  mobileBreakpoint?: number;
  /** Auto mode keeps wide, video-like media above the caption instead of squeezing it beside a side panel. */
  wideAspectRatioThreshold?: number;
}

function wrapIndex(index: number, length: number): number {
  if (length <= 0) return 0;

  return ((index % length) + length) % length;
}

function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;

  return Math.max(0, Math.min(index, length - 1));
}

function isHttpLikeUrl(url: string): boolean {
  try {
    const parsed = new URL(url, "https://example.com");

    return parsed.protocol === "http:" || parsed.protocol === "https:";
  }
  catch {
    return false;
  }
}

function resolveDownloadUrl(item: MediaViewerItem): string | undefined {
  if (item.hideDownload) return undefined;

  if (item.downloadUrl && isHttpLikeUrl(item.downloadUrl))
    return item.downloadUrl;

  if (
    (item.kind === "image" || item.kind === "video" || item.kind === "audio")
    && isHttpLikeUrl(item.src)
  ) {
    return item.src;
  }

  return undefined;
}

function getThumbnailSource(item: MediaViewerItem): string | undefined {
  if (item.kind === "image") return item.thumbnailSrc || item.src;

  if (item.kind === "video" || item.kind === "audio") return item.poster;

  return undefined;
}

function toCacheEntry(item: MediaViewerItem): MediaViewerCacheEntry {
  return {
    id: item.id,
    kind: item.kind,
    src: item.src,
    sources: "sources" in item ? item.sources : undefined,
    thumbnailSrc: getThumbnailSource(item),
    poster: "poster" in item ? item.poster : undefined,
    width: "width" in item ? item.width : undefined,
    height: "height" in item ? item.height : undefined,
    lqip: item.lqip,
    title: item.title,
    caption: item.caption,
    slideCaption: item.slideCaption,
    downloadUrl: resolveDownloadUrl(item),
    viewerLayout: item.viewerLayout,
  };
}

function normalizeText(value: string | null | undefined): string | undefined {
  const normalized = value?.replace(/\s+/g, " ").trim();

  return normalized || undefined;
}

function normalizeArtwork(
  artwork: MediaArtworkSource[] | undefined,
  fallbackArtwork?: MediaArtworkSource[],
): MediaArtworkSource[] | undefined {
  if (artwork?.length) return artwork;
  if (fallbackArtwork?.length) return fallbackArtwork;

  return undefined;
}

function normalizeMediaSessionMetadata(
  metadata?: MediaSessionMetadataDraft | MediaSessionMetadataInput | null,
  fallbackTitle?: string,
  fallbackArtwork?: MediaArtworkSource[],
): MediaSessionMetadataInput | undefined {
  const title = normalizeText(metadata?.title) || normalizeText(fallbackTitle);
  const artist = normalizeText(metadata?.artist);
  const album = normalizeText(metadata?.album);
  const artwork = normalizeArtwork(metadata?.artwork, fallbackArtwork);

  if (!title && !artist && !album && !artwork?.length) return undefined;

  return {
    title: title || "Untitled media",
    artist,
    album,
    artwork,
  };
}

function createMediaSessionMetadataFromViewerItem(
  item: MediaViewerItem,
): MediaSessionMetadataInput | undefined {
  const metadata = "metadata" in item ? item.metadata : undefined;
  const posterArtwork =
    "poster" in item && item.poster
      ? [
          {
            src: item.poster,
            sizes: "512x512",
          },
        ]
      : undefined;

  return normalizeMediaSessionMetadata(metadata, item.title, posterArtwork);
}

function normalizeAspectRatio(value: number | null | undefined): number | null {
  if (!Number.isFinite(value) || !value || value <= 0) return null;

  return value;
}

function getAspectRatioFromSize(
  width?: number,
  height?: number,
): number | null {
  if (!width || !height || width <= 0 || height <= 0) return null;

  return width / height;
}

function getDeclaredMediaDimensions(
  item: MediaViewerItem | null | undefined,
): MediaDimensions {
  if (!item) return { aspectRatio: null };

  const width = "width" in item && item.width ? item.width : undefined;
  const height = "height" in item && item.height ? item.height : undefined;

  return {
    width,
    height,
    aspectRatio: getAspectRatioFromSize(width, height),
  };
}

function getMediaAspectRatio(
  item: MediaViewerItem | null | undefined,
): number | null | undefined {
  return getDeclaredMediaDimensions(item).aspectRatio;
}

function getDefaultMediaAspectRatio(
  kind: MediaViewerLayoutKind | undefined,
): number | null {
  switch (kind) {
    case "video":
    case "map":
      return 16 / 9;
    case "pdf":
      return 3 / 4;
    case "image":
    case "audio":
    case "custom":
    default:
      return null;
  }
}

function mergeMediaDimensions(
  declared: MediaDimensions,
  measured: MediaDimensions,
  explicit?: MediaDimensions,
): MediaDimensions {
  const width = explicit?.width ?? measured.width ?? declared.width;
  const height = explicit?.height ?? measured.height ?? declared.height;
  const aspectRatio =
    normalizeAspectRatio(explicit?.aspectRatio)
    ?? normalizeAspectRatio(measured.aspectRatio)
    ?? getAspectRatioFromSize(width, height)
    ?? normalizeAspectRatio(declared.aspectRatio);

  return { width, height, aspectRatio };
}

function resolveMediaLayoutHint(
  item: MediaViewerItem | null | undefined,
  overrides: MediaViewerMediaLayoutHint = {},
): MediaViewerMediaLayoutHint {
  const declared = getDeclaredMediaDimensions(item);
  const kind =
    overrides.kind ?? item?.viewerLayout?.kind ?? item?.kind ?? "custom";
  const explicitDimensions = {
    width: overrides.width,
    height: overrides.height,
    aspectRatio: overrides.aspectRatio,
  };
  const merged = mergeMediaDimensions(declared, {}, explicitDimensions);
  const fallbackAspectRatio = getDefaultMediaAspectRatio(kind);

  return {
    ...item?.viewerLayout,
    ...overrides,
    kind,
    width: merged.width,
    height: merged.height,
    aspectRatio: merged.aspectRatio ?? fallbackAspectRatio,
    preferredCaptionPlacement:
      overrides.preferredCaptionPlacement
      ?? item?.viewerLayout?.preferredCaptionPlacement
      ?? "auto",
    gap: overrides.gap ?? item?.viewerLayout?.gap ?? 24,
  };
}

function estimateFittedMediaWidth(params: {
  containerWidth: number;
  containerHeight: number;
  mediaAspectRatio?: number | null;
  mediaWidth?: number;
  mediaHeight?: number;
}) {
  const {
    containerWidth,
    containerHeight,
    mediaAspectRatio,
    mediaWidth,
    mediaHeight,
  } = params;

  if (mediaWidth && mediaWidth > 0) return Math.min(containerWidth, mediaWidth);

  if (
    mediaHeight
    && mediaHeight > 0
    && mediaAspectRatio
    && mediaAspectRatio > 0
  ) {
    return Math.min(containerWidth, mediaHeight * mediaAspectRatio);
  }

  if (mediaAspectRatio && mediaAspectRatio > 0) {
    return Math.min(containerWidth, containerHeight * mediaAspectRatio);
  }

  return Math.min(containerWidth, 720);
}

function isWideMedia(
  kind: MediaViewerLayoutKind,
  aspectRatio: number | null,
  threshold: number,
) {
  if (kind === "audio" || kind === "pdf") return false;
  if (kind === "video" || kind === "map") return true;

  return Boolean(aspectRatio && aspectRatio >= threshold);
}

function chooseCaptionPlacement(
  input: ChooseCaptionPlacementInput,
): MediaViewerCaptionPlacement {
  const {
    containerWidth,
    containerHeight,
    mediaKind = "custom",
    mediaAspectRatio,
    mediaWidth,
    mediaHeight,
    preferredPlacement = "auto",
    minSideWidth = 304,
    maxSideWidth = 448,
    minMainWidth,
    gap = 24,
    mobileBreakpoint = 768,
    wideAspectRatioThreshold = 1.45,
  } = input;

  if (preferredPlacement === "below") return "below";
  if (containerWidth < mobileBreakpoint) return "below";
  if (containerWidth <= 0 || containerHeight <= 0) return "below";

  const effectiveAspectRatio =
    normalizeAspectRatio(mediaAspectRatio)
    ?? getAspectRatioFromSize(mediaWidth, mediaHeight)
    ?? getDefaultMediaAspectRatio(mediaKind);

  // Wide/video-like media should keep its horizontal space. A side caption makes it visually too small,
  // especially before intrinsic video dimensions are available.
  if (
    preferredPlacement !== "side"
    && isWideMedia(mediaKind, effectiveAspectRatio, wideAspectRatioThreshold)
  ) {
    return "below";
  }

  if (preferredPlacement === "side") return "side";

  const kindMainWidthFloor =
    minMainWidth
    ?? (
      {
        image: 360,
        video: 560,
        audio: 360,
        map: 560,
        pdf: 420,
        custom: 360,
      } satisfies Record<MediaViewerLayoutKind, number>
    )[mediaKind];

  const sideWidth = Math.min(Math.max(minSideWidth, 280), maxSideWidth);
  const mediaSlotWidth = Math.max(containerWidth - sideWidth - gap, 1);

  if (mediaSlotWidth < kindMainWidthFloor) return "below";

  const fittedMediaWidth = estimateFittedMediaWidth({
    containerWidth: mediaSlotWidth,
    containerHeight,
    mediaAspectRatio: effectiveAspectRatio,
    mediaWidth,
    mediaHeight,
  });

  const unusedSideSpace = containerWidth - fittedMediaWidth - gap;
  const mediaIsNarrow = Boolean(
    effectiveAspectRatio && effectiveAspectRatio < 1.05,
  );

  if (
    mediaKind === "audio"
    && containerWidth >= kindMainWidthFloor + sideWidth + gap
  )
    return "side";
  if (
    mediaKind === "pdf"
    && containerWidth >= fittedMediaWidth + sideWidth + gap
  )
    return "side";
  if (mediaIsNarrow && unusedSideSpace >= sideWidth) return "side";
  if (
    mediaKind === "custom"
    && effectiveAspectRatio === null
    && containerWidth >= 1180
  )
    return "side";

  return "below";
}

export {
  type MediaDimensions,
  type MediaViewerMetricEvent,
  wrapIndex,
  clampIndex,
  isHttpLikeUrl,
  resolveDownloadUrl,
  toCacheEntry,
  normalizeText,
  normalizeMediaSessionMetadata,
  createMediaSessionMetadataFromViewerItem,
  normalizeAspectRatio,
  getAspectRatioFromSize,
  getDeclaredMediaDimensions,
  getMediaAspectRatio,
  getDefaultMediaAspectRatio,
  mergeMediaDimensions,
  resolveMediaLayoutHint,
  chooseCaptionPlacement,
};
