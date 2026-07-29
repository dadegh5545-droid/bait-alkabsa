# تطبيق بيت الكبسة — نسخة أندرويد 📱

تغليف موقع بيت الكبسة داخل تطبيق أندرويد أصلي باستخدام **Capacitor**، بحيث يُنشر على Google Play بملف `.aab` أو يُوزّع مباشرة كـ `.apk`.

> **ملاحظة مهمة:** هناك نسختان من التطبيق:
> - **PWA** — جاهزة الآن، تُثبَّت من المتصفح مباشرة بلا متجر ولا أدوات (انظر [README الرئيسي](../README.md)).
> - **أندرويد أصلي** — هذا المجلد، ويحتاج أدوات بناء مثبّتة على جهازك.

## المتطلبات

| الأداة | ملاحظة |
|---|---|
| Node.js 18+ | ✅ مثبّت على جهازك |
| **JDK 17** | ❌ غير مثبّت — [تحميل Temurin 17](https://adoptium.net/temurin/releases/?version=17) |
| **Android Studio** | ❌ غير مثبّت — [تحميل](https://developer.android.com/studio) (يجلب Android SDK معه) |

بعد تثبيت Android Studio، اضبط متغيّر البيئة:

```powershell
[Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")
```

## الاختبارات

```powershell
cd app
npm test
```

يشغّل ١٥٢ اختباراً على ملفات الموقع في الجذر (القائمة، البحث، السلة، الحجز، المعرض، فهرس الصور، منطق الرفع إلى GitHub) داخل jsdom — لا يحتاج متصفحاً ولا أدوات أندرويد ولا شبكة.

## وضع التشغيل: حيّ من الإنترنت أم مضمّن؟

```powershell
cd app
npm run live                                     # يعرض الوضع الحالي
npm run live -- https://your-site.amplifyapp.com  # حيّ من الإنترنت
npm run live -- off                              # مضمّن أوفلاين
npm run sync                                     # بعد أي تغيير للوضع
```

**الوضع الحيّ** يجعل التطبيق يحمّل الموقع المنشور، فأي صورة تُنشر من لوحة الصور أو أي تعديل على الأسعار يظهر في التطبيق بمجرد إعادة فتحه — بلا إعادة بناء ولا تحديث من المتجر. الأداة تضيف `?app=1` للرابط ليعرف الموقع أنه داخل التطبيق (فيُظهر الشريط السفلي ويُخفي لافتة التثبيت)، وعامل الخدمة يخزّن الموقع في أول تشغيل فيبقى يعمل بدون إنترنت.

**الوضع المضمّن** يجمّد الملفات داخل التطبيق: يعمل أوفلاين من اللحظة الأولى، لكن كل تحديث يحتاج `npm run sync` وإعادة بناء ورفع.

## البناء خطوة بخطوة

```powershell
cd app

# 1. الاعتماديات (مثبّتة مسبقاً)
npm install

# 2. نسخ ملفات الموقع إلى التطبيق + مزامنة أندرويد
npm run sync

# 3. فتح المشروع في Android Studio
npm run open:android
```

من داخل Android Studio: **Build → Build Bundle(s)/APK(s) → Build APK(s)**.

أو من سطر الأوامر مباشرة (يتطلب JDK):

```powershell
npm run build:apk       # ملف تجريبي للتثبيت السريع
npm run build:release   # حزمة .aab لرفعها على Google Play
```

مخرجات البناء:
- APK: `app/android/app/build/outputs/apk/debug/app-debug.apk`
- AAB: `app/android/app/build/outputs/bundle/release/app-release.aab`

## ما تمّ تجهيزه

- ✅ اسم التطبيق بالعربية: **بيت الكبسة**
- ✅ مُعرّف الحزمة: `com.baitalkabsa.app`
- ✅ أيقونات لكل الكثافات (عادية + دائرية + تكيّفية) بخلفية بنّية `#3B2415`
- ✅ شاشات بداية طولية وعرضية لكل الكثافات
- ✅ دعم RTL مفعّل في `AndroidManifest.xml`
- ✅ شريط التنقّل السفلي يظهر تلقائياً في وضع التطبيق
- ✅ عامل الخدمة معطّل داخل التطبيق (الملفات مضمّنة أصلاً)

## عند تعديل الموقع

أي تعديل على `index.html` أو `css/` أو `js/` في جذر المستودع **لا ينتقل تلقائياً** للتطبيق. شغّل:

```powershell
cd app
npm run sync
```

## إعادة توليد الأيقونات

عند تغيير الشعار:

```powershell
cd app
powershell -ExecutionPolicy Bypass -File make-android-assets.ps1
```

## قبل الرفع على Google Play

- [ ] رفع `versionCode` و `versionName` في `android/app/build.gradle`
- [ ] إنشاء مفتاح توقيع: `keytool -genkey -v -keystore bak.jks -keyalg RSA -keysize 2048 -validity 10000 -alias bak`
- [ ] ضبط التوقيع في `android/app/build.gradle` (قسم `signingConfigs`)
- [ ] تجهيز لقطات شاشة ووصف عربي وسياسة خصوصية (إلزامية في Play Console)
- [ ] رسوم حساب مطوّر Google Play: ‏٢٥$ لمرة واحدة

> ملفات المفاتيح (`*.jks` / `*.keystore`) مستثناة من Git — احتفظ بها في مكان آمن، فقدانها يعني عدم القدرة على تحديث التطبيق لاحقاً.

## iOS

لإضافة نسخة آيفون لاحقاً (تتطلب جهاز Mac وحساب Apple Developer بـ ‏٩٩$ سنوياً):

```powershell
npm install @capacitor/ios
npx cap add ios
```
