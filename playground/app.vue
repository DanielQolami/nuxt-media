<script setup lang="ts">
const items = [
  {
    id: "koohsangi-overlook",
    kind: "image",
    src: "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1080&h=1440&q=80",
    thumbnailSrc:
      "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=720&h=960&q=80",
    width: 1080,
    height: 1440,
    alt: "View of Koohsangi park at golden hour",
    title: "Koohsangi Overlook",
    caption: "Golden-hour skyline from the western ridge",
    description: "Popular viewpoint with easy access and evening foot traffic.",
  },
  {
    id: "city-walkthrough",
    kind: "video",
    src: "https://dash.akamaized.net/dash264/TestCasesUHD/2b/11/MultiRate.mpd",
    mimeType: "application/dash+xml",
    poster:
      "https://images.unsplash.com/photo-1445116572660-236099ec97a0?auto=format&fit=crop&w=1000&h=500&q=80",
    metadata: {
      title: "City Walkthrough",
      artist: "Hobby Map",
      album: "Mashhad Guide",
    },
  },
] satisfies MediaViewerItem[];
</script>

<template>
  <div>
    Nuxt module playground!

    <div class="my-20">
      <!-- <MediaVideoPlayer class="w-full" src="https://dash.akamaized.net/dash264/TestCasesUHD/2b/11/MultiRate.mpd"></MediaVideoPlayer> -->
      <MediaVideoPlayer
        class="w-full"
        src="https://placeholdervideo.dev/1920x1080"
      />

      <hr>

      <MediaAudioPlayer
        class="w-full"
        src="https://cdn.tarafdari.com/tarafdari-static-files/ts16.tarafdari.com/contents/user7024/content-sound/lana_del_rey_salvatore.mp3"
      />

      <hr>

      <MediaViewerGallery gallery-key="homepage-editorial-stories" :items="items">
        <template v-slot:slide-caption="{ item }">
          <div v-if="item.caption" class="space-y-3">
            <h2 class="text-xl font-semibold">
              {{ item?.title }}
            </h2>
            <p class="text-sm leading-6">
              {{ item?.caption }}
            </p>
            <p class="text-xs opacity-50">
              {{ item?.description }}
            </p>
          </div>
        </template>
      </MediaViewerGallery>
    </div>
  </div>
</template>
