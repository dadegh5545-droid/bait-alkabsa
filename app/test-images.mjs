/* ==========================================================================
   بيت الكبسة — اختبار فهرس الصور ولوحة إضافة الصور
   يتحقق من: تطبيق images/manifest.json على الواجهة، ومنطق الرفع إلى GitHub
   (بلا شبكة حقيقية — fetch مزيّف يسجّل الطلبات ويردّ بردود معلّبة).
   التشغيل:  cd app && node test-images.mjs
   ========================================================================== */
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(`${ROOT}/index.html`, 'utf8');

let pass = 0, fail = 0;
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${extra}`); }
}

const tick = (ms = 10) => new Promise((r) => setTimeout(r, ms));

/* بيئة jsdom بنفس شِمّات اختبار الواجهة */
function makeWindow({ fetchStub, url = 'http://localhost/' } = {}) {
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url });
  const { window } = dom;

  window.IntersectionObserver = class {
    constructor(cb) { this.cb = cb; }
    observe(el) { el.classList.add('is-in'); }
    unobserve() {}
    disconnect() {}
  };
  window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
  window.requestAnimationFrame = (cb) => setTimeout(() => cb(0), 0);
  window.scrollTo = () => {};
  window.open = () => null;
  if (fetchStub) window.fetch = fetchStub;

  window.eval(readFileSync(`${ROOT}/js/menu-data.js`, 'utf8'));
  window.eval(readFileSync(`${ROOT}/js/gallery-data.js`, 'utf8'));
  return window;
}

/* ==========================================================================
   ١. فهرس الصور على الواجهة
   ========================================================================== */
console.log('\n— فهرس الصور (images/manifest.json) —');

/* الطبق المُفهرس يُختار من المرئي، فلا ينكسر الاختبار حين يُخفى طبق */
const probeWindow = makeWindow({ fetchStub: () => Promise.resolve({ ok: false, status: 404 }) });
const VISIBLE_IDS = probeWindow.MENU.filter((d) => !d.hidden).map((d) => d.id);
const INDEXED_DISH = VISIBLE_IDS[0];
const VISIBLE_COUNT = VISIBLE_IDS.length;

/* خلية المعرض المُفهرسة تُشتقّ كذلك، فلا ينكسر الاختبار حين
   يتغيّر المعرض */
const INDEXED_GAL = probeWindow.GALLERY[1];

const INDEXED = [
  `images/dishes/${INDEXED_DISH}.jpg`,
  INDEXED_GAL.img,
  'images/about.jpg'
];

const asked = [];
const manifestFetch = (url) => {
  asked.push(String(url));
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ files: INDEXED })
  });
};

const w1 = makeWindow({ fetchStub: manifestFetch });
w1.eval(readFileSync(`${ROOT}/js/main.js`, 'utf8'));
await tick();

const doc1 = w1.document;
check('طُلب الفهرس عند التحميل', asked.some((u) => u.includes('images/manifest.json')));

const inIndex = doc1.querySelector(`#menuGrid .dish[data-id="${INDEXED_DISH}"] .photo-img`);
check('طبق مدرج في الفهرس تظهر صورته',
  !!inIndex && inIndex.getAttribute('src') === `images/dishes/${INDEXED_DISH}.jpg`);
check('طبق غير مدرج لا يُطلب له ملف',
  doc1.querySelector(`#menuGrid .dish[data-id="${VISIBLE_IDS[1]}"] .photo-img`) === null);
check('كل البطاقات فيها إطار نائب',
  doc1.querySelectorAll('#menuGrid .dish-media .photo-emoji').length === VISIBLE_COUNT);
check('صور الأطباق المرسومة = المدرجة فقط',
  doc1.querySelectorAll('#menuGrid .dish-media .photo-img').length === 1);

check('خلية معرض مدرجة تظهر صورتها',
  !!doc1.querySelector('#galleryGrid [data-gal="1"] .photo-img'));
check('خلايا المعرض غير المدرجة بلا صور',
  doc1.querySelectorAll('#galleryGrid .photo-img').length === 1);
check('صورة «عن المطعم» ظهرت من الفهرس',
  doc1.querySelector('#aboutPhoto .photo-img').getAttribute('src') === 'images/about.jpg');

console.log('\n— بلا فهرس (إضافة الصور يدوياً) —');
const w2 = makeWindow({
  fetchStub: () => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null) })
});
w2.eval(readFileSync(`${ROOT}/js/main.js`, 'utf8'));
await tick();

const doc2 = w2.document;
check('بلا فهرس: صور المعرض تُطلب كما هي',
  doc2.querySelectorAll('#galleryGrid .photo-img').length === w2.GALLERY.length);
check('بلا فهرس: صورة «عن المطعم» تُطلب',
  !!doc2.querySelector('#aboutPhoto .photo-img'));
check('بلا فهرس: لا صور أطباق (autoDishImages مغلقة)',
  doc2.querySelectorAll('#menuGrid .dish-media .photo-img').length === 0);

/* ==========================================================================
   ٢. لوحة إضافة الصور
   ========================================================================== */
console.log('\n— لوحة الصور: المنطق —');

const REPO = { owner: 'someone', repo: 'bait-alkabsa', branch: 'main' };

/* fetch مزيّف: يسجّل كل طلب ويردّ حسب المسار */
function githubStub(overrides = {}) {
  const calls = [];

  const routes = {
    repo: { permissions: { push: true }, full_name: 'someone/bait-alkabsa' },
    manifest: {
      content: Buffer.from(JSON.stringify({ files: ['images/about.jpg'] }), 'utf8').toString('base64')
    },
    blob: { sha: 'blob-sha-1' },
    ref: { object: { sha: 'head-sha-1' } },
    commitRead: { tree: { sha: 'tree-sha-base' } },
    treeWrite: { sha: 'tree-sha-new' },
    commitWrite: { sha: 'commit-sha-new' },
    patch: { object: { sha: 'commit-sha-new' } },
    ...overrides
  };

  const reply = (body, status = 200) => Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(body === null ? '' : JSON.stringify(body))
  });

  const fetchStub = (url, options = {}) => {
    const method = options.method || 'GET';
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ url: String(url), method, body, headers: options.headers || {} });

    if (routes.forceStatus) return reply({ message: 'Bad credentials' }, routes.forceStatus);

    if (/\/contents\/images\/manifest\.json/.test(url)) {
      return routes.manifest === null ? reply(null, 404) : reply(routes.manifest);
    }
    if (/\/contents\/data\/site\.json/.test(url)) {
      return !routes.site ? reply(null, 404) : reply(routes.site);
    }
    if (/\/git\/blobs$/.test(url)) return reply(routes.blob);
    if (/\/git\/ref\/heads\//.test(url)) return reply(routes.ref);
    if (/\/git\/commits\/[^/]+$/.test(url) && method === 'GET') return reply(routes.commitRead);
    if (/\/git\/trees$/.test(url)) return reply(routes.treeWrite);
    if (/\/git\/commits$/.test(url)) return reply(routes.commitWrite);
    if (/\/git\/refs\/heads\//.test(url) && method === 'PATCH') return reply(routes.patch);
    if (/\/repos\/[^/]+\/[^/]+$/.test(url)) return reply(routes.repo);

    return reply({ message: 'not stubbed: ' + url }, 500);
  };

  return { fetchStub, calls };
}

function makeAdmin(stub) {
  const window = makeWindow({ fetchStub: stub.fetchStub });
  window.eval(readFileSync(`${ROOT}/js/admin.js`, 'utf8'));
  return window;
}

/* --- الدوال النقية --- */
const plain = makeAdmin(githubStub());
const A = plain.BAK_ADMIN;

check('fitSize يصغّر الأطول ويحفظ النسبة',
  JSON.stringify(A.fitSize(2000, 1000, 1000)) === JSON.stringify({ w: 1000, h: 500 }));
check('fitSize لا يكبّر الصور الصغيرة',
  JSON.stringify(A.fitSize(400, 300, 1000)) === JSON.stringify({ w: 400, h: 300 }));
check('fitSize يتعامل مع الصور الطولية',
  JSON.stringify(A.fitSize(1000, 2000, 1000)) === JSON.stringify({ w: 500, h: 1000 }));

const targets = A.targets('dish');
check(`قائمة الأطباق ${plain.MENU.length} هدفاً`, targets.length === plain.MENU.length);
check('مسار صورة الطبق من معرّفه', targets[0].path === 'images/dishes/' + plain.MENU[0].id + '.jpg');
check('هدف «عن المطعم» مسار واحد',
  A.targets('about').length === 1 && A.targets('about')[0].path === 'images/about.jpg');
check('أهداف المعرض من بيانات المعرض',
  A.targets('gallery').length === plain.GALLERY.length &&
  A.targets('gallery')[0].path === plain.GALLERY[0].img);

const text = A.manifestText(['b.jpg', 'a.jpg']);
const parsed = JSON.parse(text);
check('نصّ الفهرس JSON صالح ومرتّب',
  parsed.files[0] === 'a.jpg' && parsed.files[1] === 'b.jpg' && !!parsed.updated);

console.log('\n— لوحة الصور: الاتصال —');
const okStub = githubStub();
const wOk = makeAdmin(okStub);
await wOk.BAK_ADMIN.verify(REPO, 'tok-1');
check('التحقق يحفظ الرمز في هذا الجهاز',
  JSON.parse(wOk.localStorage.getItem('bak_admin_token')) === 'tok-1');
check('التحقق يرسل الرمز في الترويسة',
  okStub.calls[0].headers.Authorization === 'Bearer tok-1');

const roStub = githubStub({ repo: { permissions: { push: false } } });
const wRo = makeAdmin(roStub);
let roError = '';
await wRo.BAK_ADMIN.verify(REPO, 'tok-ro').catch((e) => { roError = e.message; });
check('رمز القراءة فقط يُرفض برسالة واضحة', roError.includes('Contents: Read and write'), `(${roError})`);
check('الرمز المرفوض لا يُحفظ', wRo.localStorage.getItem('bak_admin_token') === null);

const badStub = githubStub({ forceStatus: 401 });
const wBad = makeAdmin(badStub);
let badError = '';
await wBad.BAK_ADMIN.verify(REPO, 'tok-bad').catch((e) => { badError = e.message; });
check('رمز غير صالح → رسالة عربية', badError.includes('الرمز غير صالح'), `(${badError})`);

console.log('\n— لوحة الصور: النشر —');
const pubStub = githubStub();
const wPub = makeAdmin(pubStub);
wPub.BAK_ADMIN.state.token = 'tok-1';
wPub.BAK_ADMIN.state.repo = REPO;

const blob = new wPub.Blob(['fake-jpeg-bytes'], { type: 'image/jpeg' });
const result = await wPub.BAK_ADMIN.commitImage('images/dishes/kabsa-lamb.jpg', blob, 'إضافة صورة: كبسة لحم حاشي');

const blobCall = pubStub.calls.find((c) => /\/git\/blobs$/.test(c.url));
const treeCall = pubStub.calls.find((c) => /\/git\/trees$/.test(c.url));
const commitCall = pubStub.calls.find((c) => /\/git\/commits$/.test(c.url) && c.method === 'POST');
const patchCall = pubStub.calls.find((c) => c.method === 'PATCH');

check('رُفعت الصورة كـ blob بترميز base64',
  !!blobCall && blobCall.body.encoding === 'base64' &&
  Buffer.from(blobCall.body.content, 'base64').toString('utf8') === 'fake-jpeg-bytes');
check('الشجرة تضمّ الصورة والفهرس معاً', !!treeCall && treeCall.body.tree.length === 2);
check('عنصر الصورة يشير إلى الـ blob',
  treeCall.body.tree[0].sha === 'blob-sha-1' && treeCall.body.tree[0].mode === '100644');
check('الشجرة مبنيّة على شجرة الفرع الحالية', treeCall.body.base_tree === 'tree-sha-base');

const newFiles = JSON.parse(treeCall.body.tree[1].content).files;
check('الفهرس الجديد يضمّ الصورة الجديدة', newFiles.includes('images/dishes/kabsa-lamb.jpg'));
check('الفهرس يحفظ الصور السابقة', newFiles.includes('images/about.jpg'));
check('بلا تكرار في الفهرس', new Set(newFiles).size === newFiles.length);

check('commit واحد فقط (بناء واحد في Amplify)',
  pubStub.calls.filter((c) => /\/git\/commits$/.test(c.url) && c.method === 'POST').length === 1);
check('الـ commit ابنٌ لرأس الفرع', commitCall.body.parents[0] === 'head-sha-1');
check('رسالة الـ commit عربية ووصفية', commitCall.body.message.includes('كبسة لحم حاشي'));
check('حُدّث الفرع إلى الـ commit الجديد', !!patchCall && patchCall.body.sha === 'commit-sha-new');
check('النتيجة ترجع الفهرس المحدّث', result.files.includes('images/dishes/kabsa-lamb.jpg'));

/* نشر صورة موجودة مسبقاً في الفهرس — لا تتكرّر */
const reStub = githubStub({
  manifest: {
    content: Buffer.from(JSON.stringify({
      files: ['images/about.jpg', 'images/dishes/kabsa-lamb.jpg']
    }), 'utf8').toString('base64')
  }
});
const wRe = makeAdmin(reStub);
wRe.BAK_ADMIN.state.token = 'tok-1';
wRe.BAK_ADMIN.state.repo = REPO;
await wRe.BAK_ADMIN.commitImage('images/dishes/kabsa-lamb.jpg',
  new wRe.Blob(['x'], { type: 'image/jpeg' }), 'استبدال صورة');

const reTree = reStub.calls.find((c) => /\/git\/trees$/.test(c.url));
const reFiles = JSON.parse(reTree.body.tree[1].content).files;
check('استبدال صورة لا يكرّر مسارها',
  reFiles.filter((f) => f === 'images/dishes/kabsa-lamb.jpg').length === 1);

console.log('\n— لوحة الصور: الإزالة —');
const delStub = githubStub({
  manifest: {
    content: Buffer.from(JSON.stringify({
      files: ['images/about.jpg', 'images/dishes/kabsa-lamb.jpg']
    }), 'utf8').toString('base64')
  }
});
const wDel = makeAdmin(delStub);
wDel.BAK_ADMIN.state.token = 'tok-1';
wDel.BAK_ADMIN.state.repo = REPO;
const delResult = await wDel.BAK_ADMIN.commitImage('images/dishes/kabsa-lamb.jpg', null, 'إزالة صورة');

const delTree = delStub.calls.find((c) => /\/git\/trees$/.test(c.url));
check('الإزالة لا ترفع blob', !delStub.calls.some((c) => /\/git\/blobs$/.test(c.url)));
check('عنصر الشجرة sha=null ليُحذف الملف', delTree.body.tree[0].sha === null);
check('الفهرس بعد الإزالة بلا المسار',
  !JSON.parse(delTree.body.tree[1].content).files.includes('images/dishes/kabsa-lamb.jpg'));
check('الصور الأخرى باقية', delResult.files.includes('images/about.jpg'));

console.log('\n— لوحة الصور: فهرس مفقود —');
const freshStub = githubStub({ manifest: null });
const wFresh = makeAdmin(freshStub);
wFresh.BAK_ADMIN.state.token = 'tok-1';
wFresh.BAK_ADMIN.state.repo = REPO;
check('غياب الفهرس يُقرأ كقائمة فارغة', (await wFresh.BAK_ADMIN.readManifest()).length === 0);

const firstResult = await wFresh.BAK_ADMIN.commitImage('images/about.jpg',
  new wFresh.Blob(['y'], { type: 'image/jpeg' }), 'أول صورة');
check('أول صورة تُنشئ الفهرس', firstResult.files.length === 1 &&
  firstResult.files[0] === 'images/about.jpg');

/* ==========================================================================
   ٣. بيانات الموقع من لوحة التحكّم — data/site.json
   ========================================================================== */
console.log('\n— بيانات الموقع (data/site.json) —');

const SITE = {
  config: {
    whatsapp: '97433334444',
    phone: '97455556666',
    currency: 'ر.ق',
    address: 'الدوحة — شارع الريان',
    hours: 'يومياً ١٠ ص — ١٢ م',
    deliveryFee: 20,
    freeDeliveryOver: 0,
    minOrder: 40,
    branches: [{ id: 'b1', name: 'فرع الريان', area: 'الريان' }]
  },
  dishes: [
    { id: 'kabsa-lamb', name: 'كبسة حاشي', cat: 'rice', price: 99, emoji: '🍛', desc: 'وصف' },
    { id: 'new-dish',   name: 'مجبوس روبيان', cat: 'rice', price: 70, emoji: '🍤', desc: 'وصف' },
    { id: 'tea-x',      name: 'شاي', cat: 'drink', price: 8, emoji: '🫖', desc: 'وصف' },
    { id: 'kunafa',     name: 'كنافة', cat: 'dessert', price: 30, emoji: '🍰', desc: 'وصف', hidden: true }
  ]
};

const siteFetch = (url) => {
  if (String(url).includes('data/site.json')) {
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(SITE) });
  }
  return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null) });
};

const w3 = makeWindow({ fetchStub: siteFetch });
w3.eval(readFileSync(`${ROOT}/js/main.js`, 'utf8'));
await tick();

const doc3 = w3.document;
check('الأطباق المنشورة تُحلّ محلّ الافتراضية',
  doc3.querySelectorAll('#menuGrid .dish').length === 3,
  `(ظهر ${doc3.querySelectorAll('#menuGrid .dish').length})`);
check('الطبق المخفي لا يظهر', doc3.querySelector('#menuGrid .dish[data-id="kunafa"]') === null);
check('السعر الجديد ظهر في البطاقة',
  doc3.querySelector('#menuGrid .dish[data-id="kabsa-lamb"] .price').textContent.includes('٩٩'),
  `(${doc3.querySelector('#menuGrid .dish[data-id="kabsa-lamb"] .price').textContent})`);
check('البطاقة تعرض العملة القطرية لا السعودية',
  doc3.querySelector('#menuGrid .dish[data-id="kabsa-lamb"] .price small').textContent === 'ر.ق');
check('الطبق المضاف ظهر', !!doc3.querySelector('#menuGrid .dish[data-id="new-dish"]'));
check('عدّاد الأطباق يستثني المخفي',
  doc3.querySelector('[data-count-source="menu"]').getAttribute('data-count') === '3');

check('رقم الهاتف طُبّق على روابط الاتصال',
  doc3.querySelector('[data-tel="label"]').getAttribute('href') === 'tel:+97455556666');
check('نصّ رقم الهاتف منسّق',
  doc3.querySelector('[data-tel="label"]').textContent === '+974 5555 6666',
  `(${doc3.querySelector('[data-tel="label"]').textContent})`);
check('رقم واتساب طُبّق على كل أزراره',
  Array.from(doc3.querySelectorAll('[data-wa]'))
    .every((a) => a.getAttribute('href') === 'https://wa.me/97433334444'));
check('رابط «أو اتصل» يعرض الرقم المحلي',
  doc3.querySelector('[data-tel="call"]').textContent === 'أو اتصل: ٥٥٥٥٦٦٦٦',
  `(${doc3.querySelector('[data-tel="call"]').textContent})`);
check('العنوان طُبّق', doc3.querySelector('[data-address]').textContent === 'الدوحة — شارع الريان');
check('أوقات العمل طُبّقت', doc3.querySelector('[data-hours]').textContent === 'يومياً ١٠ ص — ١٢ م');
check('الفروع طُبّقت في قائمة الاستلام',
  doc3.querySelector('#cartBranch').textContent.includes('فرع الريان'));

/* السلة بالإعدادات الجديدة: شاي ٨ + توصيل ٢٠، وأقل مبلغ للطلب ٤٠ */
const click3 = (el) => el.dispatchEvent(new w3.MouseEvent('click', { bubbles: true }));
click3(doc3.querySelector('#menuGrid [data-add="tea-x"]'));
click3(doc3.querySelector('#dmAdd'));
click3(doc3.querySelector('#cartBtn'));
click3(doc3.querySelector('.mode-btn[data-mode="delivery"]'));
check('رسوم التوصيل الجديدة مطبَّقة',
  doc3.querySelector('#sumDelivery').textContent === '٢٠ ر.ق',
  `(${doc3.querySelector('#sumDelivery').textContent})`);
check('تنبيه أقل مبلغ للطلب بالقيمة الجديدة',
  doc3.querySelector('#cartWarn').textContent.includes('٤٠'));

console.log('\n— اللوحة: حفظ الأسعار والتواصل —');
const siteStub = githubStub({ manifest: null });
const wSite = makeAdmin(siteStub);
wSite.BAK_ADMIN.state.token = 'tok-1';
wSite.BAK_ADMIN.state.repo = REPO;

const payload = {
  config: { whatsapp: '97411112222', currency: 'ر.ق', deliveryFee: 25, branches: [] },
  dishes: [{ id: 'x', name: 'طبق', cat: 'rice', price: 12 }]
};
await wSite.BAK_ADMIN.commitSiteData(payload, 'تحديث القائمة والأسعار من لوحة التحكّم');

const siteTree = siteStub.calls.find((c) => /\/git\/trees$/.test(c.url));
check('الحفظ يكتب data/site.json فقط',
  siteTree.body.tree.length === 1 && siteTree.body.tree[0].path === 'data/site.json');
const written = JSON.parse(siteTree.body.tree[0].content);
check('الملف يحفظ الإعدادات والأطباق',
  written.config.whatsapp === '97411112222' && written.dishes[0].price === 12);
check('الملف يحمل وقت التحديث', !!written.updated);
check('الحفظ لا يلمس فهرس الصور',
  !siteStub.calls.some((c) => /manifest/.test(JSON.stringify(c.body || ''))));

const siteCommit = siteStub.calls.find((c) => /\/git\/commits$/.test(c.url) && c.method === 'POST');
check('commit واحد للحفظ', !!siteCommit && siteCommit.body.message.includes('لوحة التحكّم'));

/* ==========================================================================
   وضع المعاينة — يجب ألّا يتسرّب طبق محجوب إلى الزبون أبداً
   ========================================================================== */
console.log('\n— وضع المعاينة —');

const noFetch = () => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null) });

const wNormal = makeWindow({ fetchStub: noFetch });
wNormal.eval(readFileSync(`${ROOT}/js/main.js`, 'utf8'));
await tick();

const wPrev = makeWindow({ fetchStub: noFetch, url: 'http://localhost/?preview=1' });
wPrev.eval(readFileSync(`${ROOT}/js/main.js`, 'utf8'));
await tick();

const allDishes    = wNormal.MENU.length;
const liveDishes   = wNormal.MENU.filter((d) => !d.hidden).length;
const hiddenDishes = allDishes - liveDishes;

check('العرض العادي يُظهر غير المحجوب فقط',
  wNormal.document.querySelectorAll('#menuGrid .dish').length === liveDishes,
  `(ظهر ${wNormal.document.querySelectorAll('#menuGrid .dish').length} والمتوقع ${liveDishes})`);
check('العرض العادي بلا شريط معاينة', wNormal.document.getElementById('previewBar') === null);
check('العرض العادي بلا شارة «محجوب»',
  wNormal.document.querySelectorAll('#menuGrid .tag-draft').length === 0);

check('المعاينة تُظهر كل الأطباق',
  wPrev.document.querySelectorAll('#menuGrid .dish').length === allDishes,
  `(ظهر ${wPrev.document.querySelectorAll('#menuGrid .dish').length} والمتوقع ${allDishes})`);
check('المعاينة تُعلّم المحجوب وحده',
  wPrev.document.querySelectorAll('#menuGrid .tag-draft').length === hiddenDishes,
  `(${wPrev.document.querySelectorAll('#menuGrid .tag-draft').length} من ${hiddenDishes})`);
check('شريط المعاينة ظاهر ويذكر العدد',
  !!wPrev.document.getElementById('previewBar') &&
  wPrev.document.getElementById('previewBar').textContent.includes('المعاينة'));
check('المعاينة تُظهر تصنيفات الأطباق المحجوبة',
  wPrev.document.querySelectorAll('#menuFilters .chip').length >
  wNormal.document.querySelectorAll('#menuFilters .chip').length);
check('طبق بلا سعر محجوب تلقائياً',
  wNormal.MENU.filter((d) => !d.price).every((d) => d.hidden));

/* غياب الملف = لا تخصيص، والموقع يعمل بالقيم الافتراضية */
const noneW = makeAdmin(githubStub({ site: null }));
noneW.BAK_ADMIN.state.token = 'tok-1';
noneW.BAK_ADMIN.state.repo = REPO;
check('قراءة بيانات غير موجودة ترجع null', (await noneW.BAK_ADMIN.readSiteData()) === null);

/* القراءة تفكّ ترميز base64 العربي كما هو */
const arabicPayload = { config: { address: 'الدوحة — الوعب' }, dishes: [{ id: 'a', name: 'مجبوس' }] };
const readW = makeAdmin(githubStub({
  site: { content: Buffer.from(JSON.stringify(arabicPayload), 'utf8').toString('base64') }
}));
readW.BAK_ADMIN.state.token = 'tok-1';
readW.BAK_ADMIN.state.repo = REPO;
const readBack = await readW.BAK_ADMIN.readSiteData();
check('قراءة data/site.json تفكّ الترميز العربي سليماً',
  readBack.config.address === 'الدوحة — الوعب' && readBack.dishes[0].name === 'مجبوس',
  `(${readBack && readBack.config && readBack.config.address})`);

/* ==========================================================================
   ٤. صفحة اللوحة الخاصة admin.html
   ========================================================================== */
console.log('\n— صفحة اللوحة الخاصة —');

const adminHtml = readFileSync(`${ROOT}/admin.html`, 'utf8');
check('الصفحة مستثناة من محركات البحث', adminHtml.includes('noindex'));
check('robots.txt يمنع فهرستها',
  readFileSync(`${ROOT}/robots.txt`, 'utf8').includes('Disallow: /admin.html'));

function makeAdminPage(stub, token) {
  const dom = new JSDOM(adminHtml, {
    runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/admin.html'
  });
  const { window } = dom;

  window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
  window.requestAnimationFrame = (cb) => setTimeout(() => cb(0), 0);
  window.fetch = stub.fetchStub;
  window.BAK_ADMIN_PAGE = true;

  if (token) {
    window.localStorage.setItem('bak_admin_token', JSON.stringify(token));
    window.localStorage.setItem('bak_admin_repo', JSON.stringify(REPO));
  }

  window.eval(readFileSync(`${ROOT}/js/menu-data.js`, 'utf8'));
  window.eval(readFileSync(`${ROOT}/js/gallery-data.js`, 'utf8'));
  window.eval(readFileSync(`${ROOT}/js/admin.js`, 'utf8'));
  return window;
}

/* بلا رمز: تظهر شاشة الاتصال فقط */
const guest = makeAdminPage(githubStub());
await tick();
check('اللوحة تُبنى تلقائياً في الصفحة الخاصة', !!guest.document.querySelector('#bakAdmin'));
check('بلا رمز: تظهر شاشة الاتصال', guest.document.querySelector('#adLogin').hidden === false);
check('بلا رمز: لا تظهر أدوات التعديل', guest.document.querySelector('#adWork').hidden === true);
check('لا يمكن الحفظ بلا رمز', guest.BAK_ADMIN.state.token === '');

/* مع رمز محفوظ: تظهر التبويبات */
const pageStub = githubStub();
const owner = makeAdminPage(pageStub, 'tok-1');
await tick(30);

const pdoc = owner.document;
check('مع رمز: تظهر أدوات التعديل', pdoc.querySelector('#adWork').hidden === false);
check('ثلاثة تبويبات: الصور والأسعار والتواصل',
  Array.from(pdoc.querySelectorAll('.ad-tab')).map((t) => t.textContent).join('|') === 'الصور|الأسعار|التواصل');
check('تبويب الصور هو الافتراضي',
  pdoc.querySelector('.ad-pane[data-pane="images"]').hidden === false);

/* تبويب الأسعار: صفّ لكل طبق */
const clickP = (el) => el.dispatchEvent(new owner.MouseEvent('click', { bubbles: true }));
clickP(pdoc.querySelector('.ad-tab[data-tab="menu"]'));
check('تبويب الأسعار يعرض صفّاً لكل طبق',
  pdoc.querySelectorAll('#adDishes .ad-row').length === owner.MENU.length,
  `(${pdoc.querySelectorAll('#adDishes .ad-row').length})`);
check('السعر الحالي معروض في الصفّ',
  Number(pdoc.querySelector('#adDishes .ad-row .ad-in-price').value) === owner.MENU[0].price);

/* ===== اللوحة مرتّبة بالأقسام، لا قائمة مسطّحة ===== */
const liveCats = [...new Set(owner.MENU.map((d) => d.cat))];
check('كل تصنيف قسم مستقلّ يُطوى',
  pdoc.querySelectorAll('#adDishes .ad-group').length === liveCats.length,
  `(${pdoc.querySelectorAll('#adDishes .ad-group').length} من ${liveCats.length})`);
check('أوّل قسم مفتوح والبقيّة مطويّة',
  pdoc.querySelectorAll('#adDishes .ad-group[open]').length === 1);
check('كل قسم يعلن كم طبقاً منه منشور',
  pdoc.querySelector('#adDishes .ad-group-count').textContent.includes('منشور'));
check('كل طبق بطاقة لا صفّ مزدحم',
  pdoc.querySelectorAll('#adDishes .ad-card').length === owner.MENU.length);
check('حالة كل طبق مكتوبة',
  pdoc.querySelectorAll('#adDishes .ad-state').length === owner.MENU.length);
/* عدداً بعدد لا «واحد على الأقل»: القائمة تُسعَّر يوماً بعد يوم،
   فاختبارٌ يشترط وجود طبق بلا سعر ينكسر يوم تكتمل الأسعار */
check('علامة «بلا سعر» بعدد الأطباق غير المسعَّرة',
  Array.from(pdoc.querySelectorAll('#adDishes .ad-state'))
    .filter((s) => s.textContent === 'بلا سعر').length ===
  owner.MENU.filter((d) => !d.price).length);
check('الطبق المنشور مُعلَّم «منشور»',
  Array.from(pdoc.querySelectorAll('#adDishes .ad-state.is-live')).length ===
  owner.MENU.filter((d) => d.price > 0 && !d.hidden).length);

/* البحث يضيّق القائمة ويفتح القسم الذي فيه النتيجة */
const searchBox = pdoc.querySelector('#adDishSearch');
const someName  = owner.MENU.find((d) => d.price > 0).name;
searchBox.value = someName;
searchBox.dispatchEvent(new owner.Event('input', { bubbles: true }));
const visibleCards = Array.from(pdoc.querySelectorAll('#adDishes .ad-card'))
  .filter((c) => !c.hidden);
check('البحث يُظهر المطابق وحده',
  visibleCards.length >= 1 && visibleCards.every((c) => c.getAttribute('data-name').includes(someName)),
  `(${visibleCards.length} بطاقة)`);
check('البحث يخفي الأقسام الفارغة',
  Array.from(pdoc.querySelectorAll('#adDishes .ad-group')).some((g) => g.hidden));

searchBox.value = '';
searchBox.dispatchEvent(new owner.Event('input', { bubbles: true }));
check('مسح البحث يعيد كل الأطباق',
  Array.from(pdoc.querySelectorAll('#adDishes .ad-card')).every((c) => !c.hidden));

/* تعديل سعر وإخفاء طبق ثم حفظ */
pdoc.querySelector('#adDishes .ad-row .ad-in-price').value = '123';
pdoc.querySelectorAll('#adDishes .ad-row')[1].querySelector('.ad-hide').checked = true;
pageStub.calls.length = 0;
clickP(pdoc.querySelector('#adSaveMenu'));
await tick(40);

const savedTree = pageStub.calls.find((c) => /\/git\/trees$/.test(c.url));
check('الحفظ يرسل الملف إلى GitHub', !!savedTree);
const savedData = JSON.parse(savedTree.body.tree[0].content);
check('السعر المعدّل محفوظ', savedData.dishes[0].price === 123);
check('الطبق المخفي محفوظ بعلامته', savedData.dishes[1].hidden === true);
check('باقي الأطباق سليمة', savedData.dishes.length === owner.MENU.length);
check('الإعدادات محفوظة مع القائمة', savedData.config.whatsapp === owner.ORDER_CONFIG.whatsapp);
check('علَم «يحتاج طبقاً رئيسياً» ينجو من الحفظ',
  savedData.dishes.filter((d) => d.needsMain).length ===
  owner.MENU.filter((d) => d.needsMain).length);
check('علَم «طبق رئيسي» ينجو من الحفظ',
  savedData.dishes.filter((d) => d.main).length === owner.MENU.filter((d) => d.main).length);

/* ===== إدخال سعر لطبق محجوب ينشره وحده ===== */
console.log('\n— اللوحة: السعر ينشر الطبق —');
clickP(pdoc.querySelector('.ad-tab[data-tab="menu"]'));

/* الحالة تُهيّأ صراحةً: نصفّر سعر طبق له أحجام في المسوّدة ثم
   نعيد الرسم، فلا يعتمد الاختبار على وجود طبق بلا سعر في المنيو */
const draftNow = owner.BAK_ADMIN.state.draft.dishes;
const noPrice  = draftNow.findIndex((d) => d.sizes && d.sizes.length > 1);
draftNow[noPrice].price  = 0;
draftNow[noPrice].hidden = true;
if (draftNow[noPrice].sizes[0].price != null) draftNow[noPrice].sizes[0].price = 0;
owner.BAK_ADMIN.renderDishRows();

const rows   = Array.from(pdoc.querySelectorAll('#adDishes .ad-row'));
const target = rows[noPrice];

check('الطبق بلا سعر معروض في اللوحة بخانة إخفاء مؤشَّرة',
  !!target && target.querySelector('.ad-hide').checked === true,
  `(فهرس ${noPrice})`);
check('حقول أسعار الأحجام معروضة',
  !!target && target.querySelectorAll('.ad-in-size').length ===
  draftNow[noPrice].sizes.length - 1,
  `(${target ? target.querySelectorAll('.ad-in-size').length : 0})`);

/* المالك يكتب سعر الصحن وسعر الصحنين ولا يلمس خانة الإخفاء */
target.querySelector('.ad-in-price').value = '2500';
target.querySelector('.ad-in-size').value  = '4200';
pageStub.calls.length = 0;
clickP(pdoc.querySelector('#adSaveMenu'));
await tick(40);

const pricedTree = pageStub.calls.find((c) => /\/git\/trees$/.test(c.url));
const pricedData = JSON.parse(pricedTree.body.tree[0].content);
const pricedDish = pricedData.dishes[noPrice];

check('السعر الأساسي محفوظ', pricedDish.price === 2500);
check('إدخال السعر يرفع الحجب تلقائياً', pricedDish.hidden === false,
  `(hidden = ${pricedDish.hidden})`);
check('سعر الحجم الثاني محفوظ كاملاً كما كُتب', pricedDish.sizes[1].price === 4200,
  `(price = ${pricedDish.sizes[1].price})`);
check('لا يبقى فرق قديم يتعارض مع السعر الكامل',
  pricedDish.sizes[1].delta === undefined);

/* الطبق المنشور بهذين السعرين يعرضهما كاملين للزبون */
const wPriced = makeWindow({
  fetchStub: (url) => String(url).includes('site.json')
    ? Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(pricedData) })
    : Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null) })
});
wPriced.eval(readFileSync(`${ROOT}/js/main.js`, 'utf8'));
await tick(40);
const pricedCard = wPriced.document.querySelector(`#menuGrid .dish[data-id="${pricedDish.id}"]`);
check('الطبق المسعَّر ظهر للزبون', !!pricedCard);
check('البطاقة تقول «من» لاختلاف سعري الصحن والصحنين',
  !!pricedCard && !!pricedCard.querySelector('.price-from'));

/* تبويب التواصل: تعديل رقم واتساب */
clickP(pdoc.querySelector('.ad-tab[data-tab="contact"]'));
check('حقول التواصل معبّأة من الإعدادات',
  pdoc.querySelector('#cfWhatsapp').value === owner.ORDER_CONFIG.whatsapp);
check('الفروع تظهر كصفوف قابلة للتعديل',
  pdoc.querySelectorAll('#adBranches .ad-row').length === owner.ORDER_CONFIG.branches.length);

pdoc.querySelector('#cfWhatsapp').value = '974 7777 8888';
pdoc.querySelector('#cfMin').value = '55';
pageStub.calls.length = 0;
clickP(pdoc.querySelector('#adSaveContact'));
await tick(40);

const contactTree = pageStub.calls.find((c) => /\/git\/trees$/.test(c.url));
const contactData = JSON.parse(contactTree.body.tree[0].content);
check('رقم واتساب يُنظّف من المسافات', contactData.config.whatsapp === '97477778888');
check('أقل مبلغ للطلب محفوظ رقماً', contactData.config.minOrder === 55);
check('تعديل التواصل يحفظ القائمة كما هي', contactData.dishes.length === owner.MENU.length);

/* ===== أيقونات التطبيق =====
   أيقونةٌ مذكورة ولا موجودة لا تُسقط شيئاً في الاختبارات: تظهر
   فراغاً على شاشة الزبون ويرفضها جوجل بلاي عند الرفع. */
console.log('\n— أيقونات التطبيق —');
const { existsSync, statSync } = await import('node:fs');
const manifest = JSON.parse(readFileSync(`${ROOT}/manifest.webmanifest`, 'utf8'));
const swSrc = readFileSync(`${ROOT}/sw.js`, 'utf8');
const pageSrc = readFileSync(`${ROOT}/index.html`, 'utf8');

const missing = manifest.icons.filter((i) => !existsSync(`${ROOT}/${i.src}`));
check('كل أيقونة في البيان موجودة على القرص', missing.length === 0,
  `(ناقص: ${missing.map((i) => i.src).join('، ')})`);

check('البيان فيه أيقونة قابلة للقصّ',
  manifest.icons.some((i) => i.purpose === 'maskable'));

const swIcons = [...swSrc.matchAll(/'\.\/(icons\/[^']+)'/g)].map((m) => m[1]);
const swMissing = swIcons.filter((p) => !existsSync(`${ROOT}/${p}`));
check('كل أيقونة يخزّنها عامل الخدمة موجودة', swMissing.length === 0,
  `(ناقص: ${swMissing.join('، ')})`);

const pageIcons = [...pageSrc.matchAll(/href="(icons\/[^"]+)"/g)].map((m) => m[1]);
const pageMissing = pageIcons.filter((p) => !existsSync(`${ROOT}/${p}`));
check('كل أيقونة تشير إليها الصفحة موجودة', pageMissing.length === 0,
  `(ناقص: ${pageMissing.join('، ')})`);

/* أيقونة جوجل بلاي شرطُ رفعٍ لا تحسين: ٥١٢×٥١٢ بالضبط */
const playIcon = `${ROOT}/icons/play-store-512.png`;
check('أيقونة جوجل بلاي مُولَّدة', existsSync(playIcon));
if (existsSync(playIcon)) {
  const buf = readFileSync(playIcon);
  check('أيقونة المتجر ٥١٢×٥١٢ بالضبط',
    buf.readUInt32BE(16) === 512 && buf.readUInt32BE(20) === 512,
    `(${buf.readUInt32BE(16)}×${buf.readUInt32BE(20)})`);
}

/* الشعار مصدر الأيقونات كلّها — فقدُه يجعل توليدها مستحيلاً */
check('شعار المطبخ موجود مصدراً للأيقونات',
  existsSync(`${ROOT}/images/logo.png`) && statSync(`${ROOT}/images/logo.png`).size > 0);

/* لافتة التثبيت تعرض الأيقونة نفسها التي ستستقرّ على شاشة الزبون */
check('لافتة التثبيت تعرض الشعار لا إيموجي',
  /<img[^>]+class="ib-icon"[^>]+src="icons\//.test(pageSrc),
  '(ما زالت إيموجي)');

/* سفاري لا يطلق beforeinstallprompt، فبلا مسارٍ خاصّ لا يعرف صاحب
   الآيفون أنّ الموقع يُثبّت — والتثبيت هو الطريق الوحيد اليوم */
const mainSrc = readFileSync(`${ROOT}/js/main.js`, 'utf8');
check('للآيفون إرشاد تثبيت خاصّ',
  /iphone\|ipad\|ipod/i.test(mainSrc) && mainSrc.includes('إضافة إلى الشاشة الرئيسية'));
check('إرشاد الآيفون يخفي زرّ التثبيت الذي لا يعمل عنده',
  /installBtn\.hidden = true/.test(mainSrc));

console.log(`\n${'='.repeat(46)}`);
console.log(`النتيجة:  ✓ ${pass} ناجح   ✗ ${fail} فاشل`);
console.log('='.repeat(46));
process.exit(fail ? 1 : 0);
