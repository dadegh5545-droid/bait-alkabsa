/* ==========================================================================
   بيت الكبسة — اختبار تكاملي لواجهة الموقع
   يشغّل index.html داخل jsdom ويتحقق من القائمة والبحث والسلة والحجز.
   التشغيل:  cd app && npm test
   ========================================================================== */
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(`${ROOT}/index.html`, 'utf8');

const dom = new JSDOM(html, {
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  url: 'http://localhost/'
});
const { window } = dom;

/* شِمّات لما لا يدعمه jsdom */
window.IntersectionObserver = class {
  constructor(cb) { this.cb = cb; }
  observe(el) { el.classList.add('is-in'); }
  unobserve() {}
  disconnect() {}
};
window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 0);
window.scrollTo = () => {};
const opened = [];
window.open = (url) => { opened.push(url); return null; };

/* تحميل السكربتات بالترتيب */
window.eval(readFileSync(`${ROOT}/js/menu-data.js`, 'utf8'));
window.eval(readFileSync(`${ROOT}/js/gallery-data.js`, 'utf8'));
window.eval(readFileSync(`${ROOT}/js/main.js`, 'utf8'));

const doc = window.document;
const $ = (s) => doc.querySelector(s);
const $$ = (s) => Array.from(doc.querySelectorAll(s));
const click = (el) => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

let pass = 0, fail = 0;
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${extra}`); }
}

/* القيم المتوقّعة تُحسب من البيانات نفسها، فلا ينكسر الاختبار
   كلّما تغيّر اسم طبق أو سعره في js/menu-data.js */
const ar = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d]);
const qr = (n) => `${ar(n)} ر.ق`;

/* الأطباق المخفيّة لا تُعرض، والتصنيف الفارغ لا يُرسم زرّاً — فكل
   المتوقّعات تُشتقّ من المرئي، لا من طول MENU كلّه */
const VISIBLE = window.MENU.filter((d) => !d.hidden);
const LIVE_CATS = window.MENU_CATEGORIES.filter((c) =>
  c.id === 'all' || c.id === 'fav' || VISIBLE.some((d) => d.cat === c.id));

/* تصنيف مرئي فيه أكثر من طبق — تُختبر عليه التصفية */
const TEST_CAT = LIVE_CATS.find((c) =>
  c.id !== 'all' && c.id !== 'fav' && VISIBLE.filter((d) => d.cat === c.id).length > 1);
const TEST_CAT_COUNT = VISIBLE.filter((d) => d.cat === TEST_CAT.id).length;

/* سعر الحجم: price كامل مكتوب فيه، أو delta يُضاف للسعر الأساسي */
const sizeFull = (d, s) => (s.price != null ? s.price : d.price + (s.delta || 0));

/* طبق مرئي له أحجام وإضافات — تُختبر عليه النافذة وحساب السعر */
const SUBJECT   = VISIBLE.find((d) => d.sizes && d.sizes.length && d.addons && d.addons.length);
const SUB_SIZE  = SUBJECT.sizes.reduce((a, b) =>
  (sizeFull(SUBJECT, b) > sizeFull(SUBJECT, a) ? b : a));
const SUB_ADDON = SUBJECT.addons.find((a) => a.price > 0);
const SUB_FULL  = sizeFull(SUBJECT, SUB_SIZE) + SUB_ADDON.price;

/* طبق مرئي آخر — يُختبر عليه زرّ المفضّلة */
const FAV_DISH = VISIBLE.find((d) => d.id !== SUBJECT.id);

/* كلمة من اسم الطبق لا ترد في اسم غيره ولا وصفه — يُختبر عليها البحث.
   البحث يمسح الاسم والوصف والشارة معاً، فكلمة مثل «لقن» ترد في وصف
   الصالونة أيضاً ولا تصلح للتمييز. */
const searchHay = (d) => `${d.name} ${d.desc || ''} ${d.tag || ''}`.toLowerCase();
const SEARCH_WORD =
  SUBJECT.name.split(/\s+/).filter((w) => w.length > 2).find((w) =>
    VISIBLE.filter((d) => searchHay(d).includes(w.toLowerCase())).length === 1
  ) || SUBJECT.name.split(/\s+/)[0];

const ZONES = window.ORDER_CONFIG.deliveryZones;

console.log('\n— عرض القائمة —');
const cards = $$('#menuGrid .dish');
check(`رُسمت ${cards.length} بطاقة طبق`, cards.length === VISIBLE.length, `(المتوقع ${VISIBLE.length})`);
check('كل بطاقة فيها زر إضافة', $$('#menuGrid [data-add]').length === cards.length);
check('كل بطاقة فيها زر مفضّلة', $$('#menuGrid [data-fav]').length === cards.length);
check('عدّاد الأطباق في الواجهة يقرأ من البيانات',
  $('[data-count-source="menu"]').getAttribute('data-count') === String(VISIBLE.length));
check('لا بطاقة لطبق مخفيّ',
  window.MENU.filter((d) => d.hidden).every((d) => !$(`#menuGrid .dish[data-id="${d.id}"]`)));
check('أزرار التصنيفات تستثني الفارغ', $$('#menuFilters .chip').length === LIVE_CATS.length,
  `(ظهر ${$$('#menuFilters .chip').length} والمتوقع ${LIVE_CATS.length})`);

console.log('\n— التصفية —');
click($(`#menuFilters [data-filter="${TEST_CAT.id}"]`));
check(`تصنيف «${TEST_CAT.label}» يعرض ${TEST_CAT_COUNT} أطباق`,
  $$('#menuGrid .dish').length === TEST_CAT_COUNT, `(ظهر ${$$('#menuGrid .dish').length})`);
click($('#menuFilters [data-filter="all"]'));
check('العودة للكل تعرض الجميع', $$('#menuGrid .dish').length === VISIBLE.length);

console.log('\n— البحث —');
const search = $('#menuSearch');
search.value = SEARCH_WORD;
search.dispatchEvent(new window.Event('input', { bubbles: true }));
const found = $$('#menuGrid .dish').length;
check(`البحث عن «${SEARCH_WORD}» يرجّع نتائج`, found > 0 && found < VISIBLE.length, `(${found} نتيجة)`);
search.value = 'زززز';
search.dispatchEvent(new window.Event('input', { bubbles: true }));
check('بحث بلا نتائج يُظهر الرسالة', $('#menuEmpty').hidden === false && $$('#menuGrid .dish').length === 0);
click($('#menuSearchClear'));
check('زر المسح يعيد كل الأطباق', $$('#menuGrid .dish').length === VISIBLE.length);

console.log('\n— المفضّلة —');
click($(`#menuGrid [data-fav="${FAV_DISH.id}"]`));
check('حُفظت المفضّلة محلياً', JSON.parse(window.localStorage.getItem('bak_favorites')).includes(FAV_DISH.id));
click($('#menuFilters [data-filter="fav"]'));
check('تبويب المفضّلة يعرض طبقاً واحداً', $$('#menuGrid .dish').length === 1);
click($('#menuFilters [data-filter="all"]'));

console.log('\n— نافذة الطبق —');
click($(`#menuGrid [data-add="${SUBJECT.id}"]`));
check('فُتحت النافذة', $('#dishModal').hidden === false);
check('العنوان صحيح', $('#dmTitle').textContent === SUBJECT.name);
check('ظهرت خيارات الحجم', $('#dmSizes').hidden === false);
check('ظهرت الإضافات', $('#dmAddons').hidden === false);
check(`الإجمالي الابتدائي ${qr(SUBJECT.price)}`, $('#dmTotal').textContent === qr(SUBJECT.price), `(${$('#dmTotal').textContent})`);
check('خيار الحجم يعرض السعر الكامل لا الفرق',
  $('#dmSizesList .opt-price').textContent === qr(SUBJECT.price),
  `(${$('#dmSizesList .opt-price').textContent})`);

/* الاختيارات بلا سعر — نوع الأرز: نوعان على الأكثر */
if (SUBJECT.picks) {
  const PICKS = SUBJECT.picks;
  check('ظهرت مجموعة الاختيارات', $('#dmPicks').hidden === false);
  check(`رُسم ${PICKS.options.length} خياراً`, $$('#dmPicksList input').length === PICKS.options.length);
  check('عنوان المجموعة من البيانات', $('#dmPicksLabel').textContent === PICKS.label);
  check('التنبيه يذكر الحدّ الأقصى', $('#dmPicksNote').textContent.includes(ar(PICKS.max)));

  /* الاختبار يتكيّف مع أي حدّ: أرز اللقن نوعان، وأرز اللحم نوع واحد */
  const picks = $$('#dmPicksList input');
  const fire  = (el) => el.dispatchEvent(new window.Event('change', { bubbles: true }));

  picks[0].checked = true;
  fire(picks[0]);
  if (PICKS.max > 1) {
    check('قبل بلوغ الحدّ لا يُقفل خيار', picks.every((p) => !p.disabled));
    for (let i = 1; i < PICKS.max; i++) { picks[i].checked = true; fire(picks[i]); }
  }

  check('بلوغ الحدّ يقفل غير المختار',
    picks.filter((p) => p.disabled).length === PICKS.options.length - PICKS.max,
    `(مقفل ${picks.filter((p) => p.disabled).length} والمتوقع ${PICKS.options.length - PICKS.max})`);
  check('المختار يبقى قابلاً للإلغاء',
    picks.slice(0, PICKS.max).every((p) => !p.disabled));

  const last = picks[PICKS.max - 1];
  last.checked = false;
  fire(last);
  check('إلغاء اختيار يفتح البقيّة', picks.every((p) => !p.disabled));

  /* نعيد الاختيار: الأرز الإلزامي يمنع الإضافة للسلة بدونه */
  if (!PICKS.optional) { last.checked = true; fire(last); }

  check('الاختيار لا يغيّر السعر', $('#dmTotal').textContent === qr(SUBJECT.price));
}

/* أغلى حجم + إضافة مدفوعة + كميّة ٢ */
const sizeRadio = $(`#dmSizesList input[value="${SUB_SIZE.id}"]`);
sizeRadio.checked = true;
sizeRadio.dispatchEvent(new window.Event('change', { bubbles: true }));
/* الإضافة لها عدّادها: واحدة أولاً، ثم اثنتان — والثمن يتضاعف
   للإضافة وحدها لا للطبق كلّه، وهذا لبّ ما كان معطوباً */
const addonRow  = $(`#dmAddonsList [data-addon="${SUB_ADDON.id}"]`);
const addonPlus = $('[data-addon-step="1"]', addonRow);
const SIZE_ONLY = sizeFull(SUBJECT, SUB_SIZE);

click(addonPlus);
check('عدّاد الإضافة يبدأ من صفر ويرتفع بالضغط',
  $('.addon-count', addonRow).textContent === '١');
check(`إضافة واحدة تزيد ثمنها وحده = ${ar(SIZE_ONLY + SUB_ADDON.price)}`,
  $('#dmTotal').textContent === qr(SIZE_ONLY + SUB_ADDON.price), `(${$('#dmTotal').textContent})`);

click(addonPlus);
check(`إضافتان تزيدان ثمن الإضافة مرّتين لا ثمن الطبق = ${ar(SIZE_ONLY + SUB_ADDON.price * 2)}`,
  $('#dmTotal').textContent === qr(SIZE_ONLY + SUB_ADDON.price * 2), `(${$('#dmTotal').textContent})`);

click($('[data-addon-step="-1"]', addonRow));
check('الإنقاص يرجع العدد واحدة', $('.addon-count', addonRow).textContent === '١');
check('ولا ينزل العدد تحت الصفر',
  (click($('[data-addon-step="-1"]', addonRow)),
   click($('[data-addon-step="-1"]', addonRow)),
   $('.addon-count', addonRow).textContent === '٠'));
check('صفر إضافات يعيد سعر الطبق وحده',
  $('#dmTotal').textContent === qr(SIZE_ONLY), `(${$('#dmTotal').textContent})`);

click(addonPlus);
check('الملخّص يقول ماذا اختار الزبون',
  $('#dmSummary').textContent.includes(SUBJECT.name) &&
  $('#dmSummary').textContent.includes(SUB_ADDON.label));

click($('#dmPlus'));
check(`حساب السعر مع الحجم والإضافة والكمية = ${ar(SUB_FULL * 2)}`,
  $('#dmTotal').textContent === qr(SUB_FULL * 2), `(${$('#dmTotal').textContent})`);
check('الملخّص يذكر عدد الأطباق حين يزيد عن واحد',
  $('#dmSummary').textContent.includes('×٢'));

$('#dmNote').value = 'بدون بصل';
/* الضغطة على السعر داخل الزر — لا على الزر نفسه — هي ما يفعله الزبون
   بإصبعه غالباً، وكانت تسقط بلا أثر فتبقى السلة فارغة */
click($('#dmTotal'));
check('الضغط على السعر داخل الزر يضيف للسلة',
  JSON.parse(window.localStorage.getItem('bak_cart') || '[]').length === 1);
check('أُغلقت النافذة بعد الإضافة', $('#dishModal').classList.contains('is-open') === false);

console.log('\n— السلة —');
check('شارة السلة تعرض ٢', $('#cartCount').textContent === '٢' && !$('#cartCount').hidden);
check('حُفظت السلة محلياً', JSON.parse(window.localStorage.getItem('bak_cart')).length === 1);

click($('#cartBtn'));
check('انفتحت السلة', $('#cartDrawer').hidden === false);
check('السلة غير فارغة', $('#cartEmpty').hidden === true);
check(`المجموع الفرعي ${ar(SUB_FULL * 2)}`, $('#sumSubtotal').textContent === qr(SUB_FULL * 2), `(${$('#sumSubtotal').textContent})`);
check('الملاحظة ظهرت في السطر', $('#cartItems').textContent.includes('بدون بصل'));

/* الزبون يرى في سلته اسم كل إضافة وعددها وثمن عددها */
check('الإضافة مكتوبة في السلة باسمها',
  $('#cartItems .ci-add-name').textContent === SUB_ADDON.label);
check('عدد الإضافة مكتوب بجانبها', $('#cartItems .ci-add-qty').textContent === '×١');
check('ثمن الإضافة مكتوب بعددها',
  $('#cartItems .ci-add-price').textContent === qr(SUB_ADDON.price));
check('كميّة الإضافة محفوظة مع السلة',
  JSON.parse(window.localStorage.getItem('bak_cart'))[0].addonQty[SUB_ADDON.id] === 1);

/* وضع التوصيل — التوصيل مدفوع دائماً، فالرسم يُضاف مهما بلغ المجموع */
click($('.mode-btn[data-mode="delivery"]'));
check('ظهر حقل العنوان', $('#addressField').hidden === false);
check(`رسم التوصيل ${qr(ZONES[0].fee)} ولا مجانية`,
  $('#sumDelivery').textContent === qr(ZONES[0].fee), `(${$('#sumDelivery').textContent})`);
check('الإجمالي يضمّ رسم التوصيل',
  $('#sumTotal').textContent === qr(SUB_FULL * 2 + ZONES[0].fee), `(${$('#sumTotal').textContent})`);
check('لا تنبيه توصيل مجاني', !$('#cartWarn').textContent.includes('مجاناً'));

/* مناطق التوصيل — لا فروع فالاستلام مخفيّ، والمنطقة تحدّد الرسم */
console.log('\n— مناطق التوصيل —');
check('شريط طريقة الاستلام مخفيّ بلا فروع', $('.cart-mode').hidden === true);
check('ظهر حقل المنطقة', $('#zoneField').hidden === false);
check(`رُسمت ${ZONES.length} منطقة`, $$('#cartZone option').length === ZONES.length);
check('المنطقة الأولى تعرض رسمها', $$('#cartZone option')[0].textContent.includes(ar(ZONES[0].fee)));

const zoneSel = $('#cartZone');
zoneSel.value = 'outside';
zoneSel.dispatchEvent(new window.Event('change', { bubbles: true }));
check(`خارج الدوحة ${qr(ZONES[1].fee)} ولا مجانية`,
  $('#sumDelivery').textContent === qr(ZONES[1].fee), `(${$('#sumDelivery').textContent})`);
check('الإجمالي يضمّ رسم خارج الدوحة',
  $('#sumTotal').textContent === qr(SUB_FULL * 2 + ZONES[1].fee), `(${$('#sumTotal').textContent})`);

zoneSel.value = 'doha';
zoneSel.dispatchEvent(new window.Event('change', { bubbles: true }));
check('الرجوع لداخل الدوحة يعيد رسمها',
  $('#sumDelivery').textContent === qr(ZONES[0].fee), `(${$('#sumDelivery').textContent})`);

/* ===== بيانات الزبون إلزامية قبل الإرسال ===== */
click($('#cartSubmit'));
check('رفض الإرسال ببيانات ناقصة', opened.length === 0);
check('ظهر تنبيه يطلب إكمال البيانات', $('#toasts').textContent.includes('أكمل بيانات التوصيل'));
check('الاسم مُعلَّم بالخطأ', $('.cart-err[data-for="cartName"]').textContent.length > 0);
check('الجوال مُعلَّم بالخطأ', $('.cart-err[data-for="cartPhone"]').textContent.length > 0);
check('الموقع مُعلَّم بالخطأ', $('.cart-err[data-for="cartAddress"]').textContent.length > 0);
check('رقم الفيلا مُعلَّم بالخطأ', $('.cart-err[data-for="cartUnit"]').textContent.length > 0);

/* رقم جوال ناقص يُرفض وحده */
$('#cartName').value = 'سعد العنزي';
$('#cartPhone').value = '123';
click($('#cartSubmit'));
check('رقم الجوال الناقص مرفوض',
  opened.length === 0 && $('.cart-err[data-for="cartPhone"]').textContent.includes('غير مكتمل'));

/* موعد قريب جداً يُرفض — المطبخ يحتاج مهلة */
$('#cartPhone').value = '55921554';
$('#cartAddress').value = 'حي النرجس، شارع الأمير';
$('#cartUnit').value = 'فيلا ١٢';
const soon = new Date();
soon.setHours(soon.getHours() + 1);
const pad = (n) => String(n).padStart(2, '0');
$('#cartDate').value = `${soon.getFullYear()}-${pad(soon.getMonth() + 1)}-${pad(soon.getDate())}`;
$('#cartWhen').value = `${pad(soon.getHours())}:${pad(soon.getMinutes())}`;
click($('#cartSubmit'));
check('موعد بعد ساعة مرفوض — يُفضّل الطلب قبل يوم',
  opened.length === 0 && $('.cart-err[data-for="cartWhen"]').textContent.length > 0,
  `(${$('.cart-err[data-for="cartWhen"]').textContent})`);

/* موعد بعد غدٍ مقبول */
const later = new Date();
later.setDate(later.getDate() + 2);
$('#cartDate').value = `${later.getFullYear()}-${pad(later.getMonth() + 1)}-${pad(later.getDate())}`;
$('#cartWhen').value = '20:00';
click($('#cartSubmit'));
check('فُتح رابط واتساب', opened.length === 1 && opened[0].startsWith('https://wa.me/97455921554?text='));
const msg = decodeURIComponent(opened[0].split('text=')[1]);
check('الرسالة تحوي الطبق والحجم والإضافة',
  msg.includes(SUBJECT.name) && msg.includes(SUB_SIZE.label) && msg.includes(SUB_ADDON.label));
if (SUBJECT.picks) {
  check('الرسالة تحوي الاختيار (نوع الأرز)', msg.includes(SUBJECT.picks.options[0].label),
    `(لم يظهر ${SUBJECT.picks.options[0].label})`);
}
check('الرسالة تحوي اسم الزبون', msg.includes('سعد العنزي'));
check('الرسالة تحوي جواله', msg.includes('55921554'));
check('الرسالة تحوي رقم الفيلا', msg.includes('فيلا ١٢'));
check('الرسالة تحوي وقت التسليم', msg.includes('وقت التسليم'));
check('الرسالة تميّز الغداء من العشاء', /عشاء|غداء/.test(msg));
check('بيانات الزبون حُفظت لطلبه القادم',
  (JSON.parse(window.localStorage.getItem('bak_customer') || '{}')).name === 'سعد العنزي');
check('الرسالة تحوي العنوان', msg.includes('حي النرجس'));
check('الرسالة تحوي منطقة التوصيل', msg.includes(ZONES[0].label));

/* تقليل الكمية */
click($('#cartItems [data-qty="0"][data-delta="-1"]'));
check('إنقاص الكمية يحدّث المجموع', $('#sumSubtotal').textContent === qr(SUB_FULL), `(${$('#sumSubtotal').textContent})`);

/* أقل مبلغ للطلب — نفرّغ ونضيف شاي بـ ٨ */
click($('#cartClear'));
check('تفريغ السلة يُظهر الحالة الفارغة', $('#cartEmpty').hidden === false);

/* ===== الجانب لا يُطلب وحده ===== */
const SIDE = VISIBLE.find((d) => d.needsMain);
const MAIN = VISIBLE.find((d) => d.main);
if (SIDE && MAIN) {
  console.log('\n— الجوانب تحتاج طبقاً رئيسياً —');
  const cartOf = () => JSON.parse(window.localStorage.getItem('bak_cart') || '[]');

  click($(`#menuGrid [data-add="${SIDE.id}"]`));
  click($('#dmAdd'));
  check('الجانب وحده مرفوض', cartOf().length === 0, `(${cartOf().length} سطر)`);
  check('سبب الرفض مكتوب للزبون', $('#toasts').textContent.includes('أضف الطبق الرئيسي'));
  check('النافذة تبقى مفتوحة بعد الرفض', $('#dishModal').hidden === false);
  click($('#dishModal .modal-close'));

  /* الرئيسي أولاً ثم الجانب */
  click($(`#menuGrid [data-add="${MAIN.id}"]`));
  if (MAIN.picks && !MAIN.picks.optional) {
    const p = $('#dmPicksList input');
    p.checked = true;
    p.dispatchEvent(new window.Event('change', { bubbles: true }));
  }
  click($('#dmAdd'));
  check('الرئيسي يُقبل وحده', cartOf().length === 1, `(${cartOf().length} سطر)`);

  click($(`#menuGrid [data-add="${SIDE.id}"]`));
  click($('#dmAdd'));
  check('الجانب يُقبل بعد الرئيسي', cartOf().length === 2, `(${cartOf().length} سطر)`);

  /* حذف الرئيسي يترك سلة جوانب فقط — تُرفض عند الإرسال لا بالحذف الصامت */
  click($('#cartBtn'));
  const mainRow = cartOf().findIndex((it) => it.dishId === MAIN.id);
  const before = opened.length;
  click($(`#cartItems [data-qty="${mainRow}"][data-delta="-1"]`));
  check('حذف الرئيسي يُبقي الجانب بلا حذف صامت', cartOf().length === 1);
  $('#cartAddress').value = 'الوكرة، شارع المطاعم';
  click($('#cartSubmit'));
  check('الإرسال بجوانب فقط مرفوض', opened.length === before);
  check('سبب رفض الإرسال مكتوب', $('#toasts').textContent.includes('الجوانب تُطلب'));

  click($('#cartClear'));
}

/* واجهة المجلس: نقش السدو وإطار السفرة */
console.log('\n— واجهة المجلس —');
check('شريطا السدو مرسومان', $$('.hero .sadu-band').length === 2);
check('إطار السفرة موجود', !!$('#heroPhoto'));
check('بلا صورة يبقى الإطار النائب', !!$('#heroPhoto .photo-emoji'));
check('السفرة تنتظر ملفاً محدّداً',
  $('#heroPhoto').getAttribute('data-src') === 'images/majlis.jpg');
check('عدّاد الأطباق في الواجهة يقرأ الظاهر فعلاً',
  $('[data-count-source="menu"]').getAttribute('data-count') === String(VISIBLE.length));

/* فيديو الطبخ: ملف اختياري. ما لم يجهز الملف تبقى الواجهة كما هي،
   فلا مستطيل أسود ولا حجاب يغمق العنوان بلا سبب. */
const heroVideo = $('#heroVideo');
check('مكان فيديو الطبخ موجود في الواجهة', !!heroVideo);
check('الفيديو ينتظر ملفاً محدّداً',
  heroVideo.getAttribute('src') === 'images/hero.mp4' || heroVideo.src.endsWith('images/hero.mp4'),
  `(${heroVideo.getAttribute('src')})`);
check('الفيديو صامت ومكرّر ولا يخرج من الصفحة',
  heroVideo.hasAttribute('muted') && heroVideo.hasAttribute('loop') &&
  heroVideo.hasAttribute('playsinline'));
check('الفيديو لا يظهر قبل أن يجهز', !$('.hero').classList.contains('has-video'));
check('الفيديو خارج ترتيب لوحة المفاتيح', heroVideo.getAttribute('tabindex') === '-1');

/* المشروع منزلي: لا حجز طاولات ولا فروع */
console.log('\n— لا حجز ولا فروع —');
check('قسم الحجز أُزيل', $('#reserve') === null && $('#reserveForm') === null);
check('لا رابط يشير للحجز', $$('a[href="#reserve"]').length === 0);
check('شريط طريقة الاستلام مخفيّ', $('.cart-mode').hidden === true);
check('اختيار الفرع مخفيّ', $('#branchField').hidden === true);

console.log('\n— معرض الصور —');
const cells = $$('#galleryGrid .gal-item');
check(`رُسمت ${cells.length} خلية معرض`, cells.length === window.GALLERY.length,
  `(المتوقع ${window.GALLERY.length})`);
check('كل خلية زر يعمل بلوحة المفاتيح', cells.every(c => c.tagName === 'BUTTON'));
check('كل خلية لها وصف لقارئ الشاشة', cells.every(c => c.getAttribute('aria-label').includes('تكبير')));
check('كل خلية فيها إطار نائب برمز تعبيري', $$('#galleryGrid .photo-emoji').length === cells.length);
check('صور المعرض مُحمَّلة بالتأجيل',
  $$('#galleryGrid .photo-img').every(i => i.getAttribute('loading') === 'lazy'));
check('صورة «عن المطعم» لها بديل نصّي',
  $('.about-media .photo-img').getAttribute('alt').length > 5);

console.log('\n— العرض المكبّر —');
/* ننتظر مؤقّتات التلاشي المعلّقة من الاختبارات السابقة قبل قياس الحالة */
const tick = (ms = 340) => new Promise((r) => setTimeout(r, ms));
await tick();

click(cells[0]);
await tick(0);
check('انفتح العرض المكبّر', $('#lightbox').hidden === false && $('#lightbox').classList.contains('is-open'));
check('قُفل تمرير الصفحة', doc.body.classList.contains('modal-open'));
check('العدّاد يعرض ١ / ٥', $('#lbCounter').textContent === '١ / ٥', `(${$('#lbCounter').textContent})`);
check('التعليق من بيانات الصورة', $('#lbCaption').textContent === window.GALLERY[0].caption);
check('صورة العرض المكبّر بلا تأجيل تحميل',
  $('#lbStage .photo-img').getAttribute('loading') === 'eager');

click($('[data-lb="next"]'));
check('زر التالي ينتقل للصورة الثانية', $('#lbCaption').textContent === window.GALLERY[1].caption);
click($('[data-lb="prev"]'));
check('زر السابق يرجع للأولى', $('#lbCounter').textContent === '١ / ٥');

/* في الاتجاه العربي: السهم الأيسر = التالي، والأيمن = السابق */
doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
check('السهم الأيسر يعرض التالي', $('#lbCounter').textContent === '٢ / ٥');
doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
check('السهم الأيمن يعرض السابق', $('#lbCounter').textContent === '١ / ٥');

/* اللفّ عند الحدود: قبل الأولى تأتي الأخيرة */
click($('[data-lb="prev"]'));
check('التنقّل يلتفّ لآخر صورة', $('#lbCounter').textContent === '٥ / ٥');

doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
await tick();
check('Escape يغلق العرض المكبّر', $('#lightbox').hidden === true);
check('عاد تمرير الصفحة بعد الإغلاق', doc.body.classList.contains('modal-open') === false);

console.log('\n— صور الأطباق —');
check('بلا صور: كل بطاقة تُظهر الرمز التعبيري',
  $$('#menuGrid .dish-media .photo-emoji').length === $$('#menuGrid .dish').length);
check('بلا صور: لا عناصر img في البطاقات', $$('#menuGrid .dish-media .photo-img').length === 0);

/* إضافة مسار صورة لطبق مرئي واحد ثم إعادة الرسم.
   عناصر VISIBLE هي مراجع أطباق MENU نفسها، فالتعديل يصل للبيانات. */
const IMG_DISH = VISIBLE[0];
const NO_IMG_DISH = VISIBLE.find((d) => d.id !== IMG_DISH.id && !d.img);
IMG_DISH.img   = `images/dishes/${IMG_DISH.id}.jpg`;
IMG_DISH.img2x = `images/dishes/${IMG_DISH.id}@2x.jpg`;
search.dispatchEvent(new window.Event('input', { bubbles: true }));
const shot = $(`#menuGrid .dish[data-id="${IMG_DISH.id}"] .photo-img`);
check('حقل img يرسم صورة في البطاقة', !!shot && shot.getAttribute('src') === IMG_DISH.img);
check('حقل img2x يبني srcset', !!shot && shot.getAttribute('srcset').includes('@2x.jpg 2x'));
check('البديل النصّي هو اسم الطبق', !!shot && shot.getAttribute('alt') === IMG_DISH.name);
check('الإطار النائب باقٍ تحت الصورة',
  !!$(`#menuGrid .dish[data-id="${IMG_DISH.id}"] .photo-emoji`));

click($(`#menuGrid [data-add="${IMG_DISH.id}"]`));
check('نافذة الطبق تعرض الصورة', $('#dmPhoto .photo-img').getAttribute('src') === IMG_DISH.img);
click($('#dishModal .modal-close'));

/* طبق بلا صورة: النافذة لا تحتفظ بصورة الطبق السابق */
click($(`#menuGrid [data-add="${NO_IMG_DISH.id}"]`));
check('نافذة طبق بلا صورة تُنظّف الصورة السابقة', $('#dmPhoto .photo-img') === null);
click($('#dishModal .modal-close'));

/* التسمية التلقائية: images/dishes/<معرّف الطبق>.jpg */
delete IMG_DISH.img;
delete IMG_DISH.img2x;
window.IMAGE_CONFIG.autoDishImages = true;
search.dispatchEvent(new window.Event('input', { bubbles: true }));
const auto = $(`#menuGrid .dish[data-id="${NO_IMG_DISH.id}"] .photo-img`);
check('التسمية التلقائية تبني المسار من معرّف الطبق',
  !!auto && auto.getAttribute('src') === `images/dishes/${NO_IMG_DISH.id}.jpg`,
  `(${auto && auto.getAttribute('src')})`);
check('التسمية التلقائية تغطّي كل الأطباق',
  $$('#menuGrid .dish-media .photo-img').length === VISIBLE.length);
window.IMAGE_CONFIG.autoDishImages = false;

console.log(`\n${'='.repeat(46)}`);
console.log(`النتيجة:  ✓ ${pass} ناجح   ✗ ${fail} فاشل`);
console.log('='.repeat(46));
process.exit(fail ? 1 : 0);
