/**
 * نسخ ملفات الموقع من جذر المستودع إلى app/www
 * لتغليفها داخل تطبيق Capacitor.
 *
 * التشغيل:  npm run sync-web
 */
import { cp, rm, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const www  = join(here, 'www');

/* الملفات والمجلدات التي تُنسخ إلى التطبيق */
const ASSETS = [
  'index.html',
  'offline.html',
  'manifest.webmanifest',
  'css',
  'js',
  'icons',
  'images'
];

/* عامل الخدمة لا لزوم له داخل التطبيق — المحتوى مضمّن أصلاً */
const SKIP_IN_APP = ['sw.js'];

async function main() {
  await rm(www, { recursive: true, force: true });
  await mkdir(www, { recursive: true });

  let copied = 0;
  for (const asset of ASSETS) {
    const src = join(root, asset);
    if (!existsSync(src)) {
      console.log(`  تخطّي (غير موجود): ${asset}`);
      continue;
    }
    await cp(src, join(www, asset), { recursive: true });
    console.log(`  ✓ ${asset}`);
    copied++;
  }

  await patchIndex();

  console.log(`\nتم نسخ ${copied} عنصراً إلى app/www`);
  console.log(`(تم تخطّي: ${SKIP_IN_APP.join(', ')} — غير مطلوب داخل التطبيق)`);
}

/**
 * داخل التطبيق الأصلي لا نسجّل عامل الخدمة ولا نعرض لافتة التثبيت،
 * ونضيف الصنف is-app ليظهر شريط التنقّل السفلي دائماً.
 */
async function patchIndex() {
  const file = join(www, 'index.html');
  if (!existsSync(file)) return;

  let html = await readFile(file, 'utf8');

  html = html.replace('<body>', '<body class="is-app" data-native="1">');
  html = html.replace(
    '<script src="js/main.js"></script>',
    '<script>window.__NATIVE_APP__ = true;</script>\n  <script src="js/main.js"></script>'
  );

  await writeFile(file, html, 'utf8');
  console.log('  ✓ تهيئة index.html لوضع التطبيق');
}

main().catch((err) => {
  console.error('فشل النسخ:', err);
  process.exit(1);
});
