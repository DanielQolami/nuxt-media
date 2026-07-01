<script setup lang="ts"></script>

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
    </div>
  </div>
</template>
