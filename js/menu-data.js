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

/* أرخص صالونة = سعر الطبق المستقل الأساسي، والباقي فرقٌ يُضاف إليه */
var SALONA_BASE = Math.min.apply(null, SALONA_TYPES.map(function (t) { return t.price; }));

var SALONA_SIZES = SALONA_TYPES.map(function (t) {
  return { id: t.id, label: t.label, delta: t.price - SALONA_BASE };
});

/* كل طلب سمك لخمسة أشخاص أو أكثر — أي اللقن — يأتي معه سلطة
   وصالونة كنعد بلا مقابل. يُعرض في شريط بارز عبر حقل included.
   لا يسري على الصالونة والقباقب والقشيد وحدها. */
var FISH_INCLUDED = 'مع كل طلب لخمسة أشخاص أو أكثر: سلطة + صالونة كنعد مجاناً';
var INCLUDED_SALONA = 'kanad';

/* الإضافات على اللقن: بقيّة الصوالين بسعرها، وصالونة المشمول
   تُسمّى «إضافية» حتى لا يظنّ الزبون أنه يدفع ثمن المجانية. */
var LAQAN_ADDONS = SALONA_TYPES.map(function (t) {
  return {
    id: 'salona-' + t.id,
    label: 'صالونة ' + t.label + (t.id === INCLUDED_SALONA ? ' إضافية' : ''),
    price: t.price
  };
}).concat([
  { id: 'daqoos', label: 'دقوس', price: 10 }
]);

var MENU = [

  /* ---------------- السمك البحري ---------------- */
  {
    id: 'laqan-vip',
    name: 'لقن بحري مشكّل VIP',
    cat: 'fish',
    price: 1300,
    emoji: '🐟',
    desc: 'ثمانية أصناف بحرية: هامور، كنعد، صافي، أم الربيان، روبيان، زبيدي، سيباس، وشعري. نوع الأرز على حسب طلبك.',
    tag: 'ثمانية أصناف',
    hot: true,
    included: FISH_INCLUDED,
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
    desc: 'خمسة أصناف: كنعد، صافي، روبيان، شعري، وقياقي. نوع الأرز على حسب طلبك.',
    tag: 'خمسة أصناف',
    included: FISH_INCLUDED,
    sizes: [
      { id: 'small',  label: 'صغير — ٦ إلى ٨ أشخاص',   delta: 0 },
      { id: 'medium', label: 'وسط — ٨ إلى ١٠ أشخاص',  delta: 300 },
      { id: 'large',  label: 'كبير — ١٠ إلى ١٥ شخصاً', delta: 900 }
    ],
    addons: LAQAN_ADDONS
  },
  {
    id: 'salona',
    name: 'صالونة سمك',
    cat: 'fish',
    price: SALONA_BASE,
    emoji: '🥘',
    desc: 'تُطلب بالنوع الذي تختاره: شعري، كنعد، قباقب، روبيان، أو هامور.',
    sizeLabel: 'اختر النوع',
    sizes: SALONA_SIZES
  },
  {
    id: 'qabaqib-bechamel',
    name: 'قباقب بشاميل',
    cat: 'fish',
    price: 35,
    emoji: '🦀',
    desc: 'قباقب بصوص البشاميل.'
  },
  {
    /* بانتظار وصف من المطعم — الوصف الغائب لا يعطّل البطاقة */
    id: 'qashid',
    name: 'قشيد',
    cat: 'fish',
    price: 50,
    emoji: '🦐'
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
