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

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
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

  /* عدد الأطباق يُقرأ من بيانات القائمة تلقائياً */
  counters.forEach(function (el) {
    if (el.getAttribute('data-count-source') === 'menu' && DISHES.length) {
      el.setAttribute('data-count', String(DISHES.length));
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

  function renderFilters() {
    if (!filtersBox) return;
    filtersBox.innerHTML = CATS.map(function (cat) {
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

  function visibleDishes() {
    return DISHES.filter(function (dish) {
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

    var tag = dish.tag
      ? '<span class="tag' + (dish.hot ? ' tag-hot' : '') + '">' + escapeHtml(dish.tag) + '</span>'
      : '';

    var hasOptions = (dish.sizes && dish.sizes.length) || (dish.addons && dish.addons.length);

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
            '<span class="price">' + toArabicDigits(dish.price) + '</span>' +
          '</div>' +
          '<p>' + escapeHtml(dish.desc) + '</p>' +
          '<div class="dish-foot">' +
            tag +
            '<button class="add-btn" data-add="' + dish.id + '">' +
              (hasOptions ? 'اختر وأضف' : 'أضف للسلة') +
            '</button>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

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
  var orderMode = store.get('bak_mode', 'pickup');

  /* مفتاح السطر: نفس الطبق بنفس الحجم ونفس الإضافات = سطر واحد */
  function lineKey(dishId, sizeId, addonIds) {
    return [dishId, sizeId || '-', (addonIds || []).slice().sort().join('+') || '-'].join('|');
  }

  function linePrice(item) {
    var dish = getDish(item.dishId);
    if (!dish) return 0;

    var unit = dish.price;

    if (item.sizeId && dish.sizes) {
      dish.sizes.forEach(function (s) {
        if (s.id === item.sizeId) unit += s.delta;
      });
    }

    if (item.addonIds && dish.addons) {
      dish.addons.forEach(function (a) {
        if (item.addonIds.indexOf(a.id) !== -1) unit += a.price;
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

  function deliveryFee() {
    if (orderMode !== 'delivery') return 0;
    if (CFG.freeDeliveryOver && cartSubtotal() >= CFG.freeDeliveryOver) return 0;
    return CFG.deliveryFee;
  }

  function saveCart() {
    store.set(CART_KEY, cart);
    store.set('bak_mode', orderMode);
    renderCartBadge();
  }

  function addToCart(dishId, sizeId, addonIds, qty, note) {
    var key = lineKey(dishId, sizeId, addonIds);
    var found = null;

    cart.forEach(function (item) {
      if (lineKey(item.dishId, item.sizeId, item.addonIds) === key && (item.note || '') === (note || '')) {
        found = item;
      }
    });

    if (found) {
      found.qty += qty;
    } else {
      cart.push({ dishId: dishId, sizeId: sizeId, addonIds: addonIds || [], qty: qty, note: note || '' });
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
  var addressField = $('#addressField');
  var cartWarn     = $('#cartWarn');

  function renderCartBadge() {
    var n = cartCount();
    [cartCountEl, tabCartCount].forEach(function (el) {
      if (!el) return;
      el.textContent = toArabicDigits(n);
      el.hidden = n === 0;
    });
    if (cartBtn) cartBtn.classList.toggle('has-items', n > 0);
  }

  function itemLabel(item) {
    var dish = getDish(item.dishId);
    if (!dish) return '';
    var parts = [];

    if (item.sizeId && dish.sizes) {
      dish.sizes.forEach(function (s) { if (s.id === item.sizeId) parts.push(s.label); });
    }
    if (item.addonIds && dish.addons) {
      dish.addons.forEach(function (a) {
        if (item.addonIds.indexOf(a.id) !== -1) parts.push('+ ' + a.label);
      });
    }
    return parts.join(' · ');
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
      var sub = itemLabel(item);
      var note = item.note ? '<span class="ci-note">📝 ' + escapeHtml(item.note) + '</span>' : '';

      return '' +
        '<li class="cart-item">' +
          '<span class="ci-emoji" aria-hidden="true">' + (dish.emoji || '🍽️') + '</span>' +
          '<div class="ci-body">' +
            '<strong>' + escapeHtml(dish.name) + '</strong>' +
            (sub ? '<span class="ci-sub">' + escapeHtml(sub) + '</span>' : '') +
            note +
            '<span class="ci-price">' + formatPrice(linePrice(item)) + '</span>' +
          '</div>' +
          '<div class="qty qty-sm">' +
            '<button type="button" data-qty="' + i + '" data-delta="-1" aria-label="إنقاص">−</button>' +
            '<span>' + toArabicDigits(item.qty) + '</span>' +
            '<button type="button" data-qty="' + i + '" data-delta="1" aria-label="زيادة">+</button>' +
          '</div>' +
        '</li>';
    }).join('');

    var subtotal = cartSubtotal();
    var fee = deliveryFee();

    $('#sumSubtotal').textContent = formatPrice(subtotal);
    $('#sumTotal').textContent    = formatPrice(subtotal + fee);

    var deliveryRow = $('#deliveryRow');
    if (deliveryRow) {
      deliveryRow.hidden = orderMode !== 'delivery';
      $('#sumDelivery').textContent = fee === 0 ? 'مجاناً' : formatPrice(fee);
    }

    if (branchField)  branchField.hidden  = orderMode !== 'pickup';
    if (addressField) addressField.hidden = orderMode !== 'delivery';

    $$('.mode-btn').forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-mode') === orderMode);
    });

    /* تنبيهات الحد الأدنى والتوصيل المجاني */
    if (cartWarn) {
      var messages = [];
      if (CFG.minOrder && subtotal < CFG.minOrder) {
        messages.push('أقل مبلغ للطلب ' + formatPrice(CFG.minOrder) + ' — ينقصك ' + formatPrice(CFG.minOrder - subtotal));
      }
      if (orderMode === 'delivery' && CFG.freeDeliveryOver && subtotal < CFG.freeDeliveryOver) {
        messages.push('أضف ' + formatPrice(CFG.freeDeliveryOver - subtotal) + ' ليصبح التوصيل مجاناً');
      }
      cartWarn.innerHTML = messages.join('<br>');
      cartWarn.hidden = messages.length === 0;
    }
  }

  function openCart() {
    if (!cartDrawer) return;
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

  /* تعبئة قائمة الفروع */
  if (branchSelect && CFG.branches) {
    branchSelect.innerHTML = CFG.branches.map(function (b) {
      return '<option value="' + b.id + '">' + escapeHtml(b.name + ' — ' + b.area) + '</option>';
    }).join('');
  }

  /* ======================================================================
     10. إرسال الطلب
     ====================================================================== */
  var cartSubmit = $('#cartSubmit');

  if (cartSubmit) {
    cartSubmit.addEventListener('click', function () {
      if (!cart.length) return;

      var subtotal = cartSubtotal();

      if (CFG.minOrder && subtotal < CFG.minOrder) {
        toast('أقل مبلغ للطلب ' + formatPrice(CFG.minOrder), 'error');
        return;
      }

      var address = $('#cartAddress');
      if (orderMode === 'delivery' && (!address || !address.value.trim())) {
        toast('اكتب عنوان التوصيل أولاً', 'error');
        if (address) address.focus();
        return;
      }

      var lines = ['السلام عليكم، أرغب بطلب من بيت الكبسة', ''];

      cart.forEach(function (item) {
        var dish = getDish(item.dishId);
        if (!dish) return;
        lines.push('• ' + dish.name + ' ×' + item.qty + ' — ' + formatPrice(linePrice(item)));
        var sub = itemLabel(item);
        if (sub)       lines.push('   ' + sub);
        if (item.note) lines.push('   ملاحظة: ' + item.note);
      });

      lines.push('');
      lines.push('المجموع الفرعي: ' + formatPrice(subtotal));

      if (orderMode === 'delivery') {
        var fee = deliveryFee();
        lines.push('التوصيل: ' + (fee === 0 ? 'مجاناً' : formatPrice(fee)));
        lines.push('الإجمالي: ' + formatPrice(subtotal + fee));
        lines.push('');
        lines.push('طريقة الاستلام: توصيل');
        lines.push('العنوان: ' + address.value.trim());
      } else {
        lines.push('الإجمالي: ' + formatPrice(subtotal));
        lines.push('');
        lines.push('طريقة الاستلام: من الفرع');
        if (branchSelect && branchSelect.selectedIndex >= 0) {
          lines.push('الفرع: ' + branchSelect.options[branchSelect.selectedIndex].text);
        }
      }

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

  function selectedSizeId() {
    var input = $('#dmSizesList input:checked');
    return input ? input.value : null;
  }

  function selectedAddonIds() {
    return $$('#dmAddonsList input:checked').map(function (i) { return i.value; });
  }

  function dmUnitPrice() {
    if (!dmDish) return 0;
    var unit = dmDish.price;

    var sizeId = selectedSizeId();
    if (sizeId && dmDish.sizes) {
      dmDish.sizes.forEach(function (s) { if (s.id === sizeId) unit += s.delta; });
    }

    var addons = selectedAddonIds();
    if (dmDish.addons) {
      dmDish.addons.forEach(function (a) {
        if (addons.indexOf(a.id) !== -1) unit += a.price;
      });
    }
    return unit;
  }

  function refreshModalTotal() {
    var total = $('#dmTotal');
    if (total) total.textContent = formatPrice(dmUnitPrice() * dmQty);
    var qtyEl = $('#dmQty');
    if (qtyEl) qtyEl.textContent = toArabicDigits(dmQty);
  }

  function openDish(id) {
    var dish = getDish(id);
    if (!dish || !modal) return;

    dmDish = dish;
    dmQty = 1;
    lastFocus = document.activeElement;

    $('#dmTitle').textContent = dish.name;
    $('#dmDesc').textContent  = dish.desc;
    $('#dmBasePrice').textContent = toArabicDigits(dish.price);
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
      sizesList.innerHTML = dish.sizes.map(function (s, i) {
        var extra = s.delta ? '<span class="opt-price">+ ' + formatPrice(s.delta) + '</span>' : '';
        return '<label class="opt">' +
                 '<input type="radio" name="dmSize" value="' + s.id + '"' + (i === 0 ? ' checked' : '') + ' />' +
                 '<span class="opt-label">' + escapeHtml(s.label) + '</span>' + extra +
               '</label>';
      }).join('');
    } else {
      sizesBox.hidden = true;
      sizesList.innerHTML = '';
    }

    /* الإضافات */
    var addonsBox = $('#dmAddons');
    var addonsList = $('#dmAddonsList');
    if (dish.addons && dish.addons.length) {
      addonsBox.hidden = false;
      addonsList.innerHTML = dish.addons.map(function (a) {
        return '<label class="opt">' +
                 '<input type="checkbox" value="' + a.id + '" />' +
                 '<span class="opt-label">' + escapeHtml(a.label) + '</span>' +
                 '<span class="opt-price">+ ' + formatPrice(a.price) + '</span>' +
               '</label>';
      }).join('');
    } else {
      addonsBox.hidden = true;
      addonsList.innerHTML = '';
    }

    $('#dmNote').value = '';

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

      if (e.target.id === 'dmPlus')  { dmQty++; refreshModalTotal(); return; }
      if (e.target.id === 'dmMinus') { if (dmQty > 1) dmQty--; refreshModalTotal(); return; }

      if (e.target.id === 'dmAdd') {
        addToCart(dmDish.id, selectedSizeId(), selectedAddonIds(), dmQty, $('#dmNote').value.trim());
        toast(dmDish.name + ' أُضيف للسلة ✅');
        closeDish();
      }
    });

    modal.addEventListener('change', refreshModalTotal);
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
     12. نموذج الحجز
     ====================================================================== */
  var form = $('#reserveForm');

  if (form) {
    var dateInput = $('#rDate');
    if (dateInput) {
      var today = new Date();
      var iso = today.getFullYear() + '-' +
                String(today.getMonth() + 1).padStart(2, '0') + '-' +
                String(today.getDate()).padStart(2, '0');
      dateInput.min = iso;
      if (!dateInput.value) dateInput.value = iso;
    }

    var RULES = {
      rName: function (v) {
        if (!v.trim()) return 'الاسم مطلوب';
        if (v.trim().length < 3) return 'الاسم قصير جداً';
        return '';
      },
      /* أرقام قطر ثمانية أرقام تبدأ بـ 3 أو 5 أو 6 أو 7، مع أو بدون +974 */
      rPhone: function (v) {
        var clean = v.replace(/[\s\-()]/g, '');
        if (!clean) return 'رقم الجوال مطلوب';
        if (!/^(?:\+?974|00974)?[3567]\d{7}$/.test(clean)) {
          return 'أدخل رقم جوال قطري صحيح (٨ أرقام يبدأ بـ ٣ أو ٥ أو ٦ أو ٧)';
        }
        return '';
      },
      rDate: function (v) { return v ? '' : 'اختر تاريخ الحجز'; },
      rTime: function (v) { return v ? '' : 'اختر وقت الحجز'; }
    };

    function validateField(id) {
      var input = document.getElementById(id);
      if (!input || !RULES[id]) return true;

      var msg   = RULES[id](input.value);
      var field = input.closest('.field');
      var slot  = field ? $('.error', field) : null;

      if (field) field.classList.toggle('has-error', !!msg);
      if (slot)  slot.textContent = msg;
      return !msg;
    }

    Object.keys(RULES).forEach(function (id) {
      var input = document.getElementById(id);
      if (!input) return;
      input.addEventListener('blur', function () { validateField(id); });
      input.addEventListener('input', function () {
        var field = input.closest('.field');
        if (field && field.classList.contains('has-error')) validateField(id);
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var ok = Object.keys(RULES).map(validateField).every(Boolean);
      if (!ok) {
        var firstError = $('.field.has-error input, .field.has-error select');
        if (firstError) firstError.focus();
        return;
      }

      var guests = $('#rGuests');
      var msg =
        'السلام عليكم، أرغب بحجز طاولة في بيت الكبسة\n\n' +
        '• الاسم: '   + $('#rName').value.trim()  + '\n' +
        '• الجوال: '  + $('#rPhone').value.trim() + '\n' +
        '• التاريخ: ' + $('#rDate').value         + '\n' +
        '• الوقت: '   + $('#rTime').value         + '\n' +
        '• العدد: '   + guests.options[guests.selectedIndex].text;

      var note = $('#rNote').value.trim();
      if (note) msg += '\n• ملاحظات: ' + note;

      var success = $('#formSuccess');
      if (success) success.hidden = false;

      window.open('https://wa.me/' + CFG.whatsapp + '?text=' + encodeURIComponent(msg), '_blank');
    });
  }

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

    var known = !!IMAGE_INDEX && IMAGE_INDEX.indexOf(LOGO_IMG) !== -1;
    if (!known) {
      if (!$('svg', brandMark)) brandMark.innerHTML = brandSvg;
      return;
    }
    if ($('img', brandMark)) return;

    var img = document.createElement('img');
    img.className = 'brand-logo';
    img.src = LOGO_IMG;
    img.alt = '';
    img.onerror = function () { brandMark.innerHTML = brandSvg; };

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

  /* يُستدعى بعد وصول الفهرس، أو من لوحة الإدارة بعد نشر صورة */
  function applyImageIndex(files) {
    IMAGE_INDEX = files || [];

    renderMenu();
    renderGallery();
    renderAbout();
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
  loadImageIndex();

  /* صور ثابتة في الصفحة */
  watchPhotos(document);

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
