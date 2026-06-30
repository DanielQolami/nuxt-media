import type {
  MediaPlayerElementRef,
  UseAudioPlayerOptions,
} from "../types/media.types.ts";
import { useShakaPlayer } from "./useShakaPlayer";

export function useAudioPlayer(
  mediaElementRef: MediaPlayerElementRef,
  options: UseAudioPlayerOptions = {},
) {
  return useShakaPlayer(mediaElementRef, {
    ...options,
    kind: "audio",
  });
}
