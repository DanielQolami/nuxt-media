import { shallowRef } from "vue";
import type {
  MediaViewerCacheEntry,
  MediaViewerItem,
} from "../../types/media-viewer.types";
import { toCacheEntry } from "../../lib/viewer/media-viewer.utils";

export function useMediaViewerCache() {
  // if we need to export this composable, globally, we can put this variable outside of the composable as a singleton source.
  const entries = shallowRef<Record<string, MediaViewerCacheEntry>>({});

  function primeItem(item: MediaViewerItem): void {
    (entries.value as Record<string, MediaViewerCacheEntry>)[item.id] =
      toCacheEntry(item);
  }

  function primeItems(items: MediaViewerItem[]): void {
    for (const item of items) {
      primeItem(item);
    }
  }

  function getItem(id: string): MediaViewerCacheEntry | undefined {
    return entries.value[id];
  }

  return {
    entries,
    primeItem,
    primeItems,
    getItem,
  };
}
