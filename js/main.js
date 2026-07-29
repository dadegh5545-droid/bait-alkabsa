/* ==========================================================================
   بيت الكبسة — السكربت الرئيسي
   ========================================================================== */
(function () {
  'use strict';

  /* رقم واتساب المطعم (بصيغة دولية بدون + أو مسافات) */
  var WHATSAPP = '966500000000';

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------- 1. الهيدر عند التمرير ---------- */
  var header = $('#siteHeader');
  var toTop  = $('#toTop');

  function onScroll() {
    var y = window.scrollY;
    if (header) header.classList.toggle('is-stuck', y > 40);
    if (toTop)  toTop.classList.toggle('is-visible', y > 600);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- 2. قائمة الجوال ---------- */
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

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeNav();
    });

    document.addEventListener('click', function (e) {
      if (!mainNav.classList.contains('is-open')) return;
      if (mainNav.contains(e.target) || navToggle.contains(e.target)) return;
      closeNav();
    });
  }

  /* ---------- 3. إبراز الرابط النشط ---------- */
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
      var href = link.getAttribute('href') || '';
      link.classList.toggle('is-active', href === '#' + current);
    });
  }
  window.addEventListener('scroll', highlight, { passive: true });
  highlight();

  /* ---------- 4. حركات الظهور ---------- */
  var revealEls = $$('.reveal');

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px' });

    revealEls.forEach(function (el, i) {
      el.style.transitionDelay = Math.min(i % 6, 5) * 70 + 'ms';
      io.observe(el);
    });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---------- 5. عدّاد الأرقام ---------- */
  var counters = $$('[data-count]');

  function runCounter(el) {
    var target   = parseInt(el.getAttribute('data-count'), 10) || 0;
    var duration = 1400;
    var start    = null;

    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = toArabicDigits(Math.round(target * eased));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function toArabicDigits(n) {
    return String(n).replace(/\d/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'[+d]; });
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

  /* ---------- 6. تصفية القائمة ---------- */
  var chips     = $$('.chip');
  var dishes    = $$('.dish');
  var menuEmpty = $('#menuEmpty');

  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      chips.forEach(function (c) {
        c.classList.remove('is-active');
        c.setAttribute('aria-selected', 'false');
      });
      chip.classList.add('is-active');
      chip.setAttribute('aria-selected', 'true');

      var filter  = chip.getAttribute('data-filter');
      var visible = 0;

      dishes.forEach(function (dish) {
        var show = filter === 'all' || dish.getAttribute('data-cat') === filter;
        dish.classList.toggle('is-hidden', !show);
        if (show) {
          visible++;
          dish.classList.remove('is-in');
          /* إعادة تشغيل حركة الظهور */
          void dish.offsetWidth;
          dish.classList.add('is-in');
        }
      });

      if (menuEmpty) menuEmpty.hidden = visible !== 0;
    });
  });

  /* ---------- 7. نموذج الحجز ---------- */
  var form = $('#reserveForm');

  if (form) {
    /* الحد الأدنى للتاريخ = اليوم */
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
      rName:  function (v) {
        if (!v.trim()) return 'الاسم مطلوب';
        if (v.trim().length < 3) return 'الاسم قصير جداً';
        return '';
      },
      rPhone: function (v) {
        var clean = v.replace(/[\s-]/g, '');
        if (!clean) return 'رقم الجوال مطلوب';
        if (!/^(?:\+?966|0)?5\d{8}$/.test(clean)) return 'أدخل رقم جوال سعودي صحيح (05XXXXXXXX)';
        return '';
      },
      rDate:  function (v) { return v ? '' : 'اختر تاريخ الحجز'; },
      rTime:  function (v) { return v ? '' : 'اختر وقت الحجز'; }
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
      input.addEventListener('blur',  function () { validateField(id); });
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

      var guestsSelect = $('#rGuests');
      var msg =
        'السلام عليكم، أرغب بحجز طاولة في بيت الكبسة\n\n' +
        '• الاسم: '   + $('#rName').value.trim()  + '\n' +
        '• الجوال: '  + $('#rPhone').value.trim() + '\n' +
        '• التاريخ: ' + $('#rDate').value         + '\n' +
        '• الوقت: '   + $('#rTime').value         + '\n' +
        '• العدد: '   + guestsSelect.options[guestsSelect.selectedIndex].text;

      var note = $('#rNote').value.trim();
      if (note) msg += '\n• ملاحظات: ' + note;

      var success = $('#formSuccess');
      if (success) success.hidden = false;

      window.open('https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(msg), '_blank');
    });
  }

  /* ---------- 8. سنة الفوتر ---------- */
  var yearEl = $('#year');
  if (yearEl) yearEl.textContent = toArabicDigits(new Date().getFullYear());

  /* ---------- 9. وضع التطبيق ---------- */
  /* isNative: يعمل داخل تغليف Capacitor — isStandalone: مثبَّت كـ PWA */
  var isNative = window.__NATIVE_APP__ === true;
  var isStandalone =
    isNative ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  if (isStandalone) document.body.classList.add('is-app');

  /* ---------- 10. تسجيل عامل الخدمة ---------- */
  /* غير مطلوب داخل التطبيق الأصلي — الملفات مضمّنة فيه */
  if (!isNative && 'serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function (err) {
        console.warn('تعذّر تسجيل عامل الخدمة:', err);
      });
    });
  }

  /* ---------- 11. لافتة تثبيت التطبيق ---------- */
  var deferredPrompt = null;
  var banner   = $('#installBanner');
  var btnBtn   = $('#installBtn');
  var closeBtn = $('#installClose');
  var DISMISS_KEY = 'bak_install_dismissed';

  window.addEventListener('beforeinstallprompt', function (e) {
    if (isNative) return;
    e.preventDefault();
    deferredPrompt = e;
    if (banner && !localStorage.getItem(DISMISS_KEY) && !isStandalone) {
      setTimeout(function () { banner.classList.add('is-open'); }, 3500);
    }
  });

  if (btnBtn) {
    btnBtn.addEventListener('click', function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function () {
        deferredPrompt = null;
        if (banner) banner.classList.remove('is-open');
      });
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', function () {
      if (banner) banner.classList.remove('is-open');
      try { localStorage.setItem(DISMISS_KEY, '1'); } catch (e) {}
    });
  }

  window.addEventListener('appinstalled', function () {
    if (banner) banner.classList.remove('is-open');
    deferredPrompt = null;
  });

  /* ---------- 12. حالة الاتصال ---------- */
  var offlineBar = $('#offlineBar');

  function syncOnlineState() {
    if (!offlineBar) return;
    offlineBar.classList.toggle('is-open', !navigator.onLine);
  }
  window.addEventListener('online',  syncOnlineState);
  window.addEventListener('offline', syncOnlineState);
  syncOnlineState();

})();
