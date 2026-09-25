/* ------------------------------------------------------------
   ToDoTiles — Service Worker（オフライン用キャッシュのみ）

   GitHub Pages では他の PWA と同じオリジンを共有するため：
   - キャッシュ名は "todotiles-" で始め、消すのは自分の古い版だけ
   - 参照するのも自分のキャッシュだけ（caches.match は使わない）
   - install では cache:'reload' で取得（HTTPキャッシュの旧版を掴まない）
   更新は「新しい版を待機 → 画面の［更新する］で切り替え」。
   index.html を直したら、下の VERSION を必ず上げること。
   ------------------------------------------------------------ */
const VERSION = '0.4.0';
const PREFIX = 'todotiles-';
const CACHE = PREFIX + 'v' + VERSION;
const ASSETS = ['./', './index.html', './manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
  );
  // skipWaiting はしない（画面側の［更新する］で切り替える。初回は待機なしで有効になる）
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;   // 自分の範囲だけ

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // ページの読み込みは常に index.html（クエリ付きでも）
    if (req.mode === 'navigate') {
      const hit = await cache.match('./index.html');
      if (hit) return hit;
      try { return await fetch(req); } catch { return new Response('オフラインです', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }); }
    }
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res && res.ok && res.type === 'basic') cache.put(req, res.clone()).catch(() => {});
      return res;
    } catch {
      return new Response('', { status: 504 });
    }
  })());
});

// 通知をタップしたらアプリを前面に
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (all.length) return all[0].focus();
    return self.clients.openWindow('./');
  })());
});
