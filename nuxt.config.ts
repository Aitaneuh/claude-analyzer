export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  // A dashboard behind your own auth: render everything client side, Nitro serves the API.
  ssr: false,
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      title: 'Claude Analyzer',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'color-scheme', content: 'light dark' },
      ],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },
  build: { transpile: ['vue-echarts', 'echarts', 'zrender'] },
  nitro: {
    // node:sqlite is a Node builtin (>= 22.13) - keep it external.
    externals: { external: ['node:sqlite'] },
  },
})
