# 部署 getReply 云函数（需已安装微信开发者工具并登录）
# 用法示例：
#   $env:envId = "cloud1-9goe0m7d1d397415"
#   $env:projectPath = "D:\WORK区\xiaoqi-xiaolin-focus-engine"
#   $env:installPath = "C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat"
#   .\uploadGetReply.ps1

$ErrorActionPreference = "Stop"
$envId = if ($env:envId) { $env:envId } else { "cloud1-9goe0m7d1d397415" }
$projectPath = if ($env:projectPath) { $env:projectPath } else { $PSScriptRoot }
$installPath = $env:installPath

if (-not $installPath -or -not (Test-Path $installPath)) {
  $candidates = @(
    "${env:ProgramFiles(x86)}\Tencent\微信web开发者工具\cli.bat",
    "${env:LOCALAPPDATA}\微信开发者工具\cli.bat"
  )
  foreach ($c in $candidates) {
    if (Test-Path $c) { $installPath = $c; break }
  }
}

if (-not $installPath -or -not (Test-Path $installPath)) {
  Write-Host "未找到微信开发者工具 cli.bat，请设置环境变量 installPath" -ForegroundColor Red
  Write-Host "或在开发者工具中：cloudfunctions/getReply -> 右键 -> 上传并部署：云端安装依赖"
  exit 1
}

Write-Host "安装 getReply 依赖..."
Push-Location (Join-Path $projectPath "cloudfunctions\getReply")
npm install --omit=dev
Pop-Location

Write-Host "部署 getReply 到环境 $envId ..."
& $installPath cloud functions deploy --e $envId --n getReply --r --project $projectPath
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "getReply 部署完成。请在云开发控制台确认集合 taskReply 已导入数据。" -ForegroundColor Green
