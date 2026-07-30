/* ==========================================================================
   بيت الكبسة — عامل الخدمة (Service Worker)
   يخزّن الموقع محلياً ليعمل كتطبيق حتى بدون إنترنت.
   ملاحظة: عند أي تعديل على ملفات الموقع، ارفع رقم CACHE_VERSION.
   ========================================================================== */

var CACHE_VERSION = 'bak-v16';
var PRECACHE = [
  './',
  './index.html',
  './offline.html',
  './css/styles.css',
  './js/menu-data.js',
  './js/gallery-data.js',
  './js/main.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

/* ---------- التثبيت: تخزين الملفات الأساسية ---------- */
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      /* addAll يفشل كلياً لو سقط ملف واحد — نخزّن كل ملف على حدة */
      return Promise.all(PRECACHE.map(function (url) {
        return cache.add(url).catch(function () {
          console.warn('[SW] تعذّر تخزين:', url);
        });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

/* ---------- التفعيل: حذف النسخ القديمة ---------- */
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== CACHE_VERSION) return caches.delete(key);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* ---------- الجلب ---------- */
self.addEventListener('fetch', function (event) {
  var req = event.request;

  if (req.method !== 'GET') return;

  var url = new URL(req.url);

  /* لا نتدخّل في طلبات واتساب أو الخرائط */
  if (url.origin !== self.location.origin &&
      !/fonts\.(googleapis|gstatic)\.com/.test(url.hostname)) {
    return;
  }

  /* فهرس الصور وبيانات الموقع: الشبكة أولاً دائماً،
     حتى تظهر الصور والأسعار المنشورة من لوحة التحكّم فوراً */
  if (url.pathname.indexOf('images/manifest.json') !== -1 ||
      url.pathname.indexOf('data/site.json') !== -1) {
    event.respondWith(
      fetch(req)
        .then(function (res) {
          if (res && res.status === 200) {
            var copy = res.clone();
            caches.open(CACHE_VERSION).then(function (c) { c.put(req, copy); });
          }
          return res;
        })
        .catch(function () { return caches.match(req); })
    );
    return;
  }

  /* صفحات HTML: الشبكة أولاً، ثم الكاش، ثم صفحة عدم الاتصال */
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').indexOf('text/html') !== -1) {
    event.respondWith(
      fetch(req)
        .then(function (res) {
          var copy = res.clone();
          caches.open(CACHE_VERSION).then(function (c) { c.put(req, copy); });
          return res;
        })
        .catch(function () {
          return caches.match(req).then(function (cached) {
            return cached || caches.match('./offline.html') || caches.match('./index.html');
          });
        })
    );
    return;
  }

  /* بقية الملفات: الكاش أولاً مع تحديث في الخلفية */
  event.respondWith(
    caches.match(req).then(function (cached) {
      var network = fetch(req).then(function (res) {
        if (res && res.status === 200) {
          var copy = res.clone();
          caches.open(CACHE_VERSION).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return cached; });

      return cached || network;
    })
  );
});

/* ---------- رسالة تحديث فوري ---------- */
self.addEventListener('message', function (event) {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
