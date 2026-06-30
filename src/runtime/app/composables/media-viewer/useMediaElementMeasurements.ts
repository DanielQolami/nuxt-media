import type { MaybeRefOrGetter } from "vue";
import { computed, shallowRef, toValue, watch } from "vue";
import { useElementSize } from "#imports";
import {
  getAspectRatioFromSize,
  normalizeAspectRatio,
  type MediaDimensions,
} from "../../lib/viewer/media-viewer.utils";

type MeasurableMediaElement =
  | HTMLElement
  | HTMLImageElement
  | HTMLVideoElement
  | null
  | undefined;

type UseMediaElementMeasurementsOptions = {
  fallbackDimensions?: MaybeRefOrGetter<MediaDimensions | null | undefined>;
};

function readIntrinsicDimensions(
  element: MeasurableMediaElement,
): MediaDimensions {
  if (!element) return { aspectRatio: null };

  if (
    typeof HTMLImageElement !== "undefined" &&
    element instanceof HTMLImageElement &&
    element.naturalWidth > 0 &&
    element.naturalHeight > 0
  ) {
    return {
      width: element.naturalWidth,
      height: element.naturalHeight,
      aspectRatio: element.naturalWidth / element.naturalHeight,
    };
  }

  if (
    typeof HTMLVideoElement !== "undefined" &&
    element instanceof HTMLVideoElement &&
    element.videoWidth > 0 &&
    element.videoHeight > 0
  ) {
    return {
      width: element.videoWidth,
      height: element.videoHeight,
      aspectRatio: element.videoWidth / element.videoHeight,
    };
  }

  return { aspectRatio: null };
}

export function useMediaElementMeasurements(
  elementRef: MaybeRefOrGetter<MeasurableMediaElement>,
  options: UseMediaElementMeasurementsOptions = {},
) {
  const intrinsicWidth = shallowRef<number | undefined>();
  const intrinsicHeight = shallowRef<number | undefined>();
  const { width: renderedWidth, height: renderedHeight } =
    useElementSize(elementRef);

  function setIntrinsicSize(width?: number, height?: number) {
    if (!width || !height || width <= 0 || height <= 0) return;

    intrinsicWidth.value = width;
    intrinsicHeight.value = height;
  }

  function refreshIntrinsicSize() {
    const dimensions = readIntrinsicDimensions(toValue(elementRef));

    setIntrinsicSize(dimensions.width, dimensions.height);
  }

  function onImageLoad(event: Event) {
    const image = event.currentTarget;

    if (
      typeof HTMLImageElement !== "undefined" &&
      image instanceof HTMLImageElement
    ) {
      setIntrinsicSize(image.naturalWidth, image.naturalHeight);
    }
  }

  function onVideoLoadedMetadata(event?: Event) {
    const video = event?.currentTarget ?? toValue(elementRef);

    if (
      typeof HTMLVideoElement !== "undefined" &&
      video instanceof HTMLVideoElement
    ) {
      setIntrinsicSize(video.videoWidth, video.videoHeight);
    }
  }

  const measuredDimensions = computed<MediaDimensions>(() => {
    const fallback = toValue(options.fallbackDimensions) ?? {};
    const measuredAspectRatio = getAspectRatioFromSize(
      intrinsicWidth.value,
      intrinsicHeight.value,
    );
    const renderedAspectRatio = getAspectRatioFromSize(
      renderedWidth.value,
      renderedHeight.value,
    );
    const fallbackAspectRatio = normalizeAspectRatio(fallback.aspectRatio);

    return {
      width:
        intrinsicWidth.value ??
        fallback.width ??
        (renderedWidth.value || undefined),
      height:
        intrinsicHeight.value ??
        fallback.height ??
        (renderedHeight.value || undefined),
      aspectRatio:
        measuredAspectRatio ?? fallbackAspectRatio ?? renderedAspectRatio,
    };
  });

  watch(
    () => toValue(elementRef),
    () => refreshIntrinsicSize(),
    { flush: "post" },
  );

  return {
    renderedWidth,
    renderedHeight,
    intrinsicWidth,
    intrinsicHeight,
    measuredDimensions,
    setIntrinsicSize,
    refreshIntrinsicSize,
    onImageLoad,
    onVideoLoadedMetadata,
  };
}
