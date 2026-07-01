// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ["@vueuse/nuxt", "@nuxt/ui", "@pinia/nuxt"],

  pinia: {
    storesDirs: ["./src/runtime/app/stores/**"],
  },
});
