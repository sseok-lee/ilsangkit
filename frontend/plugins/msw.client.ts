// @TASK T0.5.3 - MSW Nuxt 플러그인
// @SPEC docs/planning/02-trd.md#계약-정의

export default defineNuxtPlugin(async () => {
  const config = useRuntimeConfig();
  const isDisabled = config.public.disableMsw;

  if (import.meta.dev && !isDisabled) {
    const { worker } = await import('~/mocks/browser');

    await worker.start({
      onUnhandledRequest(request, print) {
        // 정적 파일 요청은 무시 (Service Worker 네트워크 에러 방지)
        const url = new URL(request.url);
        if (
          url.pathname.startsWith('/icons/') ||
          url.pathname.startsWith('/_nuxt/') ||
          url.pathname.endsWith('.png') ||
          url.pathname.endsWith('.jpg') ||
          url.pathname.endsWith('.svg') ||
          url.pathname.endsWith('.ico') ||
          url.pathname.endsWith('.woff') ||
          url.pathname.endsWith('.woff2')
        ) {
          return;
        }
        print.warning();
      },
      serviceWorker: {
        url: '/mockServiceWorker.js',
      },
    });

    console.log('[MSW] Mock Service Worker started');
    console.log('[MSW] API Base:', config.public.apiBase);
  }
});
