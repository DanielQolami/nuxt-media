import {
  defineNuxtModule,
  addComponent,
  addImports,
  createResolver,
} from "@nuxt/kit";
import { defu } from "defu";

/**
 * Open-ended Shaka configuration bag forwarded to the player.
 */
type ShakaPlayerConfigurationInput = Record<string, unknown>;

/**
 * Public runtime options for the reusable media module.
 */
type ModuleOptions = {
  enabled: boolean;
  shaka: {
    preload: "none" | "metadata" | "auto";
    preferredAudio?: string;
    preferredText?: string;
    playerConfig: ShakaPlayerConfigurationInput;
  };
  mediaSession: {
    enabled: boolean;
    defaultArtwork: Array<{
      src: string;
      sizes?: string;
      type?: string;
    }>;
  };
};

/**
 * Media dependencies that benefit from eager optimization in Vite dev mode.
 */
const MEDIA_OPTIMIZE_DEPS = ["shaka-player", "clsx", "tailwind-merge"] as const;

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: "nuxt-media",
    configKey: "media",
    compatibility: {
      nuxt: ">=4.4.0",
    },
  },
  moduleDependencies: {
    "@nuxt/image": {
      version: ">=2.0.0",
    },
    "@nuxt/ui": {
      version: ">=4.9.0",
    },
    "@pinia/nuxt": {
      version: ">=0.11.0",
    },
    "@vueuse/nuxt": {
      version: ">=14.3.0",
    },
    /* "shaka-player": {
      version: ">=5.1.0",
    }, */
    /* "tailwindcss": {
      version: ">=4.3.0",
    }, */
  },
  // Default configuration options of the Nuxt module
  defaults: {
    enabled: true,
    shaka: {
      preload: "metadata",
      preferredAudio: "fa-IR",
      preferredText: "fa-IR",
      playerConfig: {
        streaming: {
          retryParameters: {
            maxAttempts: 4,
            baseDelay: 1_000,
            backoffFactor: 2,
            fuzzFactor: 0.5,
            timeout: 30_000,
          },
          bufferingGoal: 30,
          rebufferingGoal: 15,
          bufferBehind: 30,
        },
      },
    },
    mediaSession: {
      enabled: true,
      defaultArtwork: [],
    },
  },
  /**
   * Expose the media API and merge runtime defaults so the module stays portable.
   */
  setup(options, nuxt) {
    const resolver = createResolver(import.meta.url);

    // We can inject our CSS file which includes Tailwind's directives
    const css = resolver.resolve("./runtime/app/assets/main.css");
    if (!nuxt.options.css.includes(css)) {
      nuxt.options.css.unshift(css);
    }

    const viteOptions = (nuxt.options.vite = defu(nuxt.options.vite ?? {}, {
      optimizeDeps: {
        include: [],
      },
    }));

    const optimizeDeps = viteOptions.optimizeDeps ??= { include: [] };

    optimizeDeps.include = [
      ...new Set([
        ...(optimizeDeps.include ?? []),
        ...MEDIA_OPTIMIZE_DEPS,
      ]),
    ];

    const publicRuntimeConfig = nuxt.options.runtimeConfig.public as Record<
      string,
      unknown
    > & {
      appMedia?: ModuleOptions;
    };

    publicRuntimeConfig.appMedia = defu(
      {
        enabled: options.enabled,
        shaka: options.shaka,
        mediaSession: options.mediaSession,
      },
      publicRuntimeConfig.appMedia || {},
    ) as ModuleOptions;

    // export Components
    addComponent({
      name: "MediaAudioPlayer",
      filePath: resolver.resolve(
        "./runtime/app/components/MediaAudioPlayer.vue",
      ),
    });
    addComponent({
      name: "MediaVideoPlayer",
      filePath: resolver.resolve(
        "./runtime/app/components/MediaVideoPlayer.vue",
      ),
    });
    addComponent({
      name: "MediaViewerGallery",
      filePath: resolver.resolve(
        "./runtime/app/components/MediaViewerGallery.vue",
      ),
    });
    addComponent({
      name: "MediaViewerSlide",
      filePath: resolver.resolve(
        "./runtime/app/components/MediaViewerSlide.vue",
      ),
    });

    // export composables
    // Do not add the extension since the `.ts` will be transpiled to `.mjs` after `npm run prepack`
    addImports([
      {
        name: "useAudioPlayer",
        from: resolver.resolve("./runtime/app/composables/useAudioPlayer"),
      },
      {
        name: "useVideoPlayer",
        from: resolver.resolve("./runtime/app/composables/useVideoPlayer"),
      },
      {
        name: "useShakaPlayer",
        from: resolver.resolve("./runtime/app/composables/useShakaPlayer"),
      },
      {
        name: "useMediaSession",
        from: resolver.resolve("./runtime/app/composables/useMediaSession"),
      },
    ]);

    // export Types
    addImports([
      {
        name: "MediaViewerItem",
        type: true,
        from: resolver.resolve("./runtime/app/types/media-viewer.types"),
      },
      {
        name: "MediaVideoPlayerProps",
        type: true,
        from: resolver.resolve("./runtime/app/types/media.types"),
      },
      {
        name: "MediaAudioPlayerProps",
        type: true,
        from: resolver.resolve("./runtime/app/types/media.types"),
      },
    ]);
  },
});
