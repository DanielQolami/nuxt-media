import { createSharedComposable, useSupported } from "#imports";
import type { ShakaPlayerNamespace } from "../../types/media.types";

const useShakaLoader = createSharedComposable(
  function useShakaLoaderComposable() {
    const isSupported = useSupported(() => import.meta.client);
    let shakaPromise: Promise<ShakaPlayerNamespace> | null = null;

    async function load() {
      if (!isSupported.value) {
        throw new Error("Shaka Player can only be loaded on the client.");
      }

      if (!shakaPromise) {
        shakaPromise = import("shaka-player").then((module) => {
          const shaka = module.default;

          shaka.polyfill.installAll();

          return shaka;
        });
      }

      return shakaPromise;
    }

    function isLoaded() {
      return shakaPromise !== null;
    }

    return {
      isSupported,
      load,
      isLoaded,
    };
  },
);

export { useShakaLoader };
