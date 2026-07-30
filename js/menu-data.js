/* ==========================================================================
   بيت الكبسة — بيانات القائمة
   هذا هو الملف الوحيد الذي تعدّله لتغيير الأطباق أو الأسعار.
   كل شيء آخر (العرض، البحث، السلة) يقرأ من هنا تلقائياً.
   --------------------------------------------------------------------------
   حقول الطبق:
     id      : معرّف فريد بالإنجليزية (لا تغيّره بعد النشر — السلة تعتمد عليه)
     name    : الاسم المعروض
     cat     : التصنيف — fish | rice | grill | starter | dessert | drink
     price   : السعر الأساسي بالريال القطري
     emoji   : رمز مؤقت مكان الصورة
     img     : مسار صورة حقيقية (اختياري) مثل "images/kabsa.jpg"
     desc    : الوصف المختصر
     tag     : شارة تظهر على البطاقة (اختياري)
     hot     : true لإبراز الشارة بالأحمر
     prep    : وقت التحضير بالدقائق (اختياري)
     sizes   : خيارات الحجم — delta يُضاف للسعر الأساسي
     sizeLabel: عنوان الخيارات لو لم تكن أحجاماً، مثل «اختر النوع» (اختياري)
     addons  : إضافات اختيارية بسعر لكل واحدة — السعر ٠ يُعرض «مجاناً»
     hidden  : true يخفي الطبق عن الزوّار دون حذفه
   ========================================================================== */

var MENU_CATEGORIES = [
  { id: 'all',     label: 'الكل' },
  { id: 'fav',     label: 'المفضّلة ♥' },
  { id: 'fish',    label: 'السمك البحري' },
  { id: 'lamb',    label: 'الخروف' },
  { id: 'rice',    label: 'الأرز واللحوم' },
  { id: 'grill',   label: 'المشاوي' },
  { id: 'starter', label: 'المقبلات' },
  { id: 'dessert', label: 'الحلويات' },
  { id: 'drink',   label: 'المشروبات' }
];

/* ---------------- الصوالين ----------------
   الصالونة تُطلب طبقاً مستقلاً وتُطلب إضافةً على اللقن، فسعرها معرّف
   هنا مرة واحدة فقط. عدّل السعر في هذه القائمة وحدها، وينتشر في
   الموضعين تلقائياً — لا تكرار ولا سعران مختلفان لصالونة واحدة. */
var SALONA_TYPES = [
  { id: 'shari',   label: 'شعري',   price: 35 },
  { id: 'kanad',   label: 'كنعد',   price: 40 },
  { id: 'qabaqib', label: 'قباقب',  price: 40 },
  { id: 'rubian',  label: 'روبيان', price: 45 },
  { id: 'hamour',  label: 'هامور',  price: 55 }
];

/* ---------------- الأصناف الجانبية ----------------
   الصوالين، ومعها القشيد وقباقب بشاميل بطلب المطعم: كلها خيارات
   داخل طبق واحد بدل بطاقة لكل صنف. مرتّبة بالسعر تصاعدياً. */
var SIDE_TYPES = SALONA_TYPES.map(function (t) {
  return { id: 'salona-' + t.id, label: 'صالونة ' + t.label, price: t.price };
}).concat([
  { id: 'qabaqib-bechamel', label: 'قباقب بشاميل', price: 35 },
  { id: 'qashid',           label: 'قشيد',         price: 50 }
]).sort(function (a, b) { return a.price - b.price; });

/* أرخص صنف = سعر الطبق الأساسي، والباقي فرقٌ يُضاف إليه */
var SIDE_BASE = Math.min.apply(null, SIDE_TYPES.map(function (t) { return t.price; }));

var SIDE_SIZES = SIDE_TYPES.map(function (t) {
  return { id: t.id, label: t.label, delta: t.price - SIDE_BASE };
});

/* ---------------- أنواع الأرز ----------------
   تُختار مع اللقن بلا فرق سعر، ويُسمح بنوعين على الأكثر.
   حقل picks في الطبق يرسمها مجموعةً مستقلّة في النافذة. */
var RICE_PICKS = {
  label: 'اختر نوع الأرز — نوع أو نوعان',
  max: 2,
  options: [
    { id: 'white',   label: 'رز أبيض' },
    { id: 'mjabbas', label: 'رز مجبس' },
    { id: 'malaki',  label: 'رز ملكي' },
    { id: 'sukkari', label: 'رز سكري' }
  ]
};

/* كل طلب سمك لخمسة أشخاص أو أكثر — أي اللقن — يأتي معه سلطة
   وصالونة كنعد بلا مقابل. يُعرض في شريط بارز عبر حقل included.
   لا يسري على الصالونة والقباقب والقشيد وحدها. */
var FISH_INCLUDED = 'مع كل طلب لخمسة أشخاص أو أكثر: سلطة + صالونة كنعد مجاناً';
var INCLUDED_SALONA = 'kanad';

/* ---------------- السلطات ----------------
   إضافات مدفوعة على اللقن، مرتّبة بالسعر تصاعدياً */
var SALAD_TYPES = [
  { id: 'rob-khiyar', label: 'روب خيار',   price: 15 },
  { id: 'hamra',      label: 'سلطة حمرة',  price: 15 },
  { id: 'fattoush',   label: 'فتوش',       price: 20 },
  { id: 'rob-rumman', label: 'روب رمان',   price: 20 },
  { id: 'jarjeer',    label: 'سلطة جرجير', price: 20 }
];

/* الإضافات على اللقن: الصوالين ثم السلطات ثم الدقوس. حقل group
   يجمع كل طائفة تحت عنوانها في النافذة، فلا تصير قائمةً طويلة
   بلا ترتيب. وصالونة المشمول تُسمّى «إضافية» حتى لا يظنّ الزبون
   أنه يدفع ثمن المجانية. */
var LAQAN_ADDONS = SALONA_TYPES.map(function (t) {
  return {
    id: 'salona-' + t.id,
    group: 'صوالين',
    label: 'صالونة ' + t.label + (t.id === INCLUDED_SALONA ? ' إضافية' : ''),
    price: t.price
  };
}).concat(SALAD_TYPES.map(function (s) {
  return { id: 'salad-' + s.id, group: 'سلطات', label: s.label, price: s.price };
})).concat([
  { id: 'daqoos', group: 'أخرى', label: 'دقوس', price: 10 }
]);

/* ==========================================================================
   الخروف — أنواع الأرز والمشمول والإضافات
   ========================================================================== */

/* أنواع أرز اللحم تختلف عن أرز السمك. الاختيار اختياري: اسم الطبق
   يحدّد الأرز أصلاً، وهذه لمن يريد تخصيصه. */
var MEAT_RICE_PICKS = {
  label: 'نوع الأرز (اختياري)',
  max: 1,
  optional: true,
  options: [
    { id: 'badawi',  label: 'بداوي' },
    { id: 'biryani', label: 'برياني' },
    { id: 'malaki',  label: 'ملكي' },
    { id: 'barriya', label: 'برية' },
    { id: 'white',   label: 'أبيض' }
  ]
};

var MEAT_INCLUDED = 'مع كل طلب: سلطة + مرق مجاناً';

/* خيار الصحن للخروف الكامل: الخروف نفسه، إمّا في صحن واحد أو
   موزّعاً على صحنين بسعر أعلى. فرق السعر لم يصل بعد — ضعه في
   delta الثاني (سعر الصحنين ناقص سعر الصحن الواحد). */
var LAMB_PLATES = [
  { id: 'one', label: 'صحن واحد',        delta: 0 },
  { id: 'two', label: 'موزّع على صحنين', delta: 0 }
];

/* إضافات اللحم: السلطات بأسعارها المعروفة، ثم الهريس والمضروبة.
   سعر الهريس والمضروبة لم يصل، فيسقطان تلقائياً حتى يوضع (انظر
   حماية الأسعار الناقصة في أسفل الملف). */
var MEAT_ADDONS = SALAD_TYPES.map(function (s) {
  return { id: 'salad-' + s.id, group: 'سلطات', label: s.label, price: s.price };
}).concat([
  { id: 'hareis',    group: 'أطباق جانبية', label: 'هريس',   price: 0 },
  { id: 'madhrouba', group: 'أطباق جانبية', label: 'مضروبة', price: 0 }
]);

/* الأطباق التي يتغيّر فيها الأرز فقط — تُبنى مرة واحدة بدل تكرار
   الحقول ست مرات. price صفر حتى تصل الأسعار من المطعم. */
function lambDish(id, name, opts) {
  var dish = {
    id: id,
    name: name,
    cat: 'lamb',
    price: 0,
    emoji: (opts && opts.emoji) || '🍖',
    included: MEAT_INCLUDED,
    picks: MEAT_RICE_PICKS,
    addons: MEAT_ADDONS
  };
  if (opts && opts.sizes) dish.sizes = opts.sizes;
  if (opts && opts.sizeLabel) dish.sizeLabel = opts.sizeLabel;
  if (opts && opts.tag) dish.tag = opts.tag;
  return dish;
}

var MENU = [

  /* ---------------- الخروف الكامل ----------------
     صحن أو صحنين، والسعران يختلفان */
  lambDish('lamb-badawi',   'خروف على بداوي',      { sizes: LAMB_PLATES, sizeLabel: 'صحن أو صحنين', tag: 'خروف كامل' }),
  lambDish('lamb-biryani',  'خروف على برياني',     { sizes: LAMB_PLATES, sizeLabel: 'صحن أو صحنين', tag: 'خروف كامل' }),
  lambDish('lamb-malakiya', 'خروف على كيسة ملكية', { sizes: LAMB_PLATES, sizeLabel: 'صحن أو صحنين', tag: 'خروف كامل' }),
  lambDish('lamb-barriya',  'خروف على كيسة برية',  { sizes: LAMB_PLATES, sizeLabel: 'صحن أو صحنين', tag: 'خروف كامل' }),
  lambDish('lamb-mashwi',   'خروف مشوي (محمر)',    { sizes: LAMB_PLATES, sizeLabel: 'صحن أو صحنين', tag: 'خروف كامل', emoji: '🔥' }),

  /* ---------------- نصف الخروف ----------------
     صحن واحد فقط، فلا خيار صحون */
  lambDish('half-badawi',       'نص خروف على بداوي',       { tag: 'نصف خروف' }),
  lambDish('half-biryani',      'نص خروف على برياني',      { tag: 'نصف خروف' }),
  lambDish('half-malakiya',     'نص خروف على كيسة ملكية',  { tag: 'نصف خروف' }),
  lambDish('half-barriya',      'نص خروف على كيسة برية',   { tag: 'نصف خروف' }),
  lambDish('half-biryani-arabi','نص خروف على برياني عربي', { tag: 'نصف خروف' }),
  lambDish('half-mashwi',       'نص خروف مشوي (محمر)',     { tag: 'نصف خروف', emoji: '🔥' }),

  /* ---------------- السمك البحري ---------------- */
  {
    id: 'laqan-vip',
    name: 'لقن بحري مشكّل VIP',
    cat: 'fish',
    price: 1300,
    emoji: '🐟',
    desc: 'ثمانية أصناف بحرية: هامور، كنعد، صافي، أم الربيان، روبيان، زبيدي، سيباس، وشعري.',
    tag: 'ثمانية أصناف',
    hot: true,
    included: FISH_INCLUDED,
    picks: RICE_PICKS,
    sizes: [
      { id: 'small',  label: 'صغير — ٦ إلى ٨ أشخاص',   delta: 0 },
      { id: 'medium', label: 'وسط — ٨ إلى ١٢ شخصاً',   delta: 300 },
      { id: 'large',  label: 'كبير — ١٣ إلى ١٥ شخصاً', delta: 1300 }
    ],
    addons: LAQAN_ADDONS
  },
  {
    id: 'laqan-5',
    name: 'لقن بحري ٥ أصناف',
    cat: 'fish',
    price: 1000,
    emoji: '🐠',
    desc: 'خمسة أصناف: كنعد، صافي، روبيان، شعري، وقياقي.',
    tag: 'خمسة أصناف',
    included: FISH_INCLUDED,
    picks: RICE_PICKS,
    sizes: [
      { id: 'small',  label: 'صغير — ٦ إلى ٨ أشخاص',   delta: 0 },
      { id: 'medium', label: 'وسط — ٨ إلى ١٠ أشخاص',  delta: 300 },
      { id: 'large',  label: 'كبير — ١٠ إلى ١٥ شخصاً', delta: 900 }
    ],
    addons: LAQAN_ADDONS
  },
  {
    id: 'salona',
    name: 'صالونة سمك وجوانب',
    cat: 'fish',
    price: SIDE_BASE,
    emoji: '🥘',
    desc: 'صوالين الشعري والكنعد والقباقب والروبيان والهامور، ومعها قباقب بشاميل وقشيد.',
    sizeLabel: 'اختر الصنف',
    sizes: SIDE_SIZES
  },

  /* ---------------- الأرز واللحوم ----------------
     مخفيّة مؤقتاً: أسعارها للوجبة الفردية، والطلب حالياً صحون
     لخمسة أشخاص أو أكثر. تُعاد بحذف hidden عند وصول منيو اللحوم. */
  {
    id: 'kabsa-lamb',
    name: 'كبسة بداوي لحم',
    cat: 'rice',
    price: 80,
    emoji: '🍛',
    desc: 'أرز بسمتي بمرق لحم مع قطع لحم طريّة وبهارات الكبسة البيتية.',
    tag: 'الأكثر طلباً',
    hot: true,
    prep: 25,
    sizes: [
      { id: 'single', label: 'وجبة فردية', delta: 0 },
      { id: 'family', label: 'صحن عائلي (5 أشخاص)', delta: 145 }
    ],
    addons: [
      { id: 'extra-meat', label: 'زيادة لحم', price: 30 },
      { id: 'salad',      label: 'سلطة خضراء', price: 12 },
      { id: 'laban',      label: 'لبن بلدي', price: 10 }
    ]
  },
  {
    id: 'mandi-chicken',
    name: 'مندي دجاج',
    cat: 'rice',
    price: 45,
    emoji: '🍗',
    desc: 'دجاجة كاملة مدخّنة في التنّور الطيني، على فراش أرز مفلفل بالزعفران.',
    prep: 20,
    sizes: [
      { id: 'half',  label: 'نصف دجاجة', delta: 0 },
      { id: 'full',  label: 'دجاجة كاملة', delta: 25 }
    ],
    addons: [
      { id: 'salad', label: 'سلطة خضراء', price: 12 },
      { id: 'sauce', label: 'صلصة حارّة إضافية', price: 5 }
    ]
  },
  {
    id: 'haneeth',
    name: 'حنيذ خروف',
    cat: 'rice',
    price: 95,
    emoji: '🥘',
    desc: 'فخذ خروف مدفون في الحفرة ثماني ساعات حتى ينفصل اللحم عن العظم.',
    tag: 'يُطلب قبل ساعتين',
    prep: 120,
    addons: [
      { id: 'extra-meat', label: 'زيادة لحم', price: 35 },
      { id: 'salad',      label: 'سلطة خضراء', price: 12 }
    ]
  },
  {
    id: 'madhbi',
    name: 'مظبي دجاج',
    cat: 'rice',
    price: 50,
    emoji: '🍖',
    desc: 'مشويّ على الحجر الساخن بنكهة الفحم، مع صلصة المظبي الحارّة.',
    prep: 25,
    addons: [
      { id: 'sauce', label: 'صلصة مظبي إضافية', price: 6 },
      { id: 'bread', label: 'خبز تنّور', price: 5 }
    ]
  },
  {
    id: 'madghout',
    name: 'مضغوط لحم',
    cat: 'rice',
    price: 75,
    emoji: '🍚',
    desc: 'لحم مطبوخ تحت الضغط مع أرز أحمر وبهارات خليجية.',
    prep: 25,
    addons: [
      { id: 'extra-meat', label: 'زيادة لحم', price: 30 },
      { id: 'salad',      label: 'سلطة خضراء', price: 12 }
    ]
  },
  {
    id: 'jareesh',
    name: 'جريش',
    cat: 'rice',
    price: 40,
    emoji: '🥣',
    desc: 'قمح مجروش يُضرب باللبن والسمن البلدي، مع بصل مقلّى محمّر.',
    tag: 'طبق شعبي',
    prep: 15,
    addons: [
      { id: 'ghee', label: 'زيادة سمن بلدي', price: 8 }
    ]
  },

  /* ---------------- المشاوي ---------------- */
  {
    id: 'mixed-grill',
    name: 'مشكّل مشاوي',
    cat: 'grill',
    price: 110,
    emoji: '🍢',
    desc: 'كباب، شيش طاووق، وريش غنم على الفحم — يكفي شخصين.',
    tag: 'يكفي شخصين',
    hot: true,
    prep: 30,
    addons: [
      { id: 'bread', label: 'خبز تنّور', price: 5 },
      { id: 'hummus', label: 'حمص بالصنوبر', price: 18 }
    ]
  },
  {
    id: 'lamb-chops',
    name: 'ريش غنم بلدي',
    cat: 'grill',
    price: 90,
    emoji: '🥩',
    desc: 'ثماني قطع متبّلة بالليمون والزعتر، مشويّة على فحم الغضا.',
    prep: 30,
    addons: [
      { id: 'bread', label: 'خبز تنّور', price: 5 }
    ]
  },
  {
    id: 'maqalqal',
    name: 'مقلقل',
    cat: 'grill',
    price: 65,
    emoji: '🍳',
    desc: 'شرائح لحم رفيعة تُقلقل على الصاج مع الفلفل والبصل.',
    prep: 20,
    addons: [
      { id: 'bread', label: 'خبز تنّور', price: 5 }
    ]
  },
  {
    id: 'shish-tawook',
    name: 'شيش طاووق',
    cat: 'grill',
    price: 55,
    emoji: '🍡',
    desc: 'قطع دجاج متبّلة بالزبادي والثوم، مشويّة على الفحم.',
    prep: 22,
    addons: [
      { id: 'garlic', label: 'ثومية', price: 6 },
      { id: 'bread',  label: 'خبز تنّور', price: 5 }
    ]
  },

  /* ---------------- المقبلات ---------------- */
  {
    id: 'sambosa',
    name: 'سمبوسة لحم',
    cat: 'starter',
    price: 15,
    emoji: '🥟',
    desc: 'ستّ قطع مقرمشة محشوّة لحماً مفروماً بالبهارات.',
    prep: 10
  },
  {
    id: 'fattoush',
    name: 'سلطة فتوش',
    cat: 'starter',
    price: 22,
    emoji: '🥗',
    desc: 'خضار طازجة مع خبز محمّص ودبس الرمان.',
    prep: 8
  },
  {
    id: 'hummus',
    name: 'حمص بالصنوبر',
    cat: 'starter',
    price: 18,
    emoji: '🫓',
    desc: 'حمص مخفوق بالطحينة، يُقدَّم بزيت الزيتون والصنوبر المحمّص.',
    prep: 8
  },
  {
    id: 'tabbouleh',
    name: 'تبولة',
    cat: 'starter',
    price: 20,
    emoji: '🌿',
    desc: 'بقدونس وبرغل وطماطم مع الليمون وزيت الزيتون.',
    prep: 8
  },

  /* ---------------- الحلويات ---------------- */
  {
    id: 'luqaimat',
    name: 'لقيمات بالدبس',
    cat: 'dessert',
    price: 25,
    emoji: '🍯',
    desc: 'كرات مقرمشة من الخارج، هشّة من الداخل، غارقة بدبس التمر.',
    tag: 'مفضّلة الضيوف',
    hot: true,
    prep: 12,
    addons: [
      { id: 'sesame', label: 'سمسم محمّص', price: 4 }
    ]
  },
  {
    id: 'kunafa',
    name: 'كنافة بالقشطة',
    cat: 'dessert',
    price: 30,
    emoji: '🍰',
    desc: 'شعيرات ذهبية بالسمن البلدي وقشطة طازجة وقطر بماء الورد.',
    prep: 15
  },
  {
    id: 'om-ali',
    name: 'أم علي',
    cat: 'dessert',
    price: 28,
    emoji: '🥧',
    desc: 'عجين مورّق بالحليب والمكسرات، يُقدَّم ساخناً من الفرن.',
    prep: 15
  },

  /* ---------------- المشروبات ---------------- */
  {
    id: 'arabic-coffee',
    name: 'قهوة عربية وتمر',
    cat: 'drink',
    price: 12,
    emoji: '☕',
    desc: 'محمّصة على الهيل والزعفران، تُقدَّم بدلّة نحاسية مع تمر سكري.',
    prep: 5
  },
  {
    id: 'red-tea',
    name: 'شاي أحمر بالنعناع',
    cat: 'drink',
    price: 8,
    emoji: '🫖',
    desc: 'براد صغير يكفي كوبين، بنعناع طازج.',
    prep: 5
  },
  {
    id: 'laban',
    name: 'لبن بلدي بارد',
    cat: 'drink',
    price: 10,
    emoji: '🥛',
    desc: 'لبن طازج مخضوض يومياً — رفيق الكبسة الأول.',
    prep: 2
  },
  {
    id: 'fresh-juice',
    name: 'عصير طازج',
    cat: 'drink',
    price: 16,
    emoji: '🧃',
    desc: 'برتقال أو ليمون نعناع أو مانجو — يُعصر عند الطلب.',
    prep: 5,
    sizeLabel: 'اختر النوع',
    sizes: [
      { id: 'orange', label: 'برتقال', delta: 0 },
      { id: 'lemon',  label: 'ليمون نعناع', delta: 0 },
      { id: 'mango',  label: 'مانجو', delta: 4 }
    ]
  }
];

/* ---------------- الأقسام المؤجّلة ----------------
   منيو اللحوم لم يصل بعد، وأسعار أقسامه أدناه للوجبة الفردية في حين أن
   الطلب حالياً صحون لخمسة أشخاص أو أكثر. فنُخفيها بدل عرض سعر خاطئ.
   لإظهار قسم: احذف معرّفه من هذه القائمة فقط — الأطباق كلها باقية. */
var HIDDEN_CATEGORIES = ['rice', 'grill', 'starter', 'dessert', 'drink'];

MENU.forEach(function (dish) {
  if (HIDDEN_CATEGORIES.indexOf(dish.cat) !== -1) dish.hidden = true;
});

/* ---------------- حماية الأسعار الناقصة ----------------
   أي طبق أو إضافة سعره صفر لم يصل سعره بعد، فيُحجب تلقائياً:
   عرض «٠ ر.ق» أو «مجاناً» على شيء مدفوع أسوأ من عدم عرضه.
   ضع السعر في مكانه فيظهر وحده — لا خطوة أخرى ولا hidden تُحذف.
   (الإضافة المجانية عن قصد تُعلَّم free: true فتبقى ظاهرة.) */
MENU.forEach(function (dish) {
  if (!dish.price) dish.hidden = true;

  if (dish.addons) {
    dish.addons = dish.addons.filter(function (a) {
      return a.price > 0 || a.free === true;
    });
  }
});

/* ---------------- إعدادات الطلب ---------------- */
var ORDER_CONFIG = {
  /* رقم واتساب المطعم — بصيغة دولية بدون + أو مسافات */
  whatsapp: '97455921554',

  /* رقم الهاتف للاتصال — يُستخدم في روابط tel داخل index.html */
  phone: '97466265898',

  /* رمز العملة الظاهر بعد كل سعر */
  currency: 'ر.ق',

  /* العنوان وأوقات العمل — يظهران في صفحة الحجز والفروع والفوتر */
  address: 'قطر',
  hours: 'يومياً من ١١:٣٠ صباحاً حتى ١٢:٠٠ منتصف الليل',

  /* مناطق التوصيل ورسم كل منطقة — الأولى هي الافتراضية.
     freeOver: 0 يعني لا توصيل مجاني مهما بلغ الطلب — قرار المطعم. */
  deliveryZones: [
    { id: 'doha',    label: 'داخل الدوحة', fee: 50,  freeOver: 0 },
    { id: 'outside', label: 'خارج الدوحة', fee: 150, freeOver: 0 }
  ],

  /* رسم التوصيل الافتراضي — يُستخدم فقط لو لم تكن هناك مناطق */
  deliveryFee: 50,

  /* التوصيل مجاني فوق هذا المبلغ (0 = معطّل) — تُغلبه freeOver في المنطقة */
  freeDeliveryOver: 0,

  /* أقل مبلغ للطلب */
  minOrder: 30,

  /* الفروع المتاحة للاستلام — فارغة حالياً: الطلب عبر التوصيل فقط.
     عند فتح فرع، أضفه هنا بهذا الشكل ويظهر خيار الاستلام تلقائياً:
       { id: 'main', name: 'الفرع الرئيسي', area: 'الدوحة' } */
  branches: []
};
