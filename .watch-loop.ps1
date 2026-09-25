$ErrorActionPreference = "SilentlyContinue"
$statusPath = "D:\Project\中科安樵\.watch-status.json"
$paths = @(
  "D:\Project\中科安樵\anqiao-console",
  "D:\Project\中科安樵\anqiao-dashboard",
  "D:\Project\中科安樵\suqian-dashboard"
)
$exclude = "node_modules|dist|\.git|__pycache__|\.tsbuildinfo$"
$newest0 = Get-ChildItem -Recurse -File -Path $paths -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch $exclude } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
$baselineMtime = if ($newest0) { $newest0.LastWriteTime } else { Get-Date }
$stallStreak = 0
$deadStreak = 0
$deadline = (Get-Date).AddMinutes(55)
$result = [ordered]@{
  status = "running"
  started_at = (Get-Date).ToString("o")
  last_check = $null
  newest_path = $null
  newest_mtime = $null
  alive_pids = @()
  stall_streak = 0
  dead_streak = 0
  alert = $null
}
while ((Get-Date) -lt $deadline) {
  $now = Get-Date
  $procs = @(Get-Process -Name "Kimi Code","codex-windows-sandbox-service" -ErrorAction SilentlyContinue)
  $alive = @($procs | ForEach-Object { $_.Id })
  $newest = Get-ChildItem -Recurse -File -Path $paths -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch $exclude } |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
  $result.last_check = $now.ToString("o")
  $result.alive_pids = $alive
  if ($newest) {
    $result.newest_path = $newest.FullName
    $result.newest_mtime = $newest.LastWriteTime.ToString("o")
  }
  if ($procs.Count -eq 0) { $deadStreak++ } else { $deadStreak = 0 }
  if ($newest -and $newest.LastWriteTime -gt $baselineMtime) {
    $baselineMtime = $newest.LastWriteTime
    $stallStreak = 0
  } else { $stallStreak++ }
  $result.stall_streak = $stallStreak
  $result.dead_streak = $deadStreak
  if ($deadStreak -ge 3) {
    $result.status = "stopped"
    $result.alert = "trigger=A: processes gone for 3 checks at $($now.ToString('o'))"
    break
  }
  if ($stallStreak -ge 15) {
    $result.status = "stalled"
    $result.alert = "trigger=B: no new file mtime for 15 minutes at $($now.ToString('o')); newest=$($result.newest_path)@$($result.newest_mtime)"
    break
  }
  $result | ConvertTo-Json -Depth 5 | Set-Content -Path $statusPath -Encoding UTF8
  Start-Sleep -Seconds 60
}
if ($result.status -eq "running") {
  $result.status = "timeout_still_alive"
  $result.alert = "55min window elapsed without stop condition"
}
$result | ConvertTo-Json -Depth 5 | Set-Content -Path $statusPath -Encoding UTF8
