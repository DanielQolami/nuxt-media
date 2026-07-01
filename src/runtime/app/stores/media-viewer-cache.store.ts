import { defineStore } from "#imports";
import { shallowReactive } from "vue";
import type {
  MediaViewerCacheEntry,
  MediaViewerItem,
} from "../types/media-viewer.types";
import { toCacheEntry } from "../lib/viewer/media-viewer.utils";

function createMediaViewerCacheStore() {
  const entries = shallowReactive<Record<string, MediaViewerCacheEntry>>({});

  function primeItem(item: MediaViewerItem): void {
    entries[item.id] = toCacheEntry(item);
  }

  function primeItems(items: MediaViewerItem[]): void {
    for (const item of items) {
      primeItem(item);
    }
  }

  function getItem(id: string): MediaViewerCacheEntry | undefined {
    return entries[id];
  }

  return {
    entries,
    primeItem,
    primeItems,
    getItem,
  };
}

export const useMediaViewerCacheStore = defineStore(
  "media-viewer-cache",
  createMediaViewerCacheStore,
);
