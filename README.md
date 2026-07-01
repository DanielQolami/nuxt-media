# Nuxt Media

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![License][license-src]][license-href]
[![Nuxt][nuxt-src]][nuxt-href]

Shaka-backed **audio/video** players and a fullscreen **media gallery** for images, video, audio, maps, PDFs, and future custom renderers. Designed for **Nuxt 4** + **Vue 3** (Nuxt UI v4, Tailwind v4, VueUse, Pinia compatible).

## What this module gives you

### Players (focus)
- **`MediaVideoPlayer`**: uses native `<video>` + Shaka Player for DASH/HLS streaming.
- **`MediaAudioPlayer`**: uses native `<audio>` + Shaka Player for DASH/HLS streaming.

Both players support:
- configurable Shaka options via runtime config
- a quality selector when multiple qualities/variants are available
- **ABR (Auto)** for DASH/HLS when applicable
- **metadata-driven** media session fields (where enabled by config)
- default file types are acceptable (.mp4, .mp3, ...)

### Gallery (extensible)
- **`MediaViewerGallery`**: fullscreen modal “shell” that handles route/query syncing, keyboard navigation, preloading, click-outside, and caption rendering.
- **`MediaViewerSlide`**: chooses the correct renderer for the active item and handles media measurement + image zoom/pan behaviors.
- Future-ready: map/PDF/custom renderers can be added and contributed via the renderer/slot mechanism.

> Contribution welcome: if you want to add a new slide renderer (e.g., map tiles, PDF viewer, or custom HTML), build it as a gallery slide renderer and wire it into the renderer registry/slots.

---

## Features

- **Shaka-backed** HTML5 **video & audio** playback
- **Quality selection** (explicit qualities and/or Shaka variant tracks)
- **ABR Auto** (DASH/HLS) + manual variant selection (locks the track)
- **Fullscreen viewer gallery**
  - modal + navigation + preloading + click-outside
  - caption placement rules
  - image zoom/pan/pinch + measurement
- **Extensible slide rendering**
  - custom slide renderers via `slide-media` slot

---

## Quick setup

Install:

```bash
pnpm add nuxt-media
```

### Runtime config (`nuxt.config.ts`)

```ts
export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      appMedia: {
        enabled: true,

        shaka: {
          preload: "metadata",
          preferredAudio: "en",
          preferredText: "en",
          playerConfig: {},
        },

        mediaSession: {
          enabled: true,
          defaultArtwork: [
            {
              src: "/icons/media-512.png",
              sizes: "512x512",
              type: "image/png",
            },
          ],
        },
      },
    },
  },
});
```

---

## Video & Audio item schema (for the gallery)

Gallery items include a `kind` and shared metadata used by player/slide renderers.

```ts
type MediaViewerItem =
  | MediaViewerImageItem
  | MediaViewerVideoItem
  | MediaViewerAudioItem
  | MediaViewerMapItem
  | MediaViewerPdfItem;

type CommonFields = {
  id: string;
  kind: "image" | "video" | "audio" | "map" | "pdf";
  title?: string;
  caption?: string;
  slideCaption?: string | null;
  alt?: string;
  description?: string;
  downloadUrl?: string;
  hideDownload?: boolean;
  lqip?: string;
  viewerLayout?: MediaViewerMediaLayoutHint;
};
```

Images may omit `width`/`height`. The viewer measures loaded images using `naturalWidth`/`naturalHeight` and uses backend dimensions as fallbacks.

---

## MediaVideoPlayer (Shaka + native `<video>`)

### Adaptive manifest (DASH/HLS)
```vue
<MediaVideoPlayer
  src="/media/film.mpd"
  mime-type="application/dash+xml"
  poster="/media/film-poster.jpg"
  title="Film"
  :metadata="{
    title: 'Film',
    artist: 'Science Lab',
  }"
/>
```

### Explicit quality sources (manual quality selection)
```vue
<MediaVideoPlayer
  :sources="[
    { src: '/media/video-1080.mp4', label: '1080p', height: 1080, mimeType: 'video/mp4', isDefault: true },
    { src: '/media/video-720.mp4', label: '720p', height: 720, mimeType: 'video/mp4' },
  ]"
  poster="/media/video-poster.jpg"
/>
```

### Quality behavior (important)
- A quality selector appears when there are **multiple explicit sources** and/or **multiple Shaka variant tracks**.
- For DASH/HLS:
  - **Auto** enables **ABR**.
  - Selecting a specific variant **disables ABR** and locks the chosen track.

---

## MediaAudioPlayer (Shaka + native `<audio>`)

### Adaptive manifest (DASH/HLS)
```vue
<MediaAudioPlayer
  src="/media/audio.mpd"
  mime-type="application/dash+xml"
  title="Audio title"
  :metadata="{
    title: 'Audio title',
    artist: 'Creator name',
  }"
/>
```

### Quality behavior
- When multiple variants are available, the player exposes a quality selector.
- The audio component renders only the `<audio>` element (+ optional quality selector).
  - **Artwork/posters should be rendered by the gallery slide**, not by the audio player component.

---

## MediaViewerGallery (fullscreen modal)

### Basic usage
```vue
<script setup lang="ts">
const items = [imageItem, videoItem, audioItem];
</script>

<template>
  <MediaViewerGallery gallery-key="project-media" :items="items" />
</template>
```

### Captions are opt-in
- If you don’t provide `slideCaption` and you don’t use the `slide-caption` slot, the viewer won’t render the `<aside>` and the media fills the available space.

### Custom thumbnail
```vue
<MediaViewerGallery gallery-key="project-media" :items="items">
  <template v-slot:thumbnail="{ item }">
    <div class="aspect-video bg-muted">
      <NuxtImg
        v-if="item.kind === 'image'"
        :src="item.thumbnailSrc || item.src"
        :alt="item.alt || item.title || ''"
        class="size-full object-cover"
      />
      <NuxtImg
        v-else-if="'poster' in item && item.poster"
        :src="item.poster"
        :alt="item.title || item.kind"
        class="size-full object-cover"
      />
    </div>
  </template>
</MediaViewerGallery>
```

### Custom slide caption
```vue
<MediaViewerGallery gallery-key="project-media" :items="items">
  <template v-slot:slide-caption="{ item, placement }">
    <div class="space-y-2">
      <p class="text-sm opacity-70">{{ placement }}</p>
      <h2 class="text-lg font-semibold">{{ item.title }}</h2>
      <p>{{ item.slideCaption }}</p>
    </div>
  </template>
</MediaViewerGallery>
```

### Caption placement rules (high level)
- Mobile: captions are below.
- Wide/video-like media: captions are below.
- Narrow/portrait media: captions may be beside when there’s enough room.
- Audio: captions may be beside the audio card on large screens.
- Custom renderers can influence placement via `viewerLayout`.

---

## Extending slide rendering (maps, PDFs, custom HTML)

In the future, the gallery aims to support additional kinds (e.g., **map** and **PDF**) and custom HTML renderers.

We encourage contributions by adding new slide renderers using the slot-based renderer hook below.

### `slide-media` slot for custom renderers
```vue
<MediaViewerGallery gallery-key="places" :items="items">
  <template
    v-slot:slide-media="{ item, mediaLayout, setMediaElement, setZoom, next, previous }"
  >
    <div
      :ref="setMediaElement"
      class="grid h-[min(80dvh,720px)] w-[min(100%,80rem)] place-items-center rounded-3xl bg-muted"
    >
      Custom renderer for {{ item.kind }}
    </div>
  </template>
</MediaViewerGallery>
```

Important:
- Always bind `setMediaElement` to the **real interactive media element**.
  - The gallery uses it for click-outside detection and measurement.
- Use `setZoom` when your renderer supports zoom behavior (e.g., custom image-like media).

---

## Composables

### `useShakaPlayer(mediaElementRef, options)`
Low-level Shaka wrapper used by both audio and video players.

Returns:
- `player`, `shaka`, `error`
- `activeSource`, `isLoading`, `isReady`
- `variantTracks`, `activeVariantTrack`
- `isAbrEnabled`
- methods: `attach()`, `load()`, `play()`, `pause()`, `stop()`, `setAbrEnabled()`, `selectVariantTrack()`, `destroy()`

### `useVideoPlayer()` and `useAudioPlayer()`
Thin wrappers around `useShakaPlayer()` that set `kind: "video"` / `kind: "audio"`.

### `useMediaPlayerQuality()`
Shared quality-source logic for `MediaVideoPlayer` and `MediaAudioPlayer`:
- normalizes explicit sources
- builds quality options
- preserves current time while switching explicit sources
- emits `quality-change` events

### `useMediaViewerGallery()` and `useMediaViewerSlide()`
Own gallery and slide state:
- modal lifecycle, route/query syncing, active item safety
- caption visibility/placement, preloading, keyboard navigation, click-outside, metrics
- renderer selection, slide media refs, media session metadata, image measurement

### `useImageZoomPan()` and `useMediaElementMeasurements()`
- zoom/pan/pinch/double-tap + pan clamping
- rendered size + intrinsic dimensions via `naturalWidth`/`naturalHeight` (images) and `videoWidth`/`videoHeight` (videos)

---

## Migration notes

### Rename `viewerCaption` → `slideCaption`
Before:
```ts
{ viewerCaption: "Shown in the fullscreen viewer." }
```

After:
```ts
{ slideCaption: "Shown in the fullscreen viewer." }
```

### Wide media now prefers below captions
In automatic mode, wide video-like aspect ratios use below-caption layout to avoid placing a 16:9 player beside a side panel.

---

## Development

```bash
pnpm install
pnpm dev:prepare
pnpm dev
pnpm dev:build
pnpm lint
pnpm test
pnpm test:watch
pnpm release
```

---

## GitHub

https://github.com/DanielQolami/nuxt-media

[npm-version-src]: https://img.shields.io/npm/v/nuxt-media/latest.svg?style=flat&colorA=020420&colorB=00DC82
[npm-version-href]: https://npmjs.com/package/nuxt-media
[npm-downloads-src]: https://img.shields.io/npm/dm/nuxt-media.svg?style=flat&colorA=020420&colorB=00DC82
[npm-downloads-href]: https://npm.chart.dev/nuxt-media
[license-src]: https://img.shields.io/npm/l/nuxt-media.svg?style=flat&colorA=020420&colorB=00DC82
[license-href]: https://npmjs.com/package/nuxt-media
[nuxt-src]: https://img.shields.io/badge/Nuxt-020420?logo=nuxt
[nuxt-href]: https://nuxt.com
