/**
 * ضبط وضع تشغيل تطبيق أندرويد: حيّ من الإنترنت، أو مضمّن أوفلاين.
 *
 *   npm run live -- https://main.d123abc.amplifyapp.com   ← يحمّل الموقع الحيّ
 *   npm run live -- off                                    ← يعود للنسخة المضمّنة
 *   npm run live                                           ← يعرض الوضع الحالي
 *
 * الوضع الحيّ يعني: أي تعديل أو صورة تُنشر على الموقع تظهر في التطبيق
 * بمجرّد إعادة فتحه — بلا إعادة بناء APK. وعامل الخدمة يخزّن الموقع
 * محلياً في أول تشغيل، فيبقى التطبيق يعمل بدون إنترنت.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const file = join(here, 'capacitor.config.json');

/* علامة تُخبر الموقع أنه يعمل داخل التطبيق (شريط سفلي، بلا لافتة تثبيت) */
const APP_FLAG = 'app=1';

function withFlag(raw) {
  const url = new URL(raw);
  if (url.protocol !== 'https:') {
    throw new Error('الرابط يجب أن يبدأ بـ https — أندرويد يمنع http بلا تشفير.');
  }
  url.searchParams.set('app', '1');
  return url.toString();
}

async function main() {
  const arg = process.argv[2];
  const config = JSON.parse(await readFile(file, 'utf8'));
  config.server = config.server || { androidScheme: 'https' };

  if (!arg) {
    console.log(config.server.url
      ? `الوضع الحالي: حيّ من الإنترنت\n  ${config.server.url}`
      : 'الوضع الحالي: نسخة مضمّنة داخل التطبيق (أوفلاين)');
    console.log('\nللتغيير:\n  npm run live -- https://your-site.amplifyapp.com\n  npm run live -- off');
    return;
  }

  if (arg === 'off' || arg === 'bundled') {
    delete config.server.url;
    delete config.server.cleartext;
    await writeFile(file, JSON.stringify(config, null, 2) + '\n', 'utf8');
    console.log('✓ التطبيق سيعمل من الملفات المضمّنة (أوفلاين)');
    console.log('  شغّل بعدها:  npm run sync');
    return;
  }

  const url = withFlag(arg);
  config.server.url = url;
  config.server.cleartext = false;
  await writeFile(file, JSON.stringify(config, null, 2) + '\n', 'utf8');

  console.log(`✓ التطبيق سيحمّل الموقع الحيّ:\n  ${url}`);
  console.log(`\n  العلامة ${APP_FLAG} تجعل الموقع يعرف أنه داخل التطبيق.`);
  console.log('  شغّل بعدها:  npm run sync   ثم أعد بناء التطبيق مرة واحدة.');
  console.log('  بعد ذلك كل تحديث للموقع يظهر في التطبيق بلا إعادة بناء.');
}

main().catch((err) => {
  console.error('فشل الضبط:', err.message);
  process.exit(1);
});
