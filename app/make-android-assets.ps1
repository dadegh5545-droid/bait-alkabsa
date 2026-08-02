# =============================================================================
#  توليد أيقونات وشاشات بداية أندرويد لتطبيق بيت الكبسة
#  التشغيل:  powershell -ExecutionPolicy Bypass -File make-android-assets.ps1
# =============================================================================

Add-Type -AssemblyName System.Drawing

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$res  = Join-Path $here "android\app\src\main\res"

if (-not (Test-Path $res)) {
  Write-Error "مجلد android غير موجود. شغّل أولاً:  npm run add:android"
  exit 1
}

$BROWN_A = [System.Drawing.Color]::FromArgb(74, 45, 24)
$BROWN_B = [System.Drawing.Color]::FromArgb(36, 21, 12)
$GOLD_A  = [System.Drawing.Color]::FromArgb(227, 196, 119)
$GOLD_B  = [System.Drawing.Color]::FromArgb(181, 133, 31)

# ---------------------------------------------------------------- رسم الشعار
# الشعار الحقيقي من images/logo.png — دائرةٌ بيضاء فيها البيت والشجرتان
# واسم المطبخ. كان هنا رسمٌ برمجيّ لصحنٍ وحبّة أرز لا وجود لهما في شعار
# المطبخ، فكانت أيقونة التطبيق تخالف ما يراه الزبون في رأس الموقع.
$logoFile = Join-Path (Split-Path -Parent $here) "images\logo.png"
if (-not (Test-Path $logoFile)) {
  Write-Error "الشعار غير موجود: $logoFile"
  exit 1
}
$LOGO = [System.Drawing.Image]::FromFile($logoFile)

function Draw-Logo($g, [double]$box, [double]$ox, [double]$oy) {
  $g.DrawImage($LOGO, [single]$ox, [single]$oy, [single]$box, [single]$box)
}

function New-Canvas([int]$w, [int]$h) {
  $bmp = New-Object System.Drawing.Bitmap($w, $h)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.InterpolationMode = 'HighQualityBicubic'
  return @($bmp, $g)
}

function Fill-Brown($g, [int]$w, [int]$h) {
  $r = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
  $b = New-Object System.Drawing.Drawing2D.LinearGradientBrush($r, $BROWN_A, $BROWN_B, 45.0)
  $g.FillRectangle($b, $r)
}

# ------------------------------------------------------- أيقونة مربّعة/دائرية
function New-Launcher([int]$size, [string]$path, [string]$shape) {
  $c = New-Canvas $size $size
  $bmp = $c[0]; $g = $c[1]
  $r = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
  $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush($r, $BROWN_A, $BROWN_B, 45.0)

  if ($shape -eq 'round') {
    $g.FillEllipse($bg, 0, 0, $size, $size)
  } else {
    $rad = [int]($size * 0.22)
    $gp = New-Object System.Drawing.Drawing2D.GraphicsPath
    $gp.AddArc(0, 0, $rad * 2, $rad * 2, 180, 90)
    $gp.AddArc($size - $rad * 2, 0, $rad * 2, $rad * 2, 270, 90)
    $gp.AddArc($size - $rad * 2, $size - $rad * 2, $rad * 2, $rad * 2, 0, 90)
    $gp.AddArc(0, $size - $rad * 2, $rad * 2, $rad * 2, 90, 90)
    $gp.CloseFigure()
    $g.FillPath($bg, $gp)
  }

  $inner = $size * 0.72
  Draw-Logo $g $inner (($size - $inner) / 2) (($size - $inner) / 2)

  $g.Dispose()
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

# ------------------------------- الطبقة الأمامية للأيقونة التكيّفية (شفافة)
function New-Foreground([int]$size, [string]$path) {
  $c = New-Canvas $size $size
  $bmp = $c[0]; $g = $c[1]
  # المنطقة الآمنة في الأيقونات التكيّفية ≈ 66% من المساحة
  $inner = $size * 0.50
  Draw-Logo $g $inner (($size - $inner) / 2) (($size - $inner) / 2)
  $g.Dispose()
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

# ------------------------------------------------------------- شاشة البداية
function New-Splash([int]$w, [int]$h, [string]$path) {
  $c = New-Canvas $w $h
  $bmp = $c[0]; $g = $c[1]
  Fill-Brown $g $w $h
  $box = [Math]::Min($w, $h) * 0.34
  Draw-Logo $g $box (($w - $box) / 2) (($h - $box) / 2)
  $g.Dispose()
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

# ================================================================== التنفيذ
$densities = @{ 'mdpi' = 1; 'hdpi' = 1.5; 'xhdpi' = 2; 'xxhdpi' = 3; 'xxxhdpi' = 4 }

foreach ($d in $densities.Keys) {
  $f = $densities[$d]
  $dir = Join-Path $res "mipmap-$d"
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }

  New-Launcher   ([int](48 * $f))  (Join-Path $dir "ic_launcher.png")            'square'
  New-Launcher   ([int](48 * $f))  (Join-Path $dir "ic_launcher_round.png")      'round'
  New-Foreground ([int](108 * $f)) (Join-Path $dir "ic_launcher_foreground.png")
  Write-Host "  ✓ mipmap-$d"
}

$splashes = @{
  'drawable-port-mdpi'    = @(320, 480)
  'drawable-port-hdpi'    = @(480, 800)
  'drawable-port-xhdpi'   = @(720, 1280)
  'drawable-port-xxhdpi'  = @(960, 1600)
  'drawable-port-xxxhdpi' = @(1280, 1920)
  'drawable-land-mdpi'    = @(480, 320)
  'drawable-land-hdpi'    = @(800, 480)
  'drawable-land-xhdpi'   = @(1280, 720)
  'drawable-land-xxhdpi'  = @(1600, 960)
  'drawable-land-xxxhdpi' = @(1920, 1280)
  'drawable'              = @(1920, 1280)
}

foreach ($d in $splashes.Keys) {
  $dir = Join-Path $res $d
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
  $dim = $splashes[$d]
  New-Splash $dim[0] $dim[1] (Join-Path $dir "splash.png")
  Write-Host "  ✓ $d"
}

# ------------------------------------------------- أيقونات الموقع والمتجر
# كانت تُصنع بيدٍ منفصلة فتخالف أيقونة التطبيق. صارت من الشعار نفسه
# ومن هذا السكربت، فلا تفترق نسختان لعلامةٍ واحدة.
$web = Join-Path (Split-Path -Parent $here) "icons"
if (-not (Test-Path $web)) { New-Item -ItemType Directory -Path $web | Out-Null }

New-Launcher 192 (Join-Path $web "icon-192.png") 'square'
New-Launcher 512 (Join-Path $web "icon-512.png") 'square'
Write-Host "  ✓ icons/icon-192.png، icon-512.png"

# القاذف يقصّ الأيقونة القابلة للقصّ دائرةً أو مربّعاً مستديراً، فيبقى
# المضمون داخل ٨٠٪ الوسطى: الخلفية تملأ المربّع كلّه والشعار أصغر.
function New-Maskable([int]$size, [string]$path) {
  $c = New-Canvas $size $size
  $bmp = $c[0]; $g = $c[1]
  Fill-Brown $g $size $size
  $inner = $size * 0.58
  Draw-Logo $g $inner (($size - $inner) / 2) (($size - $inner) / 2)
  $g.Dispose()
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}
New-Maskable 512 (Join-Path $web "icon-maskable-512.png")
Write-Host "  ✓ icons/icon-maskable-512.png"

# أيقونة جوجل بلاي: ٥١٢×٥١٢ مربّعة بلا زوايا مستديرة — المتجر يقصّها بنفسه
$store = New-Canvas 512 512
$sb = $store[0]; $sg = $store[1]
Fill-Brown $sg 512 512
Draw-Logo $sg (512 * 0.72) (512 * 0.14) (512 * 0.14)
$sg.Dispose()
$sb.Save((Join-Path $web "play-store-512.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$sb.Dispose()
Write-Host "  ✓ icons/play-store-512.png (لرفعها في جوجل بلاي)"

$LOGO.Dispose()
Write-Host "`nاكتمل توليد أيقونات التطبيق والموقع وشاشات البداية." -ForegroundColor Green
