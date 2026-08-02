/* ==========================================================================
   بيت الكبسة — السكربت الرئيسي
   يعتمد على js/menu-data.js (يجب تحميله قبل هذا الملف)
   --------------------------------------------------------------------------
   الأقسام:
     1-5   واجهة الموقع: الهيدر، القائمة، الحركات، العدّادات
     6-9   القائمة: العرض، البحث، التصفية، المفضّلة
     10-12 نافذة الطبق والسلة والطلب
     13-17 الحجز، وضع التطبيق، عامل الخدمة، التثبيت، الاتصال
     18    معرض الصور والعرض المكبّر
   ========================================================================== */
(function () {
  'use strict';

  var CFG = typeof ORDER_CONFIG !== 'undefined' ? ORDER_CONFIG : { whatsapp: '97455921554', currency: 'ر.ق', deliveryFee: 15, freeDeliveryOver: 0, minOrder: 0, branches: [] };
  var DISHES = typeof MENU !== 'undefined' ? MENU : [];
  var CATS = typeof MENU_CATEGORIES !== 'undefined' ? MENU_CATEGORIES : [];
  var IMG_CFG = typeof IMAGE_CONFIG !== 'undefined' ? IMAGE_CONFIG : {};
  var SHOTS = typeof GALLERY !== 'undefined' ? GALLERY : [];

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------- أدوات مشتركة ---------- */

  function toArabicDigits(n) {
    return String(n).replace(/\d/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'[+d]; });
  }

  function formatPrice(value) {
    var rounded = Math.round(value * 100) / 100;
    var text = rounded % 1 === 0 ? String(rounded) : rounded.toFixed(2);
    return toArabicDigits(text) + ' ' + (CFG.currency || 'ر.ق');
  }

  /* ---------- النسخة الإنجليزية من رسالة الطلب ----------
     في المطبخ من لا يقرأ العربية. النصّ العربي نفسه هو مفتاح
     القاموس في js/menu-en.js، وما لا ترجمة له يخرج عربياً كما هو:
     اسمٌ عربي في وجه الموظف أنفع من معرّف تقنيّ أو فراغ. */
  function tr(text) {
    var dict = window.MENU_EN;
    if (!text || !dict) return text || '';
    return dict[String(text).trim()] || text;
  }

  /* الأرقام لاتينية في النسخة الإنجليزية — من لا يقرأ العربية
     لا يقرأ «٢٠٠٠ ر.ق» كذلك */
  function priceEn(value) {
    var rounded = Math.round(value * 100) / 100;
    var text = rounded % 1 === 0 ? String(rounded) : rounded.toFixed(2);
    return text + ' ' + ((CFG.currency || 'ر.ق') === 'ر.ق' ? 'QAR' : CFG.currency);
  }

  /* عدٌّ عربي سليم: طبق واحد، طبقان، ثلاثة أطباق، أحد عشر طبقاً.
     العربية لا تقول «١ طبق» ولا «٢ أطباق»، والسلة يقرأها الزبون. */
  function countLabel(n, one, two, few, many) {
    if (n === 1) return one + ' واحد';
    if (n === 2) return two;
    if (n <= 10) return toArabicDigits(n) + ' ' + few;
    return toArabicDigits(n) + ' ' + many;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  /* سعر الحجم: إمّا price كامل مكتوب فيه، أو delta يُضاف للسعر
     الأساسي. الأول أوضح لمن يحرّر الملف، والثاني باقٍ للتوافق. */
  function sizePrice(dish, size) {
    if (!size) return dish.price;
    if (size.price != null) return size.price;
    return dish.price + (size.delta || 0);
  }

  /* أرخص أحجام الطبق — هو ما يُعرض على البطاقة */
  function basePrice(dish) {
    if (!dish.sizes || !dish.sizes.length) return dish.price;
    return dish.sizes.reduce(function (min, s) {
      var p = sizePrice(dish, s);
      return p < min ? p : min;
    }, sizePrice(dish, dish.sizes[0]));
  }

  function getDish(id) {
    for (var i = 0; i < DISHES.length; i++) {
      if (DISHES[i].id === id) return DISHES[i];
    }
    return null;
  }

  /* ---------- الصور ----------
     كل صورة تُرسم فوق إطار نائب فيه رمز تعبيري. لو لم يوجد الملف أو تعذّر
     تحميله يبقى الإطار النائب ظاهراً بدل مساحة بيضاء، فلا تتعطّل الواجهة. */

  /* فهرس الصور المرفوعة من لوحة الإدارة — images/manifest.json
     null = لا فهرس (أُضيفت الصور يدوياً) فنطلب الصورة كما هي ونتّكل على الإطار النائب.
     مصفوفة = نعرف تماماً أي الصور موجودة، فلا طلب فاشلاً واحداً. */
  var IMAGE_INDEX = null;

  function imageExists(path) {
    if (!path) return false;
    if (!IMAGE_INDEX) return true;
    return IMAGE_INDEX.indexOf(path) !== -1;
  }

  /* مسار صورة الطبق: الحقل img أولاً، ثم الفهرس، ثم التسمية التلقائية */
  function dishImage(dish) {
    if (dish.img) return dish.img;

    var auto = (IMG_CFG.dishDir || 'images/dishes/') + dish.id + (IMG_CFG.dishExt || '.jpg');
    if (IMAGE_INDEX) return imageExists(auto) ? auto : '';
    return IMG_CFG.autoDishImages ? auto : '';
  }

  function photoImg(src, src2x, alt, eager) {
    if (!src || !imageExists(src)) return '';
    return '<img class="photo-img" src="' + escapeHtml(src) + '"' +
      (src2x ? ' srcset="' + escapeHtml(src) + ' 1x, ' + escapeHtml(src2x) + ' 2x"' : '') +
      ' alt="' + escapeHtml(alt || '') + '"' +
      ' loading="' + (eager ? 'eager' : 'lazy') + '" decoding="async" />';
  }

  /* إطار نائب + صورة اختيارية فوقه */
  function photoBox(opts) {
    return '<div class="photo ' + (opts.cls || '') + '" data-label="' + escapeHtml(opts.label || '') + '">' +
             '<span class="photo-emoji" aria-hidden="true">' + (opts.emoji || '🍽️') + '</span>' +
             photoImg(opts.img, opts.img2x, opts.alt || opts.label, opts.eager) +
           '</div>';
  }

  /* التلاشي عند التحميل، والاختفاء عند فقدان الملف */
  function watchPhotos(scope) {
    $$('.photo-img', scope).forEach(function (img) {
      if (img.getAttribute('data-watched')) return;
      img.setAttribute('data-watched', '1');

      if (img.complete) {
        img.classList.add(img.naturalWidth > 0 ? 'is-loaded' : 'is-failed');
        return;
      }
      img.addEventListener('load',  function () { img.classList.add('is-loaded'); });
      img.addEventListener('error', function () { img.classList.add('is-failed'); });
    });
  }

  /* تخزين محلي آمن — قد يكون معطّلاً في التصفح الخاص */
  var store = {
    get: function (key, fallback) {
      try {
        var raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (e) { return fallback; }
    },
    set: function (key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
    }
  };

  /* ---------- تنبيهات ---------- */
  var toastBox = $('#toasts');

  function toast(message, kind) {
    if (!toastBox) return;
    var el = document.createElement('div');
    el.className = 'toast' + (kind ? ' toast-' + kind : '');
    el.textContent = message;
    toastBox.appendChild(el);

    setTimeout(function () { el.classList.add('is-out'); }, 2400);
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 2800);
  }

  /* ======================================================================
     1. الهيدر عند التمرير
     ====================================================================== */
  var header = $('#siteHeader');
  var toTop  = $('#toTop');

  function onScroll() {
    var y = window.scrollY;
    if (header) header.classList.toggle('is-stuck', y > 40);
    if (toTop)  toTop.classList.toggle('is-visible', y > 600);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ======================================================================
     2. قائمة الجوال
     ====================================================================== */
  var navToggle = $('#navToggle');
  var mainNav   = $('#mainNav');

  function closeNav() {
    if (!mainNav) return;
    mainNav.classList.remove('is-open');
    document.body.classList.remove('nav-open');
    if (navToggle) {
      navToggle.setAttribute('aria-expanded', 'false');
      navToggle.setAttribute('aria-label', 'فتح القائمة');
    }
  }

  if (navToggle && mainNav) {
    navToggle.addEventListener('click', function () {
      var open = mainNav.classList.toggle('is-open');
      document.body.classList.toggle('nav-open', open);
      navToggle.setAttribute('aria-expanded', String(open));
      navToggle.setAttribute('aria-label', open ? 'إغلاق القائمة' : 'فتح القائمة');
    });

    $$('#mainNav a').forEach(function (a) { a.addEventListener('click', closeNav); });

    document.addEventListener('click', function (e) {
      if (!mainNav.classList.contains('is-open')) return;
      if (mainNav.contains(e.target) || navToggle.contains(e.target)) return;
      closeNav();
    });
  }

  /* ======================================================================
     3. إبراز الرابط النشط
     ====================================================================== */
  var sections = $$('main section[id]');
  var navLinks = $$('.nav-link');
  var tabLinks = $$('.app-tabbar a');

  function highlight() {
    var pos = window.scrollY + (window.innerHeight * 0.32);
    var current = '';

    sections.forEach(function (sec) {
      if (pos >= sec.offsetTop) current = sec.id;
    });
    if (!current && sections.length) current = sections[0].id;

    navLinks.concat(tabLinks).forEach(function (link) {
      link.classList.toggle('is-active', link.getAttribute('href') === '#' + current);
    });
  }
  window.addEventListener('scroll', highlight, { passive: true });
  highlight();

  /* ======================================================================
     4. حركات الظهور
     ====================================================================== */
  var revealObserver = null;

  if ('IntersectionObserver' in window) {
    revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px' });
  }

  function observeReveal(el, index) {
    if (!revealObserver) { el.classList.add('is-in'); return; }
    el.style.transitionDelay = Math.min((index || 0) % 6, 5) * 70 + 'ms';
    revealObserver.observe(el);
  }

  $$('.reveal').forEach(observeReveal);

  /* ======================================================================
     5. عدّاد الأرقام
     ====================================================================== */
  var counters = $$('[data-count]');

  /* عدد الأطباق يُقرأ من بيانات القائمة تلقائياً — والمخفيّ لا يُعدّ،
     فالرقم المعلن في الصفحة هو ما يراه الزائر فعلاً */
  function liveDishCount() {
    return DISHES.filter(function (d) { return !d.hidden; }).length;
  }

  counters.forEach(function (el) {
    if (el.getAttribute('data-count-source') === 'menu' && DISHES.length) {
      el.setAttribute('data-count', String(liveDishCount()));
    }
  });

  function runCounter(el) {
    var target = parseInt(el.getAttribute('data-count'), 10) || 0;
    var start  = null;

    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / 1400, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = toArabicDigits(Math.round(target * eased));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  if ('IntersectionObserver' in window && counters.length) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        runCounter(entry.target);
        cio.unobserve(entry.target);
      });
    }, { threshold: 0.5 });
    counters.forEach(function (el) { cio.observe(el); });
  } else {
    counters.forEach(function (el) { el.textContent = toArabicDigits(el.getAttribute('data-count')); });
  }

  /* ======================================================================
     6. المفضّلة
     ====================================================================== */
  var FAV_KEY = 'bak_favorites';
  var favorites = store.get(FAV_KEY, []);

  function isFav(id) { return favorites.indexOf(id) !== -1; }

  function toggleFav(id) {
    var i = favorites.indexOf(id);
    if (i === -1) {
      favorites.push(id);
      toast('أُضيف للمفضّلة ♥');
    } else {
      favorites.splice(i, 1);
      toast('أُزيل من المفضّلة');
    }
    store.set(FAV_KEY, favorites);
    renderMenu();
  }

  /* ======================================================================
     7. عرض القائمة
     ====================================================================== */
  var menuGrid    = $('#menuGrid');
  var menuEmpty   = $('#menuEmpty');
  var filtersBox  = $('#menuFilters');
  var searchInput = $('#menuSearch');
  var searchClear = $('#menuSearchClear');

  var activeCat = 'all';
  var query     = '';

  /* التصنيف الفارغ لا يُعرض — لا يضغط الزائر زرّاً يؤدّي لصفحة خالية */
  function catHasDishes(id) {
    if (id === 'all' || id === 'fav') return true;
    return DISHES.some(function (d) {
      return (!d.hidden || PREVIEW) && d.cat === id;
    });
  }

  function renderFilters() {
    if (!filtersBox) return;
    filtersBox.innerHTML = CATS.filter(function (cat) {
      return catHasDishes(cat.id);
    }).map(function (cat) {
      var on = cat.id === activeCat;
      return '<button class="chip' + (on ? ' is-active' : '') + '" role="tab"' +
             ' aria-selected="' + on + '" data-filter="' + cat.id + '">' +
             escapeHtml(cat.label) + '</button>';
    }).join('');
  }

  function matchesQuery(dish) {
    if (!query) return true;
    var haystack = (dish.name + ' ' + dish.desc + ' ' + (dish.tag || '')).toLowerCase();
    return haystack.indexOf(query) !== -1;
  }

  /* وضع المعاينة — الرابط ?preview=1
     يُظهر للمالك الأطباق المحجوبة (التي لم يصل سعرها) ليرى شكلها
     قبل النشر. الزائر العادي لا يراها إطلاقاً. */
  var PREVIEW = /[?&]preview=1/.test(window.location.search);

  function visibleDishes() {
    return DISHES.filter(function (dish) {
      if (dish.hidden && !PREVIEW) return false;
      if (activeCat === 'fav' && !isFav(dish.id)) return false;
      if (activeCat !== 'all' && activeCat !== 'fav' && dish.cat !== activeCat) return false;
      return matchesQuery(dish);
    });
  }

  function dishCard(dish) {
    var media = photoBox({
      cls: 'dish-media',
      label: dish.name,
      emoji: dish.emoji,
      img: dishImage(dish),
      img2x: dish.img2x
    });

    /* في المعاينة نُعلّم كل طبق محجوب بسبب حجبه، فلا يلتبس
       المعروض للمالك بالمعروض للزبون */
    var tag = dish.hidden
      ? '<span class="tag tag-draft">' +
          (dish.price ? 'محجوب عن الزوّار' : 'بانتظار السعر') +
        '</span>'
      : (dish.tag
          ? '<span class="tag' + (dish.hot ? ' tag-hot' : '') + '">' + escapeHtml(dish.tag) + '</span>'
          : '');

    var hasOptions = (dish.sizes && dish.sizes.length) ||
                     (dish.addons && dish.addons.length) ||
                     (dish.picks && dish.picks.options && dish.picks.options.length);

    /* ما يأتي مع الطبق مجاناً — شريط بارز لا سطر في الوصف */
    var included = dish.included
      ? '<p class="included"><span aria-hidden="true">🎁</span>' +
        escapeHtml(dish.included) + '</p>'
      : '';

    /* أحجام بأسعار متفاوتة ⇒ سعر البطاقة هو الأدنى، فنقول «من» */
    var lowest = basePrice(dish);
    var varies = !!(dish.sizes && dish.sizes.some(function (s) {
      return sizePrice(dish, s) !== lowest;
    }));
    var priceHtml =
      (varies ? '<small class="price-from">من</small>' : '') +
      toArabicDigits(lowest) +
      '<small>' + escapeHtml(CFG.currency || 'ر.ق') + '</small>';

    return '' +
      '<article class="dish reveal" data-id="' + dish.id + '">' +
        '<div class="dish-media-wrap">' +
          media +
          '<button class="fav-btn' + (isFav(dish.id) ? ' is-on' : '') + '" data-fav="' + dish.id + '"' +
            ' aria-label="' + (isFav(dish.id) ? 'إزالة من المفضّلة' : 'إضافة للمفضّلة') + '">' +
            (isFav(dish.id) ? '♥' : '♡') +
          '</button>' +
        '</div>' +
        '<div class="dish-body">' +
          '<div class="dish-head">' +
            '<h3>' + escapeHtml(dish.name) + '</h3>' +
            '<span class="price">' + priceHtml + '</span>' +
          '</div>' +
          '<p>' + escapeHtml(dish.desc || '') + '</p>' +
          included +
          '<div class="dish-foot">' +
            tag +
            '<button class="add-btn" data-add="' + dish.id + '">' +
              (hasOptions ? 'اختر وأضف' : 'أضف للسلة') +
            '</button>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  /* شريط ثابت يذكّر المالك أنه في المعاينة، فلا يظنّ أن ما يراه منشور */
  function mountPreviewBar() {
    if (!PREVIEW || document.getElementById('previewBar')) return;

    var hiddenCount = DISHES.filter(function (d) { return d.hidden; }).length;
    var bar = document.createElement('div');
    bar.id = 'previewBar';
    bar.className = 'preview-bar';
    bar.innerHTML =
      '<strong>وضع المعاينة</strong>' +
      '<span>تُعرض هنا ' + toArabicDigits(hiddenCount) + ' طبقاً محجوباً لا يراها الزبائن. ' +
      'أدخل السعر لينشر الطبق نفسه.</span>' +
      '<a href="' + window.location.pathname + '">اخرج للعرض العادي</a>';
    document.body.appendChild(bar);
    document.body.classList.add('has-preview-bar');
  }
  mountPreviewBar();

  function renderMenu() {
    if (!menuGrid) return;

    var list = visibleDishes();
    menuGrid.innerHTML = list.map(dishCard).join('');
    $$('.dish', menuGrid).forEach(observeReveal);
    watchPhotos(menuGrid);

    if (menuEmpty) {
      menuEmpty.hidden = list.length !== 0;
      if (!list.length) {
        menuEmpty.textContent = activeCat === 'fav' && !query
          ? 'ما أضفت أطباقاً للمفضّلة بعد — اضغط ♡ على أي طبق.'
          : 'ما لقينا طبقاً يطابق بحثك. جرّب كلمة ثانية.';
      }
    }
  }

  /* أحداث القائمة — مفوّضة من الحاوية */
  if (filtersBox) {
    filtersBox.addEventListener('click', function (e) {
      var chip = e.target.closest('.chip');
      if (!chip) return;
      activeCat = chip.getAttribute('data-filter');
      renderFilters();
      renderMenu();
    });
  }

  if (menuGrid) {
    menuGrid.addEventListener('click', function (e) {
      var favBtn = e.target.closest('[data-fav]');
      if (favBtn) { toggleFav(favBtn.getAttribute('data-fav')); return; }

      var addBtn = e.target.closest('[data-add]');
      if (addBtn) { openDish(addBtn.getAttribute('data-add')); return; }

      var card = e.target.closest('.dish');
      if (card) openDish(card.getAttribute('data-id'));
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', function () {
      query = searchInput.value.trim().toLowerCase();
      if (searchClear) searchClear.hidden = !query;
      renderMenu();
    });
  }

  if (searchClear) {
    searchClear.addEventListener('click', function () {
      searchInput.value = '';
      query = '';
      searchClear.hidden = true;
      renderMenu();
      searchInput.focus();
    });
  }

  renderFilters();
  renderMenu();

  /* ======================================================================
     8. السلة — الحالة
     ====================================================================== */
  var CART_KEY = 'bak_cart';
  var cart = store.get(CART_KEY, []);
  /* الفروع والمناطق تُقرأ من الإعدادات الحيّة، فتتبع أي تحديث من data/site.json */
  function hasBranches() {
    return !!(CFG.branches && CFG.branches.length);
  }

  function zones() {
    return (CFG.deliveryZones && CFG.deliveryZones.length) ? CFG.deliveryZones : null;
  }

  /* لا فروع ⇒ لا خيار استلام، فالوضع الافتراضي توصيل */
  var orderMode = store.get('bak_mode', hasBranches() ? 'pickup' : 'delivery');
  if (!hasBranches()) orderMode = 'delivery';

  /* منطقة التوصيل المختارة */
  var zoneId = store.get('bak_zone', null);

  function currentZone() {
    var list = zones();
    if (!list) return null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === zoneId) return list[i];
    }
    return list[0];
  }

  /* ---------- كميّة الإضافة ----------
     لكل إضافة عددها المستقلّ: صالونتان مع لقن واحد تعنيان ثمن
     صالونة مرّتين، لا ثمن اللقن مرّتين. السلال المحفوظة قبل هذا
     لا تحمل خريطة كميات، فالغياب يعني واحدة — لا ينكسر طلب قديم. */
  function addonCount(item, addonId) {
    var n = item && item.addonQty ? item.addonQty[addonId] : 0;
    return n > 0 ? n : 1;
  }

  /* مفتاح السطر: نفس الطبق بنفس الحجم ونفس الإضافات = سطر واحد */
  /* المفتاح يشمل الاختيارات والكميات كذلك، وإلّا اندمج لقنٌ برزّ
     أبيض مع لقنٍ برزّ سكري، أو صالونة مع صالونتين، في سطر واحد */
  function lineKey(dishId, sizeId, addonIds, pickIds, addonQty) {
    var adds = (addonIds || []).slice().sort().map(function (id) {
      var n = addonQty ? addonQty[id] : 0;
      return id + '×' + (n > 0 ? n : 1);
    }).join('+');

    return [
      dishId,
      sizeId || '-',
      adds || '-',
      (pickIds || []).slice().sort().join('+') || '-'
    ].join('|');
  }

  function linePrice(item) {
    var dish = getDish(item.dishId);
    if (!dish) return 0;

    var unit = dish.price;

    if (item.sizeId && dish.sizes) {
      dish.sizes.forEach(function (s) {
        if (s.id === item.sizeId) unit = sizePrice(dish, s);
      });
    }

    if (item.addonIds && dish.addons) {
      dish.addons.forEach(function (a) {
        if (item.addonIds.indexOf(a.id) !== -1) unit += a.price * addonCount(item, a.id);
      });
    }

    return unit * item.qty;
  }

  function cartCount() {
    return cart.reduce(function (sum, item) { return sum + item.qty; }, 0);
  }

  function cartSubtotal() {
    return cart.reduce(function (sum, item) { return sum + linePrice(item); }, 0);
  }

  /* الجوانب لا تُطلب وحدها — لا بدّ من لقن أو خروف معها.
     الصفة تُقرأ من الطبق الحيّ لا من قائمة محسوبة سلفاً، فتبقى
     صحيحة بعد أن يستبدل data/site.json الأطباق كلّها. */
  function cartHasMain() {
    return cart.some(function (it) {
      var d = getDish(it.dishId);
      return !!(d && d.main);
    });
  }

  function cartSideOnly() {
    if (cartHasMain()) return false;
    return cart.some(function (it) {
      var d = getDish(it.dishId);
      return !!(d && d.needsMain);
    });
  }

  /* حدّ التوصيل المجاني للمنطقة الحالية — freeOver في المنطقة يغلب الإعداد العام */
  function freeOverNow() {
    var z = currentZone();
    if (z && z.freeOver != null) return z.freeOver;
    return CFG.freeDeliveryOver || 0;
  }

  function deliveryFee() {
    if (orderMode !== 'delivery') return 0;
    var free = freeOverNow();
    if (free && cartSubtotal() >= free) return 0;
    var z = currentZone();
    return z ? z.fee : CFG.deliveryFee;
  }

  function saveCart() {
    store.set(CART_KEY, cart);
    store.set('bak_mode', orderMode);
    if (zoneId) store.set('bak_zone', zoneId);
    renderCartBadge();
  }

  function addToCart(dishId, sizeId, addonIds, qty, note, pickIds, addonQty) {
    var key = lineKey(dishId, sizeId, addonIds, pickIds, addonQty);
    var found = null;

    cart.forEach(function (item) {
      if (lineKey(item.dishId, item.sizeId, item.addonIds, item.pickIds, item.addonQty) === key &&
          (item.note || '') === (note || '')) {
        found = item;
      }
    });

    if (found) {
      found.qty += qty;
    } else {
      cart.push({
        dishId: dishId,
        sizeId: sizeId,
        addonIds: addonIds || [],
        addonQty: addonQty || {},
        pickIds: pickIds || [],
        qty: qty,
        note: note || ''
      });
    }

    saveCart();
    renderCart();
  }

  function changeQty(index, delta) {
    if (!cart[index]) return;
    cart[index].qty += delta;
    if (cart[index].qty <= 0) cart.splice(index, 1);
    saveCart();
    renderCart();
  }

  /* ======================================================================
     9. السلة — العرض
     ====================================================================== */
  var cartBtn      = $('#cartBtn');
  var cartCountEl  = $('#cartCount');
  var tabCartCount = $('#tabCartCount');
  var cartDrawer   = $('#cartDrawer');
  var cartItemsEl  = $('#cartItems');
  var cartEmptyEl  = $('#cartEmpty');
  var cartContent  = $('#cartContent');
  var branchSelect = $('#cartBranch');
  var branchField  = $('#branchField');
  var zoneSelect   = $('#cartZone');
  var zoneField    = $('#zoneField');
  var addressField = $('#addressField');
  var unitField    = $('#unitField');
  var cartWarn     = $('#cartWarn');

  /* ---------- بيانات الزبون ----------
     تُحفظ على جهازه فتُملأ وحدها في الطلب القادم. لا تُرسل لأي
     مكان إلا في رسالة واتساب التي يضغط هو زرّها. */
  var INFO_KEY = 'bak_customer';

  function customerFields() {
    return {
      name:    $('#cartName'),
      phone:   $('#cartPhone'),
      address: $('#cartAddress'),
      unit:    $('#cartUnit'),
      date:    $('#cartDate'),
      time:    $('#cartWhen')
    };
  }

  function loadCustomer() {
    var saved = store.get(INFO_KEY, null);
    if (!saved) return;
    var f = customerFields();
    ['name', 'phone', 'address', 'unit'].forEach(function (k) {
      if (f[k] && saved[k]) f[k].value = saved[k];
    });
  }

  function saveCustomer() {
    var f = customerFields();
    store.set(INFO_KEY, {
      name:    f.name    ? f.name.value.trim()    : '',
      phone:   f.phone   ? f.phone.value.trim()   : '',
      address: f.address ? f.address.value.trim() : '',
      unit:    f.unit    ? f.unit.value.trim()    : ''
    });
  }

  /* ---------- وقت التسليم ----------
     المطبخ منزلي يطبخ بالطلب، فلكل وجبة مهلة. */
  function leadCfg() {
    return CFG.lead || { minHours: 8, lunchUntil: 17, dinnerSameDayBefore: 11 };
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function dateValue(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  /* أقرب موعد تسليم مقبول من الآن */
  function earliestSlot() {
    var lead = leadCfg();
    var t = new Date();
    t.setHours(t.getHours() + (lead.minHours || 8));

    /* طلب عشاء اليوم لا يُقبل بعد ساعة الصباح المحدّدة */
    var now = new Date();
    if (now.getHours() >= (lead.dinnerSameDayBefore || 11) &&
        t.getFullYear() === now.getFullYear() &&
        t.getMonth() === now.getMonth() &&
        t.getDate() === now.getDate()) {
      t = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12, 0, 0);
    }
    return t;
  }

  /* هل الموعد المختار مقبول؟ ترجع رسالة الخطأ أو نصّاً فارغاً */
  function slotProblem() {
    var f = customerFields();
    if (!f.date || !f.time || !f.date.value || !f.time.value) return 'اختر تاريخ التسليم وساعته';

    var parts = f.date.value.split('-');
    var hm    = f.time.value.split(':');
    var when  = new Date(+parts[0], +parts[1] - 1, +parts[2], +hm[0], +hm[1], 0);
    if (isNaN(when.getTime())) return 'اختر تاريخ التسليم وساعته';

    var lead = leadCfg();
    var min  = earliestSlot();
    if (when < min) {
      var isLunch = when.getHours() < (lead.lunchUntil || 17);
      return isLunch
        ? 'طلب الغداء يُستقبل قبله بيوم — اختر موعداً أبعد'
        : 'العشاء يُطلب صباح يومه على أبعد تقدير — اختر موعداً أبعد';
    }
    return '';
  }

  function setupWhen() {
    var f = customerFields();
    if (!f.date) return;

    var min = earliestSlot();
    f.date.setAttribute('min', dateValue(new Date()));
    if (!f.date.value) {
      f.date.value = dateValue(min);
      if (f.time) f.time.value = pad2(min.getHours()) + ':' + pad2(min.getMinutes());
    }

    var hint = $('#cartWhenHint');
    if (hint) hint.textContent = leadCfg().note || '';
  }

  /* الموعد المختار بصيغة يقرأها المطبخ. بالإنجليزية تبقى الأرقام
     لاتينية: من لا يقرأ العربية لا يقرأ «٢٠٢٦/٠٨/٠٢» كذلك. */
  function whenText(en) {
    var f = customerFields();
    if (!f.date || !f.time || !f.date.value || !f.time.value) return '';

    var parts = f.date.value.split('-');
    var hm    = +f.time.value.split(':')[0];
    var lunch = hm < (leadCfg().lunchUntil || 17);
    var meal  = en ? (lunch ? 'Lunch' : 'Dinner') : (lunch ? 'غداء' : 'عشاء');
    var date  = parts[2] + '/' + parts[1] + '/' + parts[0];

    if (en) return date + ' — ' + f.time.value + ' (' + meal + ')';
    return toArabicDigits(date) + ' — ' + toArabicDigits(f.time.value) +
           ' (' + meal + ')';
  }

  function fieldError(id, message) {
    var slot = $('.cart-err[data-for="' + id + '"]');
    if (slot) {
      slot.textContent = message || '';
      slot.hidden = !message;
    }
    var input = $('#' + id);
    if (input) input.classList.toggle('has-error', !!message);
    return !message;
  }

  function renderCartBadge() {
    var n = cartCount();
    [cartCountEl, tabCartCount].forEach(function (el) {
      if (!el) return;
      el.textContent = toArabicDigits(n);
      el.hidden = n === 0;
    });
    if (cartBtn) cartBtn.classList.toggle('has-items', n > 0);
  }

  /* الحجم والاختيارات — ما لا ثمن له، فيُكتب سطراً واحداً خفيفاً */
  function itemOptions(item) {
    var dish = getDish(item.dishId);
    if (!dish) return [];
    var parts = [];

    if (item.sizeId && dish.sizes) {
      dish.sizes.forEach(function (s) { if (s.id === item.sizeId) parts.push(s.label); });
    }
    if (item.pickIds && dish.picks && dish.picks.options) {
      dish.picks.options.forEach(function (o) {
        if (item.pickIds.indexOf(o.id) !== -1) parts.push(o.label);
      });
    }
    return parts;
  }

  /* الإضافات المدفوعة، كلٌّ بعددها وثمن عددها — يراها الزبون
     مفصّلة فيعرف على أي شيء دفع، ويصل المطبخ العدد صريحاً */
  function itemAddons(item) {
    var dish = getDish(item.dishId);
    if (!dish || !dish.addons || !item.addonIds) return [];

    return dish.addons.filter(function (a) {
      return item.addonIds.indexOf(a.id) !== -1;
    }).map(function (a) {
      var n = addonCount(item, a.id);
      return { id: a.id, label: a.label, qty: n, total: a.price * n, free: !a.price };
    });
  }

  function itemLabel(item) {
    return itemOptions(item).concat(itemAddons(item).map(function (a) {
      return '+ ' + a.label + (a.qty > 1 ? ' ×' + toArabicDigits(a.qty) : '');
    })).join(' · ');
  }

  function renderCart() {
    renderCartBadge();
    if (!cartItemsEl) return;

    var empty = cart.length === 0;
    if (cartEmptyEl) cartEmptyEl.hidden = !empty;
    if (cartContent) cartContent.hidden = empty;
    if (empty) return;

    cartItemsEl.innerHTML = cart.map(function (item, i) {
      var dish = getDish(item.dishId);
      if (!dish) return '';
      var opts = itemOptions(item).join(' · ');
      var note = item.note ? '<span class="ci-note">📝 ' + escapeHtml(item.note) + '</span>' : '';

      /* كل إضافة سطرها: اسمها، وكم واحدة، وثمن العدد كاملاً */
      var adds = itemAddons(item).map(function (a) {
        return '<li class="ci-add">' +
                 '<span class="ci-add-name">' + escapeHtml(a.label) + '</span>' +
                 '<span class="ci-add-qty">×' + toArabicDigits(a.qty) + '</span>' +
                 '<span class="ci-add-price">' +
                   (a.free ? 'مجاناً' : formatPrice(a.total)) +
                 '</span>' +
               '</li>';
      }).join('');

      return '' +
        '<li class="cart-item">' +
          '<span class="ci-emoji" aria-hidden="true">' + (dish.emoji || '🍽️') + '</span>' +
          '<div class="ci-body">' +
            '<div class="ci-top">' +
              '<strong>' + escapeHtml(dish.name) + '</strong>' +
              '<span class="ci-price">' + formatPrice(linePrice(item)) + '</span>' +
            '</div>' +
            (opts ? '<span class="ci-sub">' + escapeHtml(opts) + '</span>' : '') +
            (adds ? '<ul class="ci-adds">' + adds + '</ul>' : '') +
            note +
            '<div class="ci-foot">' +
              '<div class="qty qty-sm">' +
                '<button type="button" data-qty="' + i + '" data-delta="-1"' +
                  ' aria-label="إنقاص ' + escapeHtml(dish.name) + '">−</button>' +
                '<span>' + toArabicDigits(item.qty) + '</span>' +
                '<button type="button" data-qty="' + i + '" data-delta="1"' +
                  ' aria-label="زيادة ' + escapeHtml(dish.name) + '">+</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</li>';
    }).join('');

    var subtotal = cartSubtotal();
    var fee = deliveryFee();

    $('#sumSubtotal').textContent = formatPrice(subtotal);
    $('#sumTotal').textContent    = formatPrice(subtotal + fee);

    /* الإجمالي على زرّ الإرسال كذلك — الشريط ثابت أسفل السلة،
       فيراه الزبون بلا أن يرجع للأعلى */
    var footTotal = $('#cartFootTotal');
    if (footTotal) footTotal.textContent = formatPrice(subtotal + fee);

    /* «طبقان» و«٣ أطباق» و«١١ طبقاً» — العربية تعدّ هكذا لا برقمٍ وجمع */
    var note = $('#cartCountNote');
    if (note) note.textContent = countLabel(cartCount(), 'طبق', 'طبقان', 'أطباق', 'طبقاً');

    var deliveryRow = $('#deliveryRow');
    if (deliveryRow) {
      deliveryRow.hidden = orderMode !== 'delivery';
      $('#sumDelivery').textContent = fee === 0 ? 'مجاناً' : formatPrice(fee);
    }

    /* لا فروع ⇒ لا استلام: نخفي شريط الطريقة ونُثبّت التوصيل */
    if (!hasBranches() && orderMode !== 'delivery') orderMode = 'delivery';

    if (branchField)  branchField.hidden  = !hasBranches() || orderMode !== 'pickup';
    if (zoneField)    zoneField.hidden    = !zones() || orderMode !== 'delivery';
    if (addressField) addressField.hidden = orderMode !== 'delivery';
    if (unitField)    unitField.hidden    = orderMode !== 'delivery';

    var modeBar = $('.cart-mode');
    if (modeBar) modeBar.hidden = !hasBranches();

    $$('.mode-btn').forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-mode') === orderMode);
    });

    /* تنبيهات الحد الأدنى والتوصيل المجاني */
    if (cartWarn) {
      var messages = [];
      if (CFG.minOrder && subtotal < CFG.minOrder) {
        messages.push('أقل مبلغ للطلب ' + formatPrice(CFG.minOrder) + ' — ينقصك ' + formatPrice(CFG.minOrder - subtotal));
      }
      var free = freeOverNow();
      if (orderMode === 'delivery' && free && subtotal < free) {
        messages.push('أضف ' + formatPrice(free - subtotal) + ' ليصبح التوصيل مجاناً');
      }
      cartWarn.innerHTML = messages.join('<br>');
      cartWarn.hidden = messages.length === 0;
    }
  }

  function openCart() {
    if (!cartDrawer) return;
    loadCustomer();
    setupWhen();
    renderCart();
    cartDrawer.hidden = false;
    document.body.classList.add('modal-open');
    requestAnimationFrame(function () { cartDrawer.classList.add('is-open'); });
  }

  function closeCart() {
    if (!cartDrawer) return;
    cartDrawer.classList.remove('is-open');
    document.body.classList.remove('modal-open');
    setTimeout(function () { cartDrawer.hidden = true; }, 320);
  }

  if (cartBtn) cartBtn.addEventListener('click', openCart);
  var tabCart = $('#tabCart');
  if (tabCart) tabCart.addEventListener('click', openCart);

  if (cartDrawer) {
    cartDrawer.addEventListener('click', function (e) {
      if (e.target.closest('[data-cart-close]')) { closeCart(); return; }

      var qtyBtn = e.target.closest('[data-qty]');
      if (qtyBtn) {
        changeQty(parseInt(qtyBtn.getAttribute('data-qty'), 10),
                  parseInt(qtyBtn.getAttribute('data-delta'), 10));
        return;
      }

      var modeBtn = e.target.closest('[data-mode]');
      if (modeBtn) {
        orderMode = modeBtn.getAttribute('data-mode');
        saveCart();
        renderCart();
      }
    });
  }

  var cartClear = $('#cartClear');
  if (cartClear) {
    cartClear.addEventListener('click', function () {
      if (!cart.length) return;
      cart = [];
      saveCart();
      renderCart();
      toast('تم تفريغ السلة');
    });
  }

  /* تعبئة قائمة الفروع — تُعاد عند تحديث البيانات من لوحة التحكّم */
  function renderBranches() {
    if (!branchSelect || !CFG.branches) return;
    branchSelect.innerHTML = CFG.branches.map(function (b) {
      return '<option value="' + b.id + '">' + escapeHtml(b.name + ' — ' + b.area) + '</option>';
    }).join('');
  }
  renderBranches();

  /* تعبئة مناطق التوصيل مع رسم كل منطقة */
  function renderZones() {
    var list = zones();
    if (!zoneSelect || !list) return;
    var active = currentZone();
    zoneSelect.innerHTML = list.map(function (z) {
      var sel = active && z.id === active.id ? ' selected' : '';
      return '<option value="' + z.id + '"' + sel + '>' +
             escapeHtml(z.label) + ' — ' + formatPrice(z.fee) + '</option>';
    }).join('');
  }
  renderZones();

  if (zoneSelect) {
    zoneSelect.addEventListener('change', function () {
      zoneId = zoneSelect.value;
      saveCart();
      renderCart();
    });
  }

  /* ======================================================================
     10. إرسال الطلب
     ====================================================================== */
  var cartSubmit = $('#cartSubmit');

  if (cartSubmit) {
    cartSubmit.addEventListener('click', function () {
      if (!cart.length) return;

      /* السلة تُستعاد من الجهاز، فقد تصل «جوانب فقط» من جلسة سابقة
         دون أن تمرّ بنافذة الطبق قط. يسبق حارس أقل مبلغ ليظهر
         السبب الحقيقي لا رسالة المبلغ. */
      if (cartSideOnly()) {
        toast('الجوانب تُطلب مع لقن أو خروف', 'error');
        return;
      }

      var subtotal = cartSubtotal();

      if (CFG.minOrder && subtotal < CFG.minOrder) {
        toast('أقل مبلغ للطلب ' + formatPrice(CFG.minOrder), 'error');
        return;
      }

      /* بيانات الزبون — كلّها تُفحص معاً ليرى كل النواقص مرة واحدة */
      var f  = customerFields();
      var ok = true;
      var firstBad = null;

      function need(el, id, message) {
        var good = !!(el && el.value.trim());
        if (!fieldError(id, good ? '' : message)) {
          ok = false;
          if (!firstBad) firstBad = el;
        }
        return good;
      }

      need(f.name, 'cartName', 'اكتب اسمك');

      var phone = f.phone ? f.phone.value.replace(/\D/g, '') : '';
      if (!phone) {
        fieldError('cartPhone', 'اكتب رقم جوالك');
        ok = false;
        if (!firstBad) firstBad = f.phone;
      } else if (phone.length < 8) {
        fieldError('cartPhone', 'رقم الجوال غير مكتمل');
        ok = false;
        if (!firstBad) firstBad = f.phone;
      } else {
        fieldError('cartPhone', '');
      }

      if (orderMode === 'delivery') {
        need(f.address, 'cartAddress', 'اكتب موقع البيت');
        need(f.unit, 'cartUnit', 'اكتب رقم الفيلا أو الشقة');
      }

      var whenBad = slotProblem();
      if (!fieldError('cartWhen', whenBad)) {
        ok = false;
        if (!firstBad) firstBad = f.time;
      }

      if (!ok) {
        toast('أكمل بيانات التوصيل أولاً', 'error');
        if (firstBad && firstBad.focus) firstBad.focus();
        return;
      }

      saveCustomer();

      /* الطلب يُكتب مرّتين: بالعربية ثم بالإنجليزية. في المطبخ من لا
         يقرأ العربية، وسطران متجاوران لكل بند يخلطان اللغتين فلا
         يستقيم أيّهما — أمّا نسختان كاملتان فيقرأ كلٌّ نصفه. */
      function orderLines(en) {
        var money = en ? priceEn : formatPrice;
        var num   = function (n) { return en ? String(n) : toArabicDigits(n); };
        var name  = function (t) { return en ? tr(t) : t; };
        var free  = en ? 'Free' : 'مجاناً';

        var out = [en
          ? 'Hello, I would like to place an order from Bait Alkabsa Kitchens'
          : 'السلام عليكم، أرغب بطلب من مطابخ بيت الكبسة', ''];

        /* الرسالة تفصّل الإضافات سطراً سطراً بعددها وثمنها، فيصل
           المطبخ عددٌ صريح لا يحتمل التأويل، ويراجعه الزبون قبل الإرسال */
        cart.forEach(function (item) {
          var dish = getDish(item.dishId);
          if (!dish) return;
          out.push('• ' + name(dish.name) + ' ×' + num(item.qty) +
                   ' — ' + money(linePrice(item)));

          var opts = itemOptions(item).map(name).join(' · ');
          if (opts) out.push('   ' + opts);

          itemAddons(item).forEach(function (a) {
            out.push('   + ' + name(a.label) + ' ×' + num(a.qty) +
                     ' — ' + (a.free ? free : money(a.total)));
          });

          /* ملاحظة الزبون تبقى بلغته كما كتبها: ترجمتها آلياً تخترع
             ما لم يقله. والوسم وحده يكفي ليعرف الموظف أنّ هنا شرطاً */
          if (item.note) out.push('   ' + (en ? 'Note: ' : 'ملاحظة: ') + item.note);
        });

        out.push('');
        out.push((en ? 'Subtotal: ' : 'المجموع الفرعي: ') + money(subtotal));

        if (orderMode === 'delivery') {
          var fee = deliveryFee();
          out.push((en ? 'Delivery: ' : 'التوصيل: ') + (fee === 0 ? free : money(fee)));
          out.push((en ? 'Total: ' : 'الإجمالي: ') + money(subtotal + fee));
        } else {
          out.push((en ? 'Total: ' : 'الإجمالي: ') + money(subtotal));
        }

        out.push('');
        out.push((en ? 'Name: ' : 'الاسم: ') + f.name.value.trim());
        out.push((en ? 'Phone: ' : 'الجوال: ') + phone);
        out.push((en ? 'Delivery time: ' : 'وقت التسليم: ') + whenText(en));

        if (orderMode === 'delivery') {
          out.push('');
          out.push(en ? 'Order type: Delivery' : 'طريقة الاستلام: توصيل');
          var z = currentZone();
          if (z) out.push((en ? 'Zone: ' : 'المنطقة: ') + name(z.label));
          out.push((en ? 'Location: ' : 'الموقع: ') + f.address.value.trim());
          out.push((en ? 'Villa/Flat no.: ' : 'رقم الفيلا/الشقة: ') + f.unit.value.trim());
        } else {
          out.push('');
          out.push(en ? 'Order type: Pickup' : 'طريقة الاستلام: من الفرع');
          if (branchSelect && branchSelect.selectedIndex >= 0) {
            out.push((en ? 'Branch: ' : 'الفرع: ') +
                     name(branchSelect.options[branchSelect.selectedIndex].text));
          }
        }
        return out;
      }

      var lines = orderLines(false)
        .concat(['', '— — — — — — — — — —', 'ENGLISH', ''])
        .concat(orderLines(true));

      window.open('https://wa.me/' + CFG.whatsapp + '?text=' + encodeURIComponent(lines.join('\n')), '_blank');
      toast('جارٍ فتح واتساب لإرسال طلبك…');
    });
  }

  /* ======================================================================
     11. نافذة تفاصيل الطبق
     ====================================================================== */
  var modal    = $('#dishModal');
  var dmQty    = 1;
  var dmDish   = null;
  var lastFocus = null;

  /* كميّة كل إضافة في النافذة المفتوحة — تُصفَّر مع كل فتح */
  var dmAddonQty = {};
  var ADDON_MAX = 20;

  function selectedSizeId() {
    var input = $('#dmSizesList input:checked');
    return input ? input.value : null;
  }

  /* المختار = ما عدده واحد فأكثر، بترتيب القائمة لا بترتيب الضغط */
  function selectedAddonIds() {
    if (!dmDish || !dmDish.addons) return [];
    return dmDish.addons.filter(function (a) {
      return dmAddonQty[a.id] > 0;
    }).map(function (a) { return a.id; });
  }

  function selectedAddonQty() {
    var map = {};
    selectedAddonIds().forEach(function (id) { map[id] = dmAddonQty[id]; });
    return map;
  }

  function selectedPickIds() {
    return $$('#dmPicksList input:checked').map(function (i) { return i.value; });
  }

  /* المثال المكتوب في الصفحة هو الافتراضي، يُحفظ قبل أن يُستبدل
     بمثال أطباق اللحم — فلا يتكرّر النصّ في ملفّين */
  var DM_NOTE_HINT = ($('#dmNote') && $('#dmNote').placeholder) || '';

  /* اختيار إلزامي لم يُحدَّد بعد. لا اختيار كذلك اليوم — أرز السمك
     اختياري وأرز اللحم محذوف — والحارس باقٍ لأنّ الإلزام يعود بحقل
     واحد في البيانات. كان يمنع الإضافة بتنبيه عابر: يضغط الزبون
     «أضف» فلا يرى شيئاً، ثم يفتح السلة فيجدها فارغة ويظنّه معطوباً. */
  function missingPick() {
    return !!(dmDish && dmDish.picks && !dmDish.picks.optional && !selectedPickIds().length);
  }

  /* الاختيارات محدودة العدد: عند بلوغ الحدّ تُقفل غير المختارة،
     فلا يستطيع الزبون تجاوز ما يقبله المطبخ */
  function enforcePickLimit() {
    if (!dmDish || !dmDish.picks) return;

    var max     = dmDish.picks.max || 0;
    var boxes   = $$('#dmPicksList input');
    var chosen  = selectedPickIds().length;
    var atLimit = max > 0 && chosen >= max;

    boxes.forEach(function (b) { b.disabled = atLimit && !b.checked; });

    var note = $('#dmPicksNote');
    if (note) {
      /* أي تغيير يمحو نداء «مطلوب» الأحمر — الزبون استجاب له */
      note.classList.remove('is-error');
      note.hidden = !max;
      if (max) {
        note.textContent = atLimit
          ? 'اخترت الحدّ الأقصى (' + toArabicDigits(max) + '). أزل اختياراً لتبديله.'
          : 'يمكنك اختيار ' + toArabicDigits(max) + ' على الأكثر.';
      }
    }

    var box = $('#dmPicks');
    if (box) box.classList.remove('is-flash');
  }

  function dmUnitPrice() {
    if (!dmDish) return 0;
    var unit = dmDish.price;

    var sizeId = selectedSizeId();
    if (sizeId && dmDish.sizes) {
      dmDish.sizes.forEach(function (s) { if (s.id === sizeId) unit = sizePrice(dmDish, s); });
    }

    /* ثمن الإضافة يُضرب بعددها وحدها — لا بعدد الأطباق */
    if (dmDish.addons) {
      dmDish.addons.forEach(function (a) {
        var n = dmAddonQty[a.id] || 0;
        if (n > 0) unit += a.price * n;
      });
    }
    return unit;
  }

  /* ملخّص الطلب قبل الإضافة: ماذا اختار الزبون بالضبط، وكم واحدة
     من كل إضافة، وثمن كل بند — فلا يضغط «أضف» وهو يخمّن */
  function refreshModalSummary() {
    var box = $('#dmSummary');
    if (!box || !dmDish) return;

    var head = [dmDish.name];
    var sizeId = selectedSizeId();
    if (sizeId && dmDish.sizes) {
      dmDish.sizes.forEach(function (s) { if (s.id === sizeId) head.push(s.label); });
    }
    if (dmDish.picks && dmDish.picks.options) {
      var picked = selectedPickIds();
      dmDish.picks.options.forEach(function (o) {
        if (picked.indexOf(o.id) !== -1) head.push(o.label);
      });
    }

    var rows = selectedAddonIds().map(function (id) {
      var a = null;
      dmDish.addons.forEach(function (x) { if (x.id === id) a = x; });
      if (!a) return '';
      var n = dmAddonQty[id];
      return '<li>' +
               '<span>' + escapeHtml(a.label) + '</span>' +
               '<b>×' + toArabicDigits(n) + '</b>' +
               '<span>' + (a.price ? formatPrice(a.price * n) : 'مجاناً') + '</span>' +
             '</li>';
    }).join('');

    box.innerHTML =
      '<p class="dm-sum-head">' + escapeHtml(head.join(' · ')) +
        (dmQty > 1 ? ' <b>×' + toArabicDigits(dmQty) + '</b>' : '') + '</p>' +
      (rows ? '<ul class="dm-sum-adds">' + rows + '</ul>' : '');
  }

  function refreshModalTotal() {
    var total = $('#dmTotal');
    if (total) total.textContent = formatPrice(dmUnitPrice() * dmQty);
    var qtyEl = $('#dmQty');
    if (qtyEl) qtyEl.textContent = toArabicDigits(dmQty);

    /* الزرّ يكتب ما ينقص بدل أن يبدو جاهزاً ثم لا يفعل شيئاً */
    var addBtn = $('#dmAdd');
    var label  = $('#dmAddLabel');
    if (addBtn && label) {
      var blocked = missingPick();
      addBtn.classList.toggle('is-blocked', blocked);
      label.textContent = blocked
        ? (dmDish.picks.need || 'اختر نوع الأرز أولاً')
        : 'أضف للسلة';
    }

    refreshModalSummary();
  }

  /* الاختيار الناقص يُنادى عليه في مكانه: نعلّم المجموعة بالأحمر
     ونجرّها أمام عين الزبون بدل تنبيهٍ يمرّ في أسفل الشاشة */
  function callOutPicks() {
    var box  = $('#dmPicks');
    var note = $('#dmPicksNote');
    if (!box) return;

    box.classList.remove('is-flash');
    /* إعادة تشغيل الحركة تحتاج قراءة تُجبر المتصفّح على إعادة الحساب */
    void box.offsetWidth;
    box.classList.add('is-flash');

    if (note) {
      note.hidden = false;
      note.classList.add('is-error');
      note.textContent = (dmDish.picks.label || 'الاختيار') + ' — مطلوب قبل الإضافة';
    }
    if (box.scrollIntoView) box.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function openDish(id) {
    var dish = getDish(id);
    if (!dish || !modal) return;

    dmDish = dish;
    dmQty = 1;
    dmAddonQty = {};
    lastFocus = document.activeElement;

    $('#dmTitle').textContent = dish.name;
    $('#dmDesc').textContent  = dish.desc || '';
    $('#dmBasePrice').innerHTML = toArabicDigits(dish.price) +
      '<small>' + escapeHtml(CFG.currency || 'ر.ق') + '</small>';
    $('#dmEmoji').textContent = dish.emoji || '🍽️';

    /* صورة الطبق داخل النافذة — تُستبدل مع كل فتح، والإطار النائب بديلها */
    var dmPhoto = $('#dmPhoto');
    dmPhoto.setAttribute('data-label', dish.name);
    $$('.photo-img', dmPhoto).forEach(function (old) { dmPhoto.removeChild(old); });

    var dmSrc = dishImage(dish);
    if (dmSrc) {
      dmPhoto.insertAdjacentHTML('beforeend', photoImg(dmSrc, dish.img2x, dish.name, true));
      watchPhotos(dmPhoto);
    }

    var inc = $('#dmIncluded');
    if (inc) {
      inc.hidden = !dish.included;
      inc.innerHTML = dish.included
        ? '<span aria-hidden="true">🎁</span>' + escapeHtml(dish.included)
        : '';
    }

    var prep = $('#dmPrep');
    if (prep) {
      prep.hidden = !dish.prep;
      if (dish.prep) prep.textContent = '⏱ وقت التحضير ' + toArabicDigits(dish.prep) + ' دقيقة تقريباً';
    }

    /* الأحجام */
    var sizesBox = $('#dmSizes');
    var sizesList = $('#dmSizesList');
    if (dish.sizes && dish.sizes.length) {
      sizesBox.hidden = false;

      /* بعض الأطباق خياراتها أنواع لا أحجام — الطبق يسمّي العنوان بنفسه */
      var sizesHead = $('h4', sizesBox);
      if (sizesHead) sizesHead.textContent = dish.sizeLabel || 'اختر الحجم';

      /* السعر الكامل لكل حجم، لا الفرق — أوضح حين تكون الفروق بالمئات */
      var first   = sizePrice(dish, dish.sizes[0]);
      var varying = dish.sizes.some(function (s) { return sizePrice(dish, s) !== first; });
      sizesList.innerHTML = dish.sizes.map(function (s, i) {
        var extra = varying
          ? '<span class="opt-price">' + formatPrice(sizePrice(dish, s)) + '</span>'
          : '';
        return '<label class="opt">' +
                 '<input type="radio" name="dmSize" value="' + s.id + '"' + (i === 0 ? ' checked' : '') + ' />' +
                 '<span class="opt-label">' + escapeHtml(s.label) + '</span>' + extra +
               '</label>';
      }).join('');
    } else {
      sizesBox.hidden = true;
      sizesList.innerHTML = '';
    }

    /* الاختيارات بلا سعر — نوع الأرز ونحوه */
    var picksBox  = $('#dmPicks');
    var picksList = $('#dmPicksList');
    if (picksBox && dish.picks && dish.picks.options && dish.picks.options.length) {
      picksBox.hidden = false;

      /* شارة «مطلوب» على الإلزامي، و«اختياري» على غيره — يعرف
         الزبون قبل أن يضغط أن هذا الاختيار يوقف طلبه */
      $('#dmPicksLabel').innerHTML = escapeHtml(dish.picks.label || 'اختر') +
        (dish.picks.optional
          ? ' <span class="optional">(اختياري)</span>'
          : ' <span class="opt-req">مطلوب</span>');
      picksList.innerHTML = dish.picks.options.map(function (o) {
        return '<label class="opt">' +
                 '<input type="checkbox" value="' + o.id + '" />' +
                 '<span class="opt-label">' + escapeHtml(o.label) + '</span>' +
               '</label>';
      }).join('');
      enforcePickLimit();
    } else if (picksBox) {
      picksBox.hidden = true;
      picksList.innerHTML = '';
    }

    /* الإضافات */
    var addonsBox = $('#dmAddons');
    var addonsList = $('#dmAddonsList');
    if (dish.addons && dish.addons.length) {
      addonsBox.hidden = false;
      /* الإضافات المجمّعة بـ group تُعرض تحت عنوان كل طائفة،
         فقائمة الأحد عشر خياراً تبقى مقروءة */
      var lastGroup = null;
      addonsList.innerHTML = dish.addons.map(function (a) {
        var head = '';
        if (a.group && a.group !== lastGroup) {
          head = '<p class="opt-subhead">' + escapeHtml(a.group) + '</p>';
          lastGroup = a.group;
        }

        /* إضافة بسعر صفر تُقدَّم مع الطبق، فنقولها بدل «+ ٠» */
        var price = a.price
          ? '+ ' + formatPrice(a.price)
          : 'مجاناً';

        /* عدّاد لكل إضافة: صالونتان تعنيان ثمن صالونة مرّتين،
           بينما زرّ الكمية أسفل النافذة يضاعف الطبق كلّه */
        return head +
               '<div class="opt opt-addon" data-addon="' + escapeHtml(a.id) + '">' +
                 '<span class="opt-label">' + escapeHtml(a.label) + '</span>' +
                 '<span class="opt-price">' + price + '</span>' +
                 '<span class="qty qty-sm addon-qty">' +
                   '<button type="button" data-addon-step="-1"' +
                     ' aria-label="إنقاص ' + escapeHtml(a.label) + '">−</button>' +
                   '<span class="addon-count" aria-live="polite">٠</span>' +
                   '<button type="button" data-addon-step="1"' +
                     ' aria-label="زيادة ' + escapeHtml(a.label) + '">+</button>' +
                 '</span>' +
               '</div>';
      }).join('');
    } else {
      addonsBox.hidden = true;
      addonsList.innerHTML = '';
    }

    /* أطباق اللحم والدجاج لا تُعرض فيها أنواع الأرز: اسم الطبق يحدّده،
       ومن أراد غيره فباب الملاحظات هو الباقي له — فيقوله المثال بدل
       أن يبحث عنه الزبون. */
    var noteEl = $('#dmNote');
    noteEl.value = '';
    noteEl.placeholder = (dish.cat === 'lamb' || dish.cat === 'chicken')
      ? 'مثال: رز بداوي، بدون بصل'
      : DM_NOTE_HINT;

    refreshModalTotal();
    modal.hidden = false;
    document.body.classList.add('modal-open');
    requestAnimationFrame(function () {
      modal.classList.add('is-open');
      var closeBtn = $('.modal-close', modal);
      if (closeBtn) closeBtn.focus();
    });
  }

  function closeDish() {
    if (!modal) return;
    modal.classList.remove('is-open');
    document.body.classList.remove('modal-open');
    setTimeout(function () { modal.hidden = true; }, 300);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  if (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) { closeDish(); return; }

      /* closest لا مقارنة المعرّف: زرّ «أضف للسلة» يحوي سعراً داخله،
         فالضغطة على السعر هدفها العنصر الداخلي لا الزرّ. المقارنة
         المباشرة كانت تبتلع الضغطة فتبقى السلة فارغة. */
      if (e.target.closest('#dmPlus'))  { dmQty++; refreshModalTotal(); return; }
      if (e.target.closest('#dmMinus')) { if (dmQty > 1) dmQty--; refreshModalTotal(); return; }

      /* عدّاد الإضافة: يزيد ثمنها وحدها في السطر */
      var step = e.target.closest('[data-addon-step]');
      if (step) {
        var row = step.closest('[data-addon]');
        if (!row) return;

        var id  = row.getAttribute('data-addon');
        var now = (dmAddonQty[id] || 0) + parseInt(step.getAttribute('data-addon-step'), 10);
        if (now < 0) now = 0;
        if (now > ADDON_MAX) now = ADDON_MAX;

        dmAddonQty[id] = now;
        row.classList.toggle('is-picked', now > 0);
        var count = $('.addon-count', row);
        if (count) count.textContent = toArabicDigits(now);
        refreshModalTotal();
        return;
      }

      if (e.target.closest('#dmAdd')) {
        /* الجانب لا يُطلب وحده — النافذة تبقى مفتوحة ليرى الزبون مكانه */
        if (dmDish.needsMain && !cartHasMain()) {
          toast('تُطلب مع لقن أو خروف — أضف الطبق الرئيسي أولاً', 'error');
          return;
        }

        /* اختيار إلزامي لم يُحدَّد ⇒ لا نُرسل طلباً ناقصاً للمطبخ */
        if (missingPick()) {
          callOutPicks();
          toast(dmDish.picks.label || 'اختر أولاً', 'error');
          return;
        }
        addToCart(dmDish.id, selectedSizeId(), selectedAddonIds(), dmQty,
                  $('#dmNote').value.trim(), selectedPickIds(), selectedAddonQty());
        toast(dmDish.name + ' أُضيف للسلة ✅');
        closeDish();
      }
    });

    modal.addEventListener('change', function () {
      enforcePickLimit();
      refreshModalTotal();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (lightbox && !lightbox.hidden) { closeLightbox(); return; }
    if (modal && !modal.hidden) { closeDish(); return; }
    if (cartDrawer && !cartDrawer.hidden) { closeCart(); return; }
    closeNav();
  });

  renderCartBadge();


  /* ======================================================================
     13. سنة الفوتر
     ====================================================================== */
  var yearEl = $('#year');
  if (yearEl) yearEl.textContent = toArabicDigits(new Date().getFullYear());

  /* ======================================================================
     14. وضع التطبيق
     التطبيق الأصلي قد يحمّل الموقع الحيّ من الإنترنت، فلا تصله التعديلات
     التي يضيفها app/sync-web.mjs للنسخة المضمّنة. لذلك نتعرّف عليه بثلاث طرق:
       ١. العلامة ?app=1 في رابط التطبيق (تُضبط في capacitor.config.json)
       ٢. جسر Capacitor المحقون في الواجهة
       ٣. المتغيّر __NATIVE_APP__ في النسخة المضمّنة أوفلاين
     ====================================================================== */
  var isBundled = window.__NATIVE_APP__ === true;

  var hasBridge = !!(window.Capacitor && (window.Capacitor.isNativePlatform
    ? window.Capacitor.isNativePlatform()
    : window.Capacitor.isNative));

  var isNative = isBundled || hasBridge || window.location.search.indexOf('app=1') !== -1;

  var isStandalone =
    isNative ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  if (isStandalone) document.body.classList.add('is-app');

  /* ======================================================================
     15. عامل الخدمة
     يُسجَّل حتى داخل التطبيق حين يحمّل الموقع من الإنترنت — فهو ما يجعل
     التطبيق يعمل بعد ذلك بدون اتصال. ولا يُسجَّل للنسخة المضمّنة أصلاً.
     ====================================================================== */
  if (!isBundled && 'serviceWorker' in navigator && location.protocol !== 'file:') {
    /* نسخة جديدة من العامل تعني ملفات جديدة — أسعاراً أو أطباقاً.
       الصفحة المفتوحة تكون قد حمّلت القديم، فنعيد تحميلها مرّة
       واحدة عند تسلّم النسخة الجديدة. أوّل زيارة بلا مراقب سابق
       لا تُعاد، وإلّا دار المتصفّح في حلقة تحميل. */
    var hadController = !!navigator.serviceWorker.controller;
    var swReloaded = false;

    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController || swReloaded) return;
      swReloaded = true;
      window.location.reload();
    });

    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function (err) {
        console.warn('تعذّر تسجيل عامل الخدمة:', err);
      });
    });
  }

  /* ======================================================================
     16. لافتة تثبيت التطبيق
     ====================================================================== */
  var deferredPrompt = null;
  var banner      = $('#installBanner');
  var installBtn  = $('#installBtn');
  var installClose = $('#installClose');
  var DISMISS_KEY = 'bak_install_dismissed';

  window.addEventListener('beforeinstallprompt', function (e) {
    if (isNative) return;
    e.preventDefault();
    deferredPrompt = e;
    if (banner && !store.get(DISMISS_KEY, null) && !isStandalone) {
      setTimeout(function () { banner.classList.add('is-open'); }, 3500);
    }
  });

  if (installBtn) {
    installBtn.addEventListener('click', function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function () {
        deferredPrompt = null;
        if (banner) banner.classList.remove('is-open');
      });
    });
  }

  if (installClose) {
    installClose.addEventListener('click', function () {
      if (banner) banner.classList.remove('is-open');
      store.set(DISMISS_KEY, 1);
    });
  }

  window.addEventListener('appinstalled', function () {
    if (banner) banner.classList.remove('is-open');
    deferredPrompt = null;
  });

  /* ======================================================================
     17. حالة الاتصال
     ====================================================================== */
  var offlineBar = $('#offlineBar');

  function syncOnlineState() {
    if (!offlineBar) return;
    offlineBar.classList.toggle('is-open', !navigator.onLine);
  }
  window.addEventListener('online',  syncOnlineState);
  window.addEventListener('offline', syncOnlineState);
  syncOnlineState();

  /* ======================================================================
     18. معرض الصور والعرض المكبّر
     يُرسم من js/gallery-data.js. الصور اختيارية — بدونها تظهر الأطر النائبة.
     ====================================================================== */
  var galleryGrid = $('#galleryGrid');
  var lightbox    = $('#lightbox');
  var lbStage     = $('#lbStage');
  var lbIndex     = 0;
  var lbFocus     = null;

  function renderGallery() {
    if (!galleryGrid) return;

    galleryGrid.innerHTML = SHOTS.map(function (shot, i) {
      return '<button type="button" class="photo gal-item ' + (shot.span || '') + '"' +
               ' data-gal="' + i + '" data-label="' + escapeHtml(shot.label) + '"' +
               ' aria-label="تكبير الصورة: ' + escapeHtml(shot.label) + '">' +
               '<span class="photo-emoji" aria-hidden="true">' + (shot.emoji || '📷') + '</span>' +
               photoImg(shot.img, shot.img2x, shot.alt || shot.label) +
             '</button>';
    }).join('');

    watchPhotos(galleryGrid);
  }

  function showShot(index) {
    if (!lbStage || !SHOTS.length) return;

    lbIndex = (index + SHOTS.length) % SHOTS.length;
    var shot = SHOTS[lbIndex];

    lbStage.innerHTML = photoBox({
      cls: 'lb-photo',
      label: shot.label,
      emoji: shot.emoji || '📷',
      img: shot.img,
      img2x: shot.img2x,
      alt: shot.alt || shot.label,
      eager: true
    });
    watchPhotos(lbStage);

    var caption = $('#lbCaption');
    var counter = $('#lbCounter');
    if (caption) caption.textContent = shot.caption || shot.label;
    if (counter) {
      counter.textContent = toArabicDigits(lbIndex + 1) + ' / ' + toArabicDigits(SHOTS.length);
    }

    /* تحميل مسبق للصورة المجاورة حتى يكون التنقّل فورياً */
    var nextShot = SHOTS[(lbIndex + 1) % SHOTS.length];
    if (nextShot && nextShot.img && typeof Image === 'function') {
      try { new Image().src = nextShot.img; } catch (e) {}
    }
  }

  function openLightbox(index) {
    if (!lightbox || !SHOTS.length) return;

    lbFocus = document.activeElement;
    showShot(index);

    lightbox.classList.toggle('is-single', SHOTS.length < 2);
    lightbox.hidden = false;
    document.body.classList.add('modal-open');

    requestAnimationFrame(function () {
      lightbox.classList.add('is-open');
      var closeBtn = $('.lb-close', lightbox);
      if (closeBtn) closeBtn.focus();
    });
  }

  function closeLightbox() {
    if (!lightbox) return;

    lightbox.classList.remove('is-open');
    if (!modal || modal.hidden) document.body.classList.remove('modal-open');
    setTimeout(function () { lightbox.hidden = true; }, 300);
    if (lbFocus && lbFocus.focus) lbFocus.focus();
  }

  if (galleryGrid) {
    renderGallery();

    galleryGrid.addEventListener('click', function (e) {
      var cell = e.target.closest('[data-gal]');
      if (!cell) return;
      openLightbox(parseInt(cell.getAttribute('data-gal'), 10) || 0);
    });
  }

  if (lightbox) {
    lightbox.addEventListener('click', function (e) {
      if (e.target.closest('[data-lb-close]')) { closeLightbox(); return; }

      var nav = e.target.closest('[data-lb]');
      if (nav) showShot(lbIndex + (nav.getAttribute('data-lb') === 'next' ? 1 : -1));
    });

    /* الأسهم بمنطق الاتجاه العربي: التالي على اليسار والسابق على اليمين */
    document.addEventListener('keydown', function (e) {
      if (lightbox.hidden) return;
      if (e.key === 'ArrowLeft')  { showShot(lbIndex + 1); return; }
      if (e.key === 'ArrowRight') { showShot(lbIndex - 1); }
    });

    /* السحب باللمس — سحب لليمين يعرض التالي (اتجاه العرض من اليمين لليسار) */
    var touchX = null;

    lightbox.addEventListener('touchstart', function (e) {
      touchX = e.changedTouches[0].clientX;
    }, { passive: true });

    lightbox.addEventListener('touchend', function (e) {
      if (touchX === null) return;
      var dx = e.changedTouches[0].clientX - touchX;
      touchX = null;
      if (Math.abs(dx) < 45) return;
      showShot(lbIndex + (dx > 0 ? 1 : -1));
    }, { passive: true });
  }

  /* ======================================================================
     19. صورة «عن المطعم» وفهرس الصور
     ====================================================================== */
  var aboutPhoto = $('#aboutPhoto');
  var ABOUT_IMG  = 'images/about.jpg';
  var LOGO_IMG   = 'images/logo.png';

  /* الشعار: نستبدل رسمة SVG بالشعار الحقيقي فقط إذا أكّد الفهرس وجوده،
     ونرجع للرسمة لو تعذّر تحميله — فلا تظهر صورة مكسورة في الهيدر. */
  var brandMark = $('.brand-mark');
  var brandSvg  = brandMark ? brandMark.innerHTML : '';

  function renderLogo() {
    if (!brandMark) return;

    /* بلا فهرس نطلب الشعار كما هو ونتّكل على onerror — الفهرس لا
       يُكتب إلا حين يرفع المالك صورة من اللوحة، والشعار قد يوضع
       في المستودع مباشرة */
    if (!imageExists(LOGO_IMG)) {
      if (!$('svg', brandMark)) brandMark.innerHTML = brandSvg;
      brandMark.classList.remove('has-logo');
      return;
    }
    if ($('img', brandMark)) return;

    var img = document.createElement('img');
    img.className = 'brand-logo';
    img.src = LOGO_IMG;
    img.alt = '';
    /* الشعار الحقيقي يحمل خلفيته، فتُرفع خلفية الإطار الذهبية عنه */
    img.onload = function () { brandMark.classList.add('has-logo'); };
    img.onerror = function () {
      brandMark.innerHTML = brandSvg;
      brandMark.classList.remove('has-logo');
    };

    brandMark.innerHTML = '';
    brandMark.appendChild(img);
  }

  function renderAbout() {
    if (!aboutPhoto) return;

    $$('.photo-img', aboutPhoto).forEach(function (old) { aboutPhoto.removeChild(old); });
    if (!imageExists(ABOUT_IMG)) return;

    aboutPhoto.insertAdjacentHTML('beforeend',
      photoImg(ABOUT_IMG, null, 'مطبخ بيت الكبسة والقدور على النار'));
    watchPhotos(aboutPhoto);
  }

  /* أي إطار صورة في الصفحة يحمل data-src — مثل سفرة الواجهة.
     بلا الملف يبقى الإطار النائب ظاهراً، وهو تصميم لا عطل. */
  function renderStaticPhotos() {
    $$('.photo[data-src]').forEach(function (box) {
      var src = box.getAttribute('data-src');
      $$('.photo-img', box).forEach(function (old) { box.removeChild(old); });
      if (!src || !imageExists(src)) return;

      box.insertAdjacentHTML('beforeend',
        photoImg(src, box.getAttribute('data-src2x'), box.getAttribute('data-label') || ''));
      watchPhotos(box);
    });
  }

  /* يُستدعى بعد وصول الفهرس، أو من لوحة الإدارة بعد نشر صورة */
  function applyImageIndex(files) {
    IMAGE_INDEX = files || [];

    renderMenu();
    renderGallery();
    renderAbout();
    renderStaticPhotos();
    renderLogo();
  }

  function loadImageIndex() {
    if (typeof fetch !== 'function') return;

    fetch('images/manifest.json', { cache: 'no-cache' })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (!data || !Array.isArray(data.files)) return;
        applyImageIndex(data.files);
      })
      .catch(function () { /* لا فهرس — نُبقي السلوك اليدوي */ });
  }

  renderAbout();
  renderStaticPhotos();
  renderLogo();
  loadImageIndex();

  /* صور ثابتة في الصفحة */
  watchPhotos(document);

  /* ---------- فيديو الواجهة ----------
     ملف اختياري في images/hero.mp4 يُري الزبون طريقة الطبخ خلف العنوان.
     لا نطلبه إلا بعد التأكّد من أن الجهاز يريده، ونحذف العنصر كلّياً إن
     غاب الملف — فيبقى تدرّج الخلفية كما كان، بلا مستطيل أسود. */
  var HERO_VIDEO = 'images/hero.mp4';

  function setupHeroVideo() {
    var video = $('#heroVideo');
    if (!video) return;

    var hero = video.closest('.hero');
    var veil = $('.hero-veil');

    function drop() {
      [video, veil].forEach(function (el) {
        if (el && el.parentNode) el.parentNode.removeChild(el);
      });
    }

    /* الفيديو ميغابايتات تُحمَّل مع كل زيارة، فلا نفرضها على أحد:
       من طلب تقليل الحركة، ومن فتح وضع توفير البيانات، ومن كان
       اتصاله بطيئاً — يرى الخلفية المتدرّجة وحدها ولا ينقص طلبه شيء. */
    var reduce = window.matchMedia &&
                 window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var conn   = navigator.connection || {};
    var slow   = conn.effectiveType && /^(slow-)?2g$|^3g$/.test(conn.effectiveType);
    if (reduce || conn.saveData || slow) { drop(); return; }

    video.addEventListener('error', drop);
    video.addEventListener('loadeddata', function () {
      if (hero) hero.classList.add('has-video');
      /* الكتم شرط التشغيل التلقائي، وسفاري يتجاهل الوسم أحياناً */
      video.muted = true;
      var started = video.play();
      if (started && started.catch) started.catch(function () {});
    });

    video.preload = 'auto';
    video.src = HERO_VIDEO;
  }
  setupHeroVideo();

  /* ======================================================================
     21. بيانات الموقع القابلة للتعديل — data/site.json
     تكتبها لوحة التحكّم، وتغلب على ما في js/menu-data.js: الأسعار،
     الأطباق، أرقام التواصل، العنوان، أوقات العمل، الفروع، رسوم التوصيل.
     غيابها يعني أن الموقع يعمل بالقيم الافتراضية في ملفات الكود.
     ====================================================================== */
  function formatPhone(intl) {
    var digits = String(intl || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.indexOf('974') === 0 && digits.length === 11) {
      return '+974 ' + digits.slice(3, 7) + ' ' + digits.slice(7);
    }
    return '+' + digits;
  }

  function localPhone(intl) {
    var digits = String(intl || '').replace(/\D/g, '');
    return digits.indexOf('974') === 0 ? digits.slice(3) : digits;
  }

  function renderContact() {
    var phone = String(CFG.phone || CFG.whatsapp || '').replace(/\D/g, '');
    var wa    = String(CFG.whatsapp || '').replace(/\D/g, '');

    $$('[data-tel]').forEach(function (el) {
      if (phone) el.setAttribute('href', 'tel:+' + phone);

      var mode = el.getAttribute('data-tel');
      if (mode === 'label') el.textContent = formatPhone(phone);
      if (mode === 'call')  el.textContent = 'أو اتصل: ' + toArabicDigits(localPhone(phone));
    });

    $$('[data-wa]').forEach(function (el) {
      if (wa) el.setAttribute('href', 'https://wa.me/' + wa);
      if (el.getAttribute('data-wa') === 'label') el.textContent = formatPhone(wa);
    });

    if (CFG.address) $$('[data-address]').forEach(function (el) { el.textContent = CFG.address; });
    if (CFG.hours)   $$('[data-hours]').forEach(function (el) { el.textContent = CFG.hours; });
  }

  function refreshMenuCount() {
    var live = liveDishCount();
    $$('[data-count-source="menu"]').forEach(function (el) {
      el.setAttribute('data-count', String(live));
      el.textContent = toArabicDigits(live);
    });
  }

  /* سعر قسم الولائم يتبع القائمة: أرخص خروف كامل ظاهر — معرّفاته
     تبدأ بـ lamb- بخلاف النصف (half-). فلا يبقى في الصفحة رقمٌ
     مكتوب باليد يخالف ما في القائمة بعد أي تعديل سعر. */
  function refreshBanquetPrice() {
    var slots = $$('[data-price-source="lamb"]');
    if (!slots.length) return;

    var prices = DISHES.filter(function (d) {
      return !d.hidden && String(d.id).indexOf('lamb-') === 0;
    }).map(basePrice).filter(function (p) { return p > 0; });

    /* بلا خروف ظاهر يبقى النصّ الاحتياطي المكتوب في الصفحة */
    if (!prices.length) return;

    var min = Math.min.apply(null, prices);
    slots.forEach(function (el) {
      el.innerHTML = toArabicDigits(min) +
        ' <small>' + escapeHtml(CFG.currency || 'ر.ق') + '</small>';
    });
  }
  refreshBanquetPrice();

  function applySiteData(data) {
    if (!data) return;

    if (data.config) {
      /* إعدادات تحمل رسماً واحداً بلا مناطق (لوحة قديمة) تُسقط المناطق،
         وإلا بقيت المناطق القديمة تغلب الرسم الجديد */
      if (data.config.deliveryFee != null && data.config.deliveryZones == null) {
        delete CFG.deliveryZones;
      }
      Object.keys(data.config).forEach(function (key) { CFG[key] = data.config[key]; });
    }

    if (Array.isArray(data.categories) && data.categories.length) {
      CATS.length = 0;
      data.categories.forEach(function (c) { CATS.push(c); });
    }

    if (Array.isArray(data.dishes) && data.dishes.length) {
      DISHES.length = 0;
      data.dishes.forEach(function (d) { DISHES.push(d); });
    }

    refreshMenuCount();
    refreshBanquetPrice();
    renderFilters();
    renderMenu();
    renderBranches();
    renderZones();
    renderContact();
    if (cartDrawer && !cartDrawer.hidden) renderCart();
    renderCartBadge();
  }

  function loadSiteData() {
    if (typeof fetch !== 'function') return;

    fetch('data/site.json', { cache: 'no-cache' })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) { if (data) applySiteData(data); })
      .catch(function () { /* لا بيانات محدّثة — نُبقي الافتراضي */ });
  }

  /* لوحة التحكّم تُحدّث الواجهة فوراً بعد الحفظ */
  window.BAK_REFRESH_SITE = applySiteData;

  renderContact();
  loadSiteData();

  /* ======================================================================
     20. مدخل لوحة إضافة الصور
     تُفتح بـ #admin في الرابط، أو بضغطة مطوّلة على الشعار (المدخل الوحيد
     داخل التطبيق الأصلي حيث لا شريط عنوان). لوحة الإدارة نفسها في js/admin.js
     ولا تُحمَّل إلا عند طلبها، فلا تُثقل الزوار.
     ====================================================================== */
  var adminLoading = false;

  function openAdmin() {
    if (window.BAK_ADMIN) { window.BAK_ADMIN.open(); return; }
    if (adminLoading) return;

    adminLoading = true;
    var s = document.createElement('script');
    s.src = 'js/admin.js';
    s.onload = function () {
      adminLoading = false;
      if (window.BAK_ADMIN) window.BAK_ADMIN.open();
    };
    s.onerror = function () {
      adminLoading = false;
      toast('تعذّر تحميل لوحة الصور', 'error');
    };
    document.head.appendChild(s);
  }

  /* اللوحة تُخبرنا بالفهرس الجديد فوراً بلا انتظار إعادة تحميل */
  window.BAK_REFRESH_IMAGES = applyImageIndex;

  if (window.location.hash === '#admin') openAdmin();
  window.addEventListener('hashchange', function () {
    if (window.location.hash === '#admin') openAdmin();
  });

  var brand = $('.brand');
  if (brand) {
    var holdTimer = null;
    var held = false;

    var startHold = function () {
      held = false;
      clearTimeout(holdTimer);
      holdTimer = setTimeout(function () {
        held = true;
        openAdmin();
      }, 1500);
    };
    var cancelHold = function () { clearTimeout(holdTimer); };

    brand.addEventListener('touchstart', startHold, { passive: true });
    brand.addEventListener('touchend', cancelHold);
    brand.addEventListener('touchmove', cancelHold, { passive: true });
    brand.addEventListener('mousedown', startHold);
    brand.addEventListener('mouseup', cancelHold);
    brand.addEventListener('mouseleave', cancelHold);

    /* الضغطة المطوّلة تفتح اللوحة ولا تنقل للصفحة الرئيسية */
    brand.addEventListener('click', function (e) {
      if (!held) return;
      held = false;
      e.preventDefault();
    });
  }

})();
