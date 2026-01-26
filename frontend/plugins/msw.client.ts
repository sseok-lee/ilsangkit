// @TASK T0.5.3 - MSW Nuxt 플러그인
// @SPEC docs/planning/02-trd.md#계약-정의

export default defineNuxtPlugin(async () => {
  const config = useRuntimeConfig();
  const isDisabled = process.env.NUXT_PUBLIC_DISABLE_MSW === 'true';

  if (process.env.NODE_ENV === 'development' && !isDisabled) {
    const { worker } = await import('~/mocks/browser');

    await worker.start({
      onUnhandledRequest: 'bypass',
      serviceWorker: {
        url: '/mockServiceWorker.js',
      },
    });

    console.log('[MSW] Mock Service Worker started');
    console.log('[MSW] API Base:', config.public.apiBase);
  }
});
