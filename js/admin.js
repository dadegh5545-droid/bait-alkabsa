/* ==========================================================================
   بيت الكبسة — لوحة إضافة الصور من داخل التطبيق
   --------------------------------------------------------------------------
   تُفتح بضغطة مطوّلة على الشعار، أو بإضافة #admin للرابط.
   لا تُحمَّل إلا عند طلبها (js/main.js يجلبها) فلا تُثقل الزوار.

   كيف تعمل:
     ١. تختار الصورة من جوالك، فتُصغَّر وتُضغط داخل المتصفح نفسه.
     ٢. تُرفع إلى مستودع GitHub بـ commit واحد يضمّ الصورة وفهرس الصور.
     ٣. يبني Amplify الموقع تلقائياً فتظهر الصورة لكل الزوار.

   لا خادم ولا خدمة وسيطة: رمز GitHub يُحفظ في هذا الجهاز فقط
   (localStorage) ولا يُرسل لأي جهة غير api.github.com.
   ========================================================================== */
(function () {
  'use strict';

  var API      = 'https://api.github.com';
  var TOK_KEY  = 'bak_admin_token';
  var REPO_KEY = 'bak_admin_repo';
  var MANIFEST = 'images/manifest.json';

  var DEFAULT_REPO = { owner: 'dadegh5545-droid', repo: 'bait-alkabsa', branch: 'main' };

  /* حدود كل نوع: أطول ضلع بالبكسل، وأقصى حجم، وصيغة الحفظ.
     الشعار يُحفظ PNG للحفاظ على الشفافية، وبقية الصور JPEG لأنها أخفّ. */
  var LIMITS = {
    dish:    { max: 1000, bytes: 180 * 1024, type: 'image/jpeg' },
    gallery: { max: 1600, bytes: 280 * 1024, type: 'image/jpeg' },
    about:   { max: 1400, bytes: 260 * 1024, type: 'image/jpeg' },
    logo:    { max: 512,  bytes: 200 * 1024, type: 'image/png' }
  };

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var DISHES = typeof MENU !== 'undefined' ? MENU : [];
  var SHOTS  = typeof GALLERY !== 'undefined' ? GALLERY : [];

  var state = {
    token: '',
    repo: null,
    files: null,      /* فهرس الصور الحالي على المستودع */
    blob: null,       /* الصورة المضغوطة الجاهزة للرفع */
    target: null,     /* { kind, id, path, label } */
    busy: false
  };

  /* ---------- تخزين آمن ---------- */
  function load(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }
  function drop(key) {
    try { localStorage.removeItem(key); } catch (e) {}
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function toArabicDigits(n) {
    return String(n).replace(/\d/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'[+d]; });
  }

  function kb(bytes) {
    return toArabicDigits(Math.round(bytes / 1024)) + ' ك.ب';
  }

  /* ======================================================================
     ١. معالجة الصورة داخل المتصفح
     ====================================================================== */

  /* مقاس متناسب لا يتجاوز max، وبلا تكبير للصور الصغيرة */
  function fitSize(w, h, max) {
    if (!w || !h) return { w: max, h: max };
    var longest = Math.max(w, h);
    if (longest <= max) return { w: w, h: h };

    var ratio = max / longest;
    return { w: Math.round(w * ratio), h: Math.round(h * ratio) };
  }

  function decode(file) {
    if (typeof createImageBitmap === 'function') {
      /* imageOrientation يصحّح دوران صور الجوال تلقائياً */
      return createImageBitmap(file, { imageOrientation: 'from-image' })
        .catch(function () { return createImageBitmap(file); });
    }

    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var im = new Image();
      im.onload = function () { URL.revokeObjectURL(url); resolve(im); };
      im.onerror = function () { URL.revokeObjectURL(url); reject(new Error('تعذّر قراءة الصورة')); };
      im.src = url;
    });
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (blob) resolve(blob);
        else reject(new Error('تعذّر ضغط الصورة'));
      }, type, quality);
    });
  }

  /* تصغير + ضغط تدريجي حتى النزول تحت الحجم المطلوب */
  function compressImage(file, limit) {
    var lim = limit || LIMITS.gallery;
    var type = lim.type || 'image/jpeg';

    return decode(file).then(function (bitmap) {
      var size = fitSize(bitmap.width, bitmap.height, lim.max);
      var canvas = document.createElement('canvas');
      canvas.width = size.w;
      canvas.height = size.h;

      var ctx = canvas.getContext('2d');
      /* JPEG لا يعرف الشفافية، فنضع خلفية بلون الموقع. PNG يحفظها كما هي. */
      if (type === 'image/jpeg') {
        ctx.fillStyle = '#fbf7f1';
        ctx.fillRect(0, 0, size.w, size.h);
      }
      ctx.drawImage(bitmap, 0, 0, size.w, size.h);
      if (bitmap.close) bitmap.close();

      var qualities = type === 'image/png' ? [undefined] : [0.85, 0.76, 0.68, 0.6, 0.5];

      function attempt(i) {
        return canvasToBlob(canvas, type, qualities[i]).then(function (blob) {
          if (blob.size <= lim.bytes || i === qualities.length - 1) {
            return { blob: blob, width: size.w, height: size.h };
          }
          return attempt(i + 1);
        });
      }
      return attempt(0);
    });
  }

  function toBase64(blob) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(String(fr.result).split(',')[1] || ''); };
      fr.onerror = function () { reject(new Error('تعذّر قراءة الملف')); };
      fr.readAsDataURL(blob);
    });
  }

  /* ======================================================================
     ٢. الاتصال بـ GitHub
     ====================================================================== */

  function repoPath() {
    var r = state.repo || DEFAULT_REPO;
    return '/repos/' + r.owner + '/' + r.repo;
  }

  function branch() {
    return (state.repo || DEFAULT_REPO).branch || 'main';
  }

  function errorText(status, data) {
    if (status === 401) return 'الرمز غير صالح أو انتهت صلاحيته — أنشئ رمزاً جديداً.';
    if (status === 403) return 'الرمز لا يملك صلاحية الكتابة على المستودع (يحتاج Contents: Read and write).';
    if (status === 404) return 'المستودع أو الفرع غير موجود، أو الرمز لا يراه.';
    if (status === 409) return 'تعارض مع تعديل آخر — أعد المحاولة.';
    if (status === 422) return 'رفض GitHub الطلب: ' + ((data && data.message) || 'بيانات غير مقبولة');
    return 'خطأ من GitHub (' + status + '): ' + ((data && data.message) || 'غير معروف');
  }

  function api(path, options) {
    var o = options || {};
    var headers = {
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
    if (state.token) headers.Authorization = 'Bearer ' + state.token;
    if (o.body) headers['Content-Type'] = 'application/json';

    return fetch(API + path, {
      method: o.method || 'GET',
      headers: headers,
      body: o.body ? JSON.stringify(o.body) : undefined
    }).then(function (res) {
      if (res.status === 404 && o.allow404) return { notFound: true };

      return res.text().then(function (text) {
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
        if (!res.ok) throw new Error(errorText(res.status, data));
        return data || {};
      });
    });
  }

  /* التحقق من الرمز والمستودع قبل أي رفع */
  function verify(repo, token) {
    var prevToken = state.token;
    var prevRepo  = state.repo;
    state.token = token;
    state.repo  = repo;

    return api(repoPath()).then(function (data) {
      if (data.permissions && data.permissions.push === false) {
        throw new Error('الرمز يقرأ المستودع ولا يكتب فيه — يحتاج صلاحية Contents: Read and write.');
      }
      save(TOK_KEY, token);
      save(REPO_KEY, repo);
      return data;
    }).catch(function (err) {
      state.token = prevToken;
      state.repo  = prevRepo;
      throw err;
    });
  }

  function decodeContent(base64) {
    var raw = atob(String(base64).replace(/\s/g, ''));
    try {
      return decodeURIComponent(raw.split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
    } catch (e) { return raw; }
  }

  /* فهرس الصور الحالي على المستودع */
  function readManifest() {
    return api(repoPath() + '/contents/' + MANIFEST + '?ref=' + branch(), { allow404: true })
      .then(function (data) {
        if (!data || data.notFound || !data.content) return [];
        try {
          var parsed = JSON.parse(decodeContent(data.content));
          return Array.isArray(parsed.files) ? parsed.files : [];
        } catch (e) { return []; }
      });
  }

  function manifestText(files) {
    var sorted = files.slice().sort();
    return JSON.stringify({
      note: 'يُحدَّث تلقائياً من لوحة الصور — لا تعدّله يدوياً',
      updated: new Date().toISOString(),
      files: sorted
    }, null, 2) + '\n';
  }

  /**
   * commit واحد يضمّ الصورة وفهرس الصور — حتى لا يبني Amplify مرتين
   * ولا تبقى صورة بلا فهرس لو انقطع الاتصال في المنتصف.
   * blob = null يعني حذف الملف.
   */
  function commitImage(path, blob, message) {
    var files, blobSha, headSha, baseTree;

    return readManifest()
      .then(function (current) {
        files = current.filter(function (p) { return p !== path; });
        if (blob) files.push(path);

        if (!blob) return null;
        return toBase64(blob)
          .then(function (b64) {
            return api(repoPath() + '/git/blobs', {
              method: 'POST',
              body: { content: b64, encoding: 'base64' }
            });
          })
          .then(function (res) { blobSha = res.sha; });
      })
      .then(function () {
        return api(repoPath() + '/git/ref/heads/' + branch());
      })
      .then(function (ref) {
        headSha = ref.object.sha;
        return api(repoPath() + '/git/commits/' + headSha);
      })
      .then(function (commit) {
        baseTree = commit.tree.sha;

        var tree = [{
          path: path,
          mode: '100644',
          type: 'blob',
          sha: blobSha || null      /* null = حذف الملف من الشجرة */
        }, {
          path: MANIFEST,
          mode: '100644',
          type: 'blob',
          content: manifestText(files)
        }];

        return api(repoPath() + '/git/trees', {
          method: 'POST',
          body: { base_tree: baseTree, tree: tree }
        });
      })
      .then(function (tree) {
        return api(repoPath() + '/git/commits', {
          method: 'POST',
          body: { message: message, tree: tree.sha, parents: [headSha] }
        });
      })
      .then(function (commit) {
        return api(repoPath() + '/git/refs/heads/' + branch(), {
          method: 'PATCH',
          body: { sha: commit.sha }
        }).then(function () {
          state.files = files;
          return { sha: commit.sha, files: files };
        });
      });
  }

  /* ======================================================================
     ٣. الواجهة
     ====================================================================== */
  var panel = null;

  function targets(kind) {
    if (kind === 'dish') {
      return DISHES.map(function (d) {
        return { id: d.id, label: d.name, path: 'images/dishes/' + d.id + '.jpg' };
      });
    }
    if (kind === 'gallery') {
      return SHOTS.map(function (s) {
        return { id: s.id, label: s.label, path: s.img || ('images/gallery/' + s.id + '.jpg') };
      });
    }
    if (kind === 'logo') {
      return [{ id: 'logo', label: 'شعار المطعم', path: 'images/logo.png' }];
    }
    return [{ id: 'about', label: 'صورة «عن المطعم»', path: 'images/about.jpg' }];
  }

  function currentTarget() {
    var kind = $('#adKind', panel).value;
    var list = targets(kind);
    var id = $('#adItem', panel).value;

    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        return { kind: kind, id: list[i].id, label: list[i].label, path: list[i].path };
      }
    }
    return list.length ? { kind: kind, id: list[0].id, label: list[0].label, path: list[0].path } : null;
  }

  function status(message, kind) {
    var box = $('#adStatus', panel);
    if (!box) return;
    box.className = 'ad-status' + (kind ? ' is-' + kind : '');
    box.innerHTML = message;
  }

  function renderItems() {
    var kind = $('#adKind', panel).value;
    var list = targets(kind);

    $('#adItemField', panel).hidden = kind === 'about' || kind === 'logo';
    $('#adItem', panel).innerHTML = list.map(function (t) {
      return '<option value="' + escapeHtml(t.id) + '">' + escapeHtml(t.label) + '</option>';
    }).join('');

    refreshTarget();
  }

  function refreshTarget() {
    var target = currentTarget();
    state.target = target;
    if (!target) return;

    var known = state.files && state.files.indexOf(target.path) !== -1;
    $('#adPath', panel).textContent = target.path;
    $('#adRemove', panel).hidden = !known;
    $('#adHas', panel).textContent = known ? '✅ لهذا العنصر صورة منشورة' : '⚪ لا صورة له بعد';
  }

  function renderAuth() {
    var connected = !!state.token;

    $('#adLogin', panel).hidden = connected;
    $('#adWork', panel).hidden  = !connected;

    if (connected) {
      var r = state.repo || DEFAULT_REPO;
      $('#adRepoLine', panel).textContent = r.owner + '/' + r.repo + ' · فرع ' + r.branch;
    }
  }

  function build() {
    var r = load(REPO_KEY, DEFAULT_REPO) || DEFAULT_REPO;

    panel = document.createElement('div');
    panel.className = 'admin';
    panel.id = 'bakAdmin';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'لوحة إضافة الصور');

    panel.innerHTML =
      '<div class="modal-backdrop" data-ad-close></div>' +
      '<div class="ad-panel">' +
        '<header class="ad-head">' +
          '<h3>إضافة الصور</h3>' +
          '<button class="modal-close" data-ad-close aria-label="إغلاق">×</button>' +
        '</header>' +

        '<div class="ad-body">' +

          /* --- الاتصال --- */
          '<section id="adLogin" hidden>' +
            '<p class="ad-note">تُرفع الصور إلى مستودع الموقع على GitHub، ثم يبني Amplify النسخة الجديدة تلقائياً. الرمز يُحفظ على هذا الجهاز فقط.</p>' +
            '<div class="ad-field"><label for="adOwner">حساب GitHub</label>' +
              '<input id="adOwner" type="text" dir="ltr" value="' + escapeHtml(r.owner) + '" /></div>' +
            '<div class="ad-field"><label for="adRepo">المستودع</label>' +
              '<input id="adRepo" type="text" dir="ltr" value="' + escapeHtml(r.repo) + '" /></div>' +
            '<div class="ad-field"><label for="adBranch">الفرع</label>' +
              '<input id="adBranch" type="text" dir="ltr" value="' + escapeHtml(r.branch || 'main') + '" /></div>' +
            '<div class="ad-field"><label for="adToken">رمز الوصول (Token)</label>' +
              '<input id="adToken" type="password" dir="ltr" autocomplete="off" placeholder="github_pat_..." /></div>' +
            '<p class="ad-hint">أنشئ رمزاً من <span dir="ltr">GitHub → Settings → Developer settings → Personal access tokens → Fine-grained</span>، واختر هذا المستودع وحده وصلاحية <span dir="ltr">Contents: Read and write</span>.</p>' +
            '<p class="ad-warn">⚠️ لا تُدخل الرمز على جهاز مشترك أو عام.</p>' +
            '<button class="btn btn-primary btn-lg" id="adConnect">تحقّق واتصال</button>' +
          '</section>' +

          /* --- الرفع --- */
          '<section id="adWork" hidden>' +
            '<p class="ad-repo" id="adRepoLine" dir="ltr"></p>' +

            '<div class="ad-field"><label for="adKind">نوع الصورة</label>' +
              '<select id="adKind">' +
                '<option value="dish">صورة طبق</option>' +
                '<option value="gallery">صورة في المعرض</option>' +
                '<option value="about">صورة «عن المطعم»</option>' +
                '<option value="logo">شعار المطعم</option>' +
              '</select></div>' +

            '<div class="ad-field" id="adItemField"><label for="adItem">العنصر</label>' +
              '<select id="adItem"></select></div>' +

            '<p class="ad-target"><span id="adHas"></span><code id="adPath" dir="ltr"></code></p>' +

            '<label class="ad-drop" for="adFile">' +
              '<span id="adDropText">📷 اختر صورة من جوالك</span>' +
              '<input id="adFile" type="file" accept="image/*" hidden />' +
            '</label>' +

            '<div class="ad-preview" id="adPreview" hidden>' +
              '<img id="adPreviewImg" alt="معاينة الصورة" />' +
              '<p id="adPreviewInfo"></p>' +
            '</div>' +

            '<div class="ad-actions">' +
              '<button class="btn btn-primary btn-lg" id="adPublish" disabled>انشر الصورة</button>' +
              '<button class="btn btn-outline" id="adRemove" hidden>إزالة الصورة الحالية</button>' +
            '</div>' +

            '<button class="ad-logout" id="adLogout">محو الرمز من هذا الجهاز</button>' +
          '</section>' +

          /* الحالة مشتركة بين الشاشتين */
          '<div class="ad-status" id="adStatus"></div>' +

        '</div>' +
      '</div>';

    document.body.appendChild(panel);
    panel.hidden = true;
    wire();
  }

  function wire() {
    panel.addEventListener('click', function (e) {
      if (e.target.closest('[data-ad-close]')) close();
    });

    $('#adConnect', panel).addEventListener('click', function () {
      var repo = {
        owner: $('#adOwner', panel).value.trim(),
        repo: $('#adRepo', panel).value.trim(),
        branch: $('#adBranch', panel).value.trim() || 'main'
      };
      var token = $('#adToken', panel).value.trim();

      if (!repo.owner || !repo.repo) { status('أكمل حساب GitHub واسم المستودع.', 'error'); return; }
      if (!token) { status('الصق رمز الوصول أولاً.', 'error'); return; }

      status('جارٍ التحقق…');
      verify(repo, token)
        .then(function () {
          $('#adToken', panel).value = '';
          renderAuth();
          renderItems();
          status('تم الاتصال ✅');
          return readManifest();
        })
        .then(function (files) {
          if (!files) return;
          state.files = files;
          refreshTarget();
        })
        .catch(function (err) { status(escapeHtml(err.message), 'error'); });
    });

    $('#adKind', panel).addEventListener('change', renderItems);
    $('#adItem', panel).addEventListener('change', refreshTarget);

    $('#adFile', panel).addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;

      var kind = $('#adKind', panel).value;

      status('جارٍ تجهيز الصورة…');
      $('#adPublish', panel).disabled = true;

      compressImage(file, LIMITS[kind] || LIMITS.gallery)
        .then(function (out) {
          state.blob = out.blob;

          $('#adPreview', panel).hidden = false;
          $('#adPreviewImg', panel).src = URL.createObjectURL(out.blob);
          $('#adPreviewInfo', panel).textContent =
            toArabicDigits(out.width) + '×' + toArabicDigits(out.height) + ' · ' +
            kb(file.size) + ' ← ' + kb(out.blob.size);

          $('#adDropText', panel).textContent = '📷 اختر صورة أخرى';
          $('#adPublish', panel).disabled = false;
          status('الصورة جاهزة — اضغط «انشر الصورة».');
        })
        .catch(function (err) {
          state.blob = null;
          status(escapeHtml(err.message || 'تعذّرت معالجة الصورة'), 'error');
        });
    });

    $('#adPublish', panel).addEventListener('click', function () {
      if (state.busy || !state.blob || !state.target) return;

      state.busy = true;
      $('#adPublish', panel).disabled = true;
      status('جارٍ الرفع إلى GitHub…');

      commitImage(state.target.path, state.blob, 'إضافة صورة: ' + state.target.label)
        .then(function (res) {
          state.busy = false;
          state.blob = null;
          $('#adPreview', panel).hidden = true;
          $('#adFile', panel).value = '';
          $('#adDropText', panel).textContent = '📷 اختر صورة من جوالك';
          refreshTarget();
          if (typeof window.BAK_REFRESH_IMAGES === 'function') window.BAK_REFRESH_IMAGES(res.files);
          status('نُشرت الصورة ✅<br><small>يبني Amplify النسخة الجديدة الآن — تظهر للزوار خلال دقيقة إلى ثلاث.</small>', 'ok');
        })
        .catch(function (err) {
          state.busy = false;
          $('#adPublish', panel).disabled = false;
          status(escapeHtml(err.message), 'error');
        });
    });

    $('#adRemove', panel).addEventListener('click', function () {
      if (state.busy || !state.target) return;
      if (!window.confirm('إزالة صورة «' + state.target.label + '»؟ سيعود الإطار النائب مكانها.')) return;

      state.busy = true;
      status('جارٍ الإزالة…');

      commitImage(state.target.path, null, 'إزالة صورة: ' + state.target.label)
        .then(function (res) {
          state.busy = false;
          refreshTarget();
          if (typeof window.BAK_REFRESH_IMAGES === 'function') window.BAK_REFRESH_IMAGES(res.files);
          status('أُزيلت الصورة ✅', 'ok');
        })
        .catch(function (err) {
          state.busy = false;
          status(escapeHtml(err.message), 'error');
        });
    });

    $('#adLogout', panel).addEventListener('click', function () {
      drop(TOK_KEY);
      state.token = '';
      state.files = null;
      renderAuth();
      status('مُحي الرمز من هذا الجهاز.');
    });
  }

  function open() {
    if (!panel) build();

    state.token = load(TOK_KEY, '') || '';
    state.repo  = load(REPO_KEY, DEFAULT_REPO) || DEFAULT_REPO;

    renderAuth();
    document.body.classList.add('modal-open');
    panel.hidden = false;

    requestAnimationFrame(function () { panel.classList.add('is-open'); });

    if (state.token) {
      renderItems();
      status('جارٍ قراءة الصور المنشورة…');
      readManifest()
        .then(function (files) {
          state.files = files;
          refreshTarget();
          status(files.length
            ? 'المنشور حالياً: ' + toArabicDigits(files.length) + ' صورة.'
            : 'لا صور منشورة بعد — ابدأ بصورة طبق.');
        })
        .catch(function (err) { status(escapeHtml(err.message), 'error'); });
    }
  }

  function close() {
    if (!panel) return;
    panel.classList.remove('is-open');
    document.body.classList.remove('modal-open');
    setTimeout(function () { panel.hidden = true; }, 300);

    if (window.location.hash === '#admin') {
      window.location.hash = '';
    }
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && panel && !panel.hidden) close();
  });

  /* يُستعمل من js/main.js وفي الاختبارات */
  window.BAK_ADMIN = {
    open: open,
    close: close,
    fitSize: fitSize,
    compressImage: compressImage,
    readManifest: readManifest,
    manifestText: manifestText,
    commitImage: commitImage,
    verify: verify,
    targets: targets,
    state: state
  };
})();
