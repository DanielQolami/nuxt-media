# Nuxt Media

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![License][license-src]][license-href]
[![Nuxt][nuxt-src]][nuxt-href]

Shaka-backed audio/video players and a fullscreen media gallery for images, video, audio, maps, PDFs, and future custom renderers. Built for Nuxt 4 + Vue 3 (Nuxt UI v4, Tailwind v4, VueUse, Pinia supported).

## Features

- **Media players**
  - `MediaVideoPlayer` (DASH/HLS via Shaka, with quality selection)
  - `MediaAudioPlayer` (DASH/HLS via Shaka, with quality selection)
- **Fullscreen viewer gallery**
  - Modal shell with route/query syncing, keyboard navigation, preload, click-outside, toolbar actions
  - Caption rendering with responsive placement rules
- **Slide renderer**
  - `MediaViewerSlide` uses a renderer registry
  - Image zoom/pan/pinch, and media measurement/sizing
  - Custom slide media renderer via `slide-media` slot

## Install

```bash
pnpm add nuxt-media
```

(Alternative: `npx nuxt module add nuxt-media`.)

## Quick setup

```bash
# Add to Nuxt config (if your module supports it automatically, this may be unnecessary)
# In most cases the module just registers components and composables.
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

## Media item schema

The gallery accepts a list of items shaped like this:

```ts
type MediaViewerItem =
  | MediaViewerImageItem
  | MediaViewerVideoItem
  | MediaViewerAudioItem
  | MediaViewerMapItem
  | MediaViewerPdfItem;
```

Common fields:

```ts
{
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
}
```

Notes:
- **Images** may omit `width` and `height`. The viewer measures the rendered image using `naturalWidth` / `naturalHeight` and uses backend dimensions only as fallbacks.
- **Captions are opt-in**: if you don’t provide `slideCaption` and you don’t use the `slide-caption` slot, the viewer won’t render the `<aside>` and the media fills the available space.

### Image item example

```ts
const imageItem = {
  id: "img-1",
  kind: "image",
  src: "/media/photo.jpg",
  thumbnailSrc: "/media/photo-thumb.jpg",
  alt: "A mountain landscape",
  title: "Mountain",
  slideCaption: "Shot at sunrise.",
};
```

### Video item (adaptive manifest / ABR)

```ts
const videoItem = {
  id: "video-1",
  kind: "video",
  src: "/media/film.mpd",
  mimeType: "application/dash+xml",
  poster: "/media/film-poster.jpg",
  title: "Film",
  slideCaption: "A short documentary clip.",
  metadata: {
    title: "Film",
    artist: "Science Lab",
  },
};
```

### Video item (explicit quality sources)

```ts
const videoItem = {
  id: "video-qualities",
  kind: "video",
  src: "/media/video-720.mp4",
  poster: "/media/video-poster.jpg",
  sources: [
    {
      src: "/media/video-1080.mp4",
      label: "1080p",
      height: 1080,
      mimeType: "video/mp4",
      isDefault: true,
    },
    {
      src: "/media/video-720.mp4",
      label: "720p",
      height: 720,
      mimeType: "video/mp4",
    },
  ],
};
```

### Audio item (explicit quality sources)

```ts
const audioItem = {
  id: "audio-1",
  kind: "audio",
  src: "/media/story-128.mp3",
  poster: "/media/story-cover.jpg",
  title: "Audio Story",
  slideCaption: "An audio-only story with artwork shown by the slide renderer.",
  sources: [
    {
      src: "/media/story-320.mp3",
      label: "High quality",
      bitrate: 320000,
      mimeType: "audio/mpeg",
    },
    {
      src: "/media/story-128.mp3",
      label: "Standard",
      bitrate: 128000,
      mimeType: "audio/mpeg",
      isDefault: true,
    },
  ],
};
```

## MediaViewerGallery

### Basic usage

```vue
<script setup lang="ts">
const items = [imageItem, videoItem, audioItem];
</script>

<template>
  <MediaViewerGallery gallery-key="project-media" :items="items" />
</template>
```

### Custom thumbnail slot

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

### Custom slide caption slot

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

### Caption placement behavior (high level)

- Mobile: captions are **below**.
- Wide / video-like media: captions are **below** (to avoid squeezing).
- Narrow/portrait media: captions may be placed **beside** when there’s enough room.
- Audio: captions may be placed **beside** the audio card on large screens.
- Custom renderers can influence placement via `viewerLayout`.

#### Layout override example

```ts
const item = {
  id: "pdf-1",
  kind: "pdf",
  src: "/docs/report.pdf",
  title: "Report",
  slideCaption: "Quarterly report.",
  viewerLayout: {
    kind: "pdf",
    preferredCaptionPlacement: "side",
    minMainWidth: 520,
    minSideWidth: 320,
    maxSideWidth: 480,
    gap: 24,
  },
};
```

Use `preferredCaptionPlacement: "side"` only when it truly fits the design.

## Custom slide media renderer (`slide-media`)

Use the `slide-media` slot for custom map/panorama/PDF/advanced renderers.

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
- Always bind `setMediaElement` to the real interactive media element. The gallery uses it for click-outside detection and measurement.

## MediaVideoPlayer

```vue
<MediaVideoPlayer
  src="/media/video.mpd"
  mime-type="application/dash+xml"
  poster="/media/poster.jpg"
  title="Video title"
  :metadata="{
    title: 'Video title',
    artist: 'Creator name',
  }"
/>
```

With explicit quality sources:

```vue
<MediaVideoPlayer
  :sources="[
    { src: '/media/video-1080.mp4', label: '1080p', height: 1080, mimeType: 'video/mp4' },
    {
      src: '/media/video-720.mp4',
      label: '720p',
      height: 720,
      mimeType: 'video/mp4',
      isDefault: true,
    },
  ]"
  poster="/media/poster.jpg"
/>
```

Quality behavior:
- Exposes a quality selector when there’s more than one explicit source or more than one Shaka variant track.
- For DASH/HLS, **Auto** enables ABR.
- Selecting a specific variant disables ABR and locks the chosen track.

## MediaAudioPlayer

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

Notes:
- The audio component renders only the `<audio>` element and the optional quality selector.
- Artwork/posters are rendered by the gallery slide (not by the audio player component).

## Composables

### `useShakaPlayer(mediaElementRef, options)`

Low-level Shaka wrapper used by both audio and video players.

Returns:
- `player`
- `shaka`
- `error`
- `activeSource`
- `isLoading`
- `isReady`
- `variantTracks`
- `activeVariantTrack`
- `isAbrEnabled`
- `attach()`
- `load()`
- `play()`
- `pause()`
- `stop()`
- `setAbrEnabled()`
- `selectVariantTrack()`
- `destroy()`

### `useVideoPlayer()` and `useAudioPlayer()`

Thin wrappers around `useShakaPlayer()` that set `kind: "video"` or `kind: "audio"`.

### `useMediaPlayerQuality()`

Shared quality-source logic for `MediaVideoPlayer` and `MediaAudioPlayer`:
- normalizes explicit sources
- builds quality options
- preserves current time while switching explicit sources
- emits `quality-change` events

### `useMediaViewerGallery()`

Owns gallery state:
- modal state, route query syncing, active item safety
- caption visibility and placement
- preloading
- keyboard controls
- click-outside behavior
- metrics

### `useMediaViewerSlide()`

Owns slide behavior:
- renderer selection
- slide media refs
- media session metadata
- image measurement and image box sizing

### `useImageZoomPan()`

Wheel zoom, pointer-centered zoom, drag panning, touch panning, pinch zoom, double tap, and pan clamping.

### `useMediaElementMeasurements()`

Reads rendered size via `useElementSize()` and intrinsic dimensions:
- images: `naturalWidth` / `naturalHeight`
- videos: `videoWidth` / `videoHeight`

## Migration notes

### Rename `viewerCaption` → `slideCaption`

Before:
```ts
{
  viewerCaption: "Shown in the fullscreen viewer.";
}
```

After:
```ts
{
  slideCaption: "Shown in the fullscreen viewer.";
}
```

### Captions are now opt-in

No `slideCaption` and no `slide-caption` slot means the viewer renders without an `<aside>`, letting the media fill available space.

### Wide media now prefers below captions

In automatic mode, wide video-like aspect ratios use below-caption layout on desktop to avoid placing a 16:9 media beside a side panel.

## Development

```bash
# Install dependencies
pnpm install

# Generate type stubs
pnpm dev:prepare

# Develop with the playground
pnpm dev

# Build the playground
pnpm dev:build

# Lint
pnpm lint

# Tests
pnpm test
pnpm test:watch

# Release
pnpm release
```

## GitHub

https://github.com/DanielQolami/nuxt-media

---

[npm-version-src]: https://img.shields.io/npm/v/nuxt-media/latest.svg?style=flat&colorA=020420&colorB=00DC82
[npm-version-href]: https://npmjs.com/package/nuxt-media
[npm-downloads-src]: https://img.shields.io/npm/dm/nuxt-media.svg?style=flat&colorA=020420&colorB=00DC82
[npm-downloads-href]: https://npm.chart.dev/nuxt-media
[license-src]: https://img.shields.io/npm/l/nuxt-media.svg?style=flat&colorA=020420&colorB=00DC82
[license-href]: https://npmjs.com/package/nuxt-media
[nuxt-src]: https://img.shields.io/badge/Nuxt-020420?logo=nuxt
[nuxt-href]: https://nuxt.com
