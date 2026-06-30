# Media Module Usage Guide

This module provides Shaka-backed audio/video players and a fullscreen media gallery for images, video, audio, maps, PDFs, and future custom renderers. It is designed for Nuxt 4, Vue 3, Nuxt UI v4, Tailwind CSS v4, VueUse, and Pinia.

## Core concepts

The module separates responsibilities into three layers:

1. **Players**: `MediaVideoPlayer` and `MediaAudioPlayer` own native media elements and Shaka playback.
2. **Viewer shell**: `MediaViewerGallery` owns the modal, route syncing, keyboard navigation, preloading, click-outside behavior, caption placement, and toolbar actions.
3. **Slide renderer**: `MediaViewerSlide` renders the active media item using a renderer registry. It also handles image zoom, pan, pinch, and actual media measurement.

## Runtime config

Example `nuxt.config.ts`:

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

Images may omit `width` and `height`. The viewer measures the loaded image using `naturalWidth` and `naturalHeight` and uses backend dimensions only as fallbacks.

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

Video item with adaptive manifest:

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

Video item with explicit quality files:

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

Audio item with explicit quality files:

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

Basic usage:

```vue
<script setup lang="ts">
const items = [imageItem, videoItem, audioItem];
</script>

<template>
  <MediaViewerGallery gallery-key="project-media" :items="items" />
</template>
```

Custom thumbnail:

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

Custom slide caption:

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

The `<aside>` is rendered only when `item.slideCaption` exists or a `slide-caption` slot is provided. When neither exists, the media fills the available viewer space.

## Caption placement

The viewer measures the rendered media element and combines that with intrinsic dimensions when available.

Default behavior:

- Mobile: captions are below.
- Wide media, such as 16:9 video-like content: captions are below.
- Narrow or portrait media: captions may be placed beside the media if there is enough room.
- Audio: captions may be placed beside the audio card on large screens.
- Custom renderers can provide `viewerLayout` to influence placement.

Example layout override:

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

`preferredCaptionPlacement: "side"` is respected on desktop. Use it only when the media really works next to a side panel.

## Custom slide media renderer

Use the `slide-media` slot when you need a custom map, panorama, PDF, or advanced media renderer.

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

Always bind `setMediaElement` to the real interactive media element. The gallery uses it for click-outside detection and measurement.

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

With explicit source qualities:

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

The player exposes a quality selector when there is more than one explicit source or more than one Shaka variant track. For DASH/HLS, `Auto` enables ABR. Selecting a specific variant disables ABR and locks the chosen track.

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

The audio component renders only the `<audio>` element and the optional quality selector. Artwork or posters should be rendered by the gallery slide, not by the audio player component.

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

Shared quality-source logic for `MediaVideoPlayer` and `MediaAudioPlayer`. It normalizes explicit sources, builds quality options, preserves current time while switching explicit sources, and emits `quality-change` events.

### `useMediaViewerGallery()`

Owns gallery modal state, route query syncing, active item safety, caption visibility, caption placement, preloading, keyboard controls, click-outside behavior, and metrics.

### `useMediaViewerSlide()`

Owns renderer selection, slide media refs, media session metadata, image measurement, and image box sizing.

### `useImageZoomPan()`

Owns wheel zoom, pointer-centered zoom, drag panning, touch panning, pinch zoom, double tap, and pan clamping.

### `useMediaElementMeasurements()`

Reads rendered size from `useElementSize()` and intrinsic dimensions from image/video elements. For images, it uses `naturalWidth` and `naturalHeight`; for videos, it uses `videoWidth` and `videoHeight`.

## Migration notes

### Rename `viewerCaption` to `slideCaption`

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

No `slideCaption` and no `slide-caption` slot means no `<aside>` is rendered. The media area receives all available space.

### Wide media now prefers below captions

In automatic mode, media with a wide video-like aspect ratio uses below-caption layout. This avoids squeezing a 16:9 player beside a side panel.
