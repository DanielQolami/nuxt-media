import type {
  MediaPlayerElementRef,
  UseVideoPlayerOptions,
} from "../types/media.types";
import { useShakaPlayer } from "./useShakaPlayer";

export function useVideoPlayer(
  mediaElementRef: MediaPlayerElementRef,
  options: UseVideoPlayerOptions = {},
) {
  return useShakaPlayer(mediaElementRef, {
    ...options,
    kind: "video",
  });
}
