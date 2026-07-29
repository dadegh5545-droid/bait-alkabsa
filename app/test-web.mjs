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

console.log('\n— عرض القائمة —');
const cards = $$('#menuGrid .dish');
check(`رُسمت ${cards.length} بطاقة طبق`, cards.length === window.MENU.length, `(المتوقع ${window.MENU.length})`);
check('كل بطاقة فيها زر إضافة', $$('#menuGrid [data-add]').length === cards.length);
check('كل بطاقة فيها زر مفضّلة', $$('#menuGrid [data-fav]').length === cards.length);
check('عدّاد الأطباق في الواجهة يقرأ من البيانات',
  $('[data-count-source="menu"]').getAttribute('data-count') === String(window.MENU.length));
check('رُسمت أزرار التصنيفات', $$('#menuFilters .chip').length === window.MENU_CATEGORIES.length);

console.log('\n— التصفية —');
const riceChip = $('#menuFilters [data-filter="rice"]');
click(riceChip);
const riceCount = window.MENU.filter(d => d.cat === 'rice').length;
check(`تصنيف الأرز يعرض ${riceCount} أطباق`, $$('#menuGrid .dish').length === riceCount,
  `(ظهر ${$$('#menuGrid .dish').length})`);
click($('#menuFilters [data-filter="all"]'));
check('العودة للكل تعرض الجميع', $$('#menuGrid .dish').length === window.MENU.length);

console.log('\n— البحث —');
const search = $('#menuSearch');
search.value = 'كبسة';
search.dispatchEvent(new window.Event('input', { bubbles: true }));
const found = $$('#menuGrid .dish').length;
check('البحث عن «كبسة» يرجّع نتائج', found > 0 && found < window.MENU.length, `(${found} نتيجة)`);
search.value = 'زززز';
search.dispatchEvent(new window.Event('input', { bubbles: true }));
check('بحث بلا نتائج يُظهر الرسالة', $('#menuEmpty').hidden === false && $$('#menuGrid .dish').length === 0);
click($('#menuSearchClear'));
check('زر المسح يعيد كل الأطباق', $$('#menuGrid .dish').length === window.MENU.length);

console.log('\n— المفضّلة —');
click($('#menuGrid [data-fav="kunafa"]'));
check('حُفظت المفضّلة محلياً', JSON.parse(window.localStorage.getItem('bak_favorites')).includes('kunafa'));
click($('#menuFilters [data-filter="fav"]'));
check('تبويب المفضّلة يعرض طبقاً واحداً', $$('#menuGrid .dish').length === 1);
click($('#menuFilters [data-filter="all"]'));

console.log('\n— نافذة الطبق —');
click($('#menuGrid [data-add="kabsa-lamb"]'));
check('فُتحت النافذة', $('#dishModal').hidden === false);
check('العنوان صحيح', $('#dmTitle').textContent === 'كبسة لحم حاشي');
check('ظهرت خيارات الحجم', $('#dmSizes').hidden === false);
check('ظهرت الإضافات', $('#dmAddons').hidden === false);
check('الإجمالي الابتدائي ٨٥ ر.س', $('#dmTotal').textContent === '٨٥ ر.س', `(${$('#dmTotal').textContent})`);

/* اختيار الحجم العائلي (+145) وإضافة لحم (+30) وكميّة ٢ → (85+145+30)*2 = 520 */
const familyRadio = $('#dmSizesList input[value="family"]');
familyRadio.checked = true;
familyRadio.dispatchEvent(new window.Event('change', { bubbles: true }));
const meatBox = $('#dmAddonsList input[value="extra-meat"]');
meatBox.checked = true;
meatBox.dispatchEvent(new window.Event('change', { bubbles: true }));
click($('#dmPlus'));
check('حساب السعر مع الحجم والإضافة والكمية = ٥٢٠', $('#dmTotal').textContent === '٥٢٠ ر.س', `(${$('#dmTotal').textContent})`);

$('#dmNote').value = 'بدون بصل';
click($('#dmAdd'));
check('أُغلقت النافذة بعد الإضافة', $('#dishModal').classList.contains('is-open') === false);

console.log('\n— السلة —');
check('شارة السلة تعرض ٢', $('#cartCount').textContent === '٢' && !$('#cartCount').hidden);
check('حُفظت السلة محلياً', JSON.parse(window.localStorage.getItem('bak_cart')).length === 1);

click($('#cartBtn'));
check('انفتحت السلة', $('#cartDrawer').hidden === false);
check('السلة غير فارغة', $('#cartEmpty').hidden === true);
check('المجموع الفرعي ٥٢٠', $('#sumSubtotal').textContent === '٥٢٠ ر.س', `(${$('#sumSubtotal').textContent})`);
check('الملاحظة ظهرت في السطر', $('#cartItems').textContent.includes('بدون بصل'));

/* وضع التوصيل — المجموع ٥٢٠ ≥ ٢٠٠ فالتوصيل مجاني */
click($('.mode-btn[data-mode="delivery"]'));
check('ظهر حقل العنوان', $('#addressField').hidden === false);
check('التوصيل مجاني فوق ٢٠٠', $('#sumDelivery').textContent === 'مجاناً', `(${$('#sumDelivery').textContent})`);
check('الإجمالي بقي ٥٢٠', $('#sumTotal').textContent === '٥٢٠ ر.س');

/* إرسال بدون عنوان يجب أن يُرفض */
click($('#cartSubmit'));
check('رفض الإرسال بلا عنوان', opened.length === 0);
check('ظهر تنبيه خطأ', $('#toasts').textContent.includes('عنوان التوصيل'));

$('#cartAddress').value = 'حي النرجس، شارع الأمير';
click($('#cartSubmit'));
check('فُتح رابط واتساب', opened.length === 1 && opened[0].startsWith('https://wa.me/966500000000?text='));
const msg = decodeURIComponent(opened[0].split('text=')[1]);
check('الرسالة تحوي الطبق والحجم والإضافة', msg.includes('كبسة لحم حاشي') && msg.includes('صحن عائلي') && msg.includes('زيادة لحم'));
check('الرسالة تحوي العنوان', msg.includes('حي النرجس'));

/* تقليل الكمية */
click($('#cartItems [data-qty="0"][data-delta="-1"]'));
check('إنقاص الكمية يحدّث المجموع', $('#sumSubtotal').textContent === '٢٦٠ ر.س', `(${$('#sumSubtotal').textContent})`);

/* أقل مبلغ للطلب — نفرّغ ونضيف شاي بـ ٨ */
click($('#cartClear'));
check('تفريغ السلة يُظهر الحالة الفارغة', $('#cartEmpty').hidden === false);

console.log('\n— نموذج الحجز —');
opened.length = 0;
$('#rName').value = 'سع';
$('#rPhone').value = '123';
click($('#reserveForm button[type="submit"]'));
check('رفض الاسم القصير', $('#rName').closest('.field').classList.contains('has-error'));
check('رفض رقم الجوال الخاطئ', $('#rPhone').closest('.field').classList.contains('has-error'));
check('لم يُرسل شيء', opened.length === 0);

$('#rName').value = 'سعد العنزي';
$('#rPhone').value = '0551234567';
$('#rName').dispatchEvent(new window.Event('input', { bubbles: true }));
$('#rPhone').dispatchEvent(new window.Event('input', { bubbles: true }));
click($('#reserveForm button[type="submit"]'));
check('قبل البيانات الصحيحة وفتح واتساب', opened.length === 1 && opened[0].includes('wa.me'));

console.log(`\n${'='.repeat(46)}`);
console.log(`النتيجة:  ✓ ${pass} ناجح   ✗ ${fail} فاشل`);
console.log('='.repeat(46));
process.exit(fail ? 1 : 0);
