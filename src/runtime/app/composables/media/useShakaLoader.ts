import { createSharedComposable, useSupported } from "#imports";
import type { ShakaPlayerNamespace } from "../../types/media.types";

const useShakaLoader = createSharedComposable(
  function useShakaLoaderComposable() {
    const isSupported = useSupported(() => import.meta.client);
    let shaka: ShakaPlayerNamespace | null = null;

    async function load() {
      if (!isSupported.value) {
        throw new Error("Shaka Player can only be loaded on the client.");
      }

      if (shaka === null) {
        const shakaModule = await import("shaka-player");
        // shakaModule.default.polyfill.installAll();
        shaka = shakaModule.default as ShakaPlayerNamespace;
      }

      return Promise.resolve(shaka);
    }

    function isLoaded() {
      return shaka !== null;
    }

    return {
      isSupported,
      load,
      isLoaded,
    };
  },
);

export { useShakaLoader };
