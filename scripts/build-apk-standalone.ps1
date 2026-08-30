# Automated Ultra-Fast Android SDK & APK Builder
$ErrorActionPreference = "Stop"

$sdkDir = "$env:LOCALAPPDATA\Android\Sdk"
$platformsDir = "$sdkDir\platforms\android-34"
$buildToolsDir = "$sdkDir\build-tools\34.0.0"
$licensesDir = "$sdkDir\licenses"

Write-Host "Passo 1/4: Aceitando licensas do Android..." -ForegroundColor Cyan
if (!(Test-Path $licensesDir)) { New-Item -ItemType Directory -Force -Path $licensesDir | Out-Null }
@'
24333f8a63b6825ea9c5514f83c2829b004d1fee
89337d1250779021b3668112e98f14918d234742
d56f5185547b52ab68b64a71738db82dce4e2468
84831b9409646a918e30573bab4c9c91346d8abd
'@ | Set-Content -Path "$licensesDir\android-sdk-license" -Force

$escapedSdk = $sdkDir.Replace('\', '\\')
$localProps = "c:\Users\mateu\Downloads\gdisc\gdisc\apps\mobile\android\local.properties"
Set-Content -Path $localProps -Value "sdk.dir=$escapedSdk"
Write-Host "Passo 2/4: Configurado local.properties" -ForegroundColor Green

# 1. Download Android Platform 34 if not present
if (!(Test-Path "$platformsDir\android.jar")) {
    Write-Host "Passo 3/4: Baixando Android Platform 34 (~65MB)..." -ForegroundColor Cyan
    $platformZip = "$env:TEMP\platform-34.zip"
    curl.exe -L -o $platformZip "https://dl.google.com/android/repository/platform-34_r02.zip"
    
    $tempP = "$env:TEMP\plat-temp"
    if (Test-Path $tempP) { Remove-Item -Recurse -Force $tempP }
    Expand-Archive -Path $platformZip -DestinationPath $tempP -Force
    
    if (!(Test-Path "$sdkDir\platforms")) { New-Item -ItemType Directory -Force -Path "$sdkDir\platforms" | Out-Null }
    Move-Item -Path "$tempP\android-34" -Destination $platformsDir -Force
    Remove-Item -Force $platformZip
    if (Test-Path $tempP) { Remove-Item -Recurse -Force $tempP }
}

# 2. Download Android Build-Tools 34.0.0 if not present
if (!(Test-Path "$buildToolsDir\aapt2.exe")) {
    Write-Host "Passo 3/4 (cont): Baixando Build-Tools 34.0.0 (~52MB)..." -ForegroundColor Cyan
    $btZip = "$env:TEMP\build-tools-34.zip"
    curl.exe -L -o $btZip "https://dl.google.com/android/repository/build-tools_r34-windows.zip"
    
    $tempBT = "$env:TEMP\bt-temp"
    if (Test-Path $tempBT) { Remove-Item -Recurse -Force $tempBT }
    Expand-Archive -Path $btZip -DestinationPath $tempBT -Force
    
    if (!(Test-Path "$sdkDir\build-tools")) { New-Item -ItemType Directory -Force -Path "$sdkDir\build-tools" | Out-Null }
    Move-Item -Path "$tempBT\android-14" -Destination $buildToolsDir -Force
    Remove-Item -Force $btZip
    if (Test-Path $tempBT) { Remove-Item -Recurse -Force $tempBT }
}

Write-Host "Passo 4/4: Compilando APK do GDisC com Gradle..." -ForegroundColor Cyan
$gradleBat = "c:\Users\mateu\Downloads\gdisc\gdisc\apps\mobile\android\gradlew.bat"
$androidDir = "c:\Users\mateu\Downloads\gdisc\gdisc\apps\mobile\android"

Start-Process -FilePath $gradleBat -ArgumentList "assembleDebug", "--no-daemon" -WorkingDirectory $androidDir -Wait -NoNewWindow

$apkSource = "c:\Users\mateu\Downloads\gdisc\gdisc\apps\mobile\android\app\build\outputs\apk\debug\app-debug.apk"
$distDir = "c:\Users\mateu\Downloads\gdisc\gdisc\dist-android"

if (Test-Path $apkSource) {
    if (!(Test-Path $distDir)) { New-Item -ItemType Directory -Force -Path $distDir | Out-Null }
    Copy-Item -Path $apkSource -Destination "$distDir\GDisC-1.0.0-debug.apk" -Force
    Write-Host "🎉 SUCESSO! APK gerado com sucesso em: $distDir\GDisC-1.0.0-debug.apk" -ForegroundColor Green
} else {
    Write-Host "Verifique a saida do Gradle acima." -ForegroundColor Yellow
}
