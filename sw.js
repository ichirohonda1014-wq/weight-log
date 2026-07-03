/**
 * ウェイト記録アプリ Service Worker
 * - アプリ本体(同一オリジンのGETリクエスト)をキャッシュし、圏外でも起動できるようにする
 * - stale-while-revalidate方式: キャッシュを即返しつつ裏で最新版を取得し、次回起動時に反映
 * - GAS API(script.google.com)など外部オリジンへのリクエストには一切関与しない
 */
const CACHE = 'weight-log-v1';
const ASSETS = ['./', './index.html'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // 外部API(GAS等)やGET以外は素通し
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fresh = fetch(e.request)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => cached); // 圏外時はキャッシュにフォールバック
      return cached || fresh;
    })
  );
});
