param(
  [int]$Port = 8123
)

$root = $PSScriptRoot
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$Port/")

try {
  $listener.Start()
} catch {
  Write-Host "Не удалось запустить сервер на порту $Port : $($_.Exception.Message)"
  exit 1
}

Write-Host "Локальный сервер: http://127.0.0.1:$Port/"
Write-Host "Папка: $root"
Write-Host "Остановка: Ctrl+C"

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.png'  = 'image/png'
  '.svg'  = 'image/svg+xml'
  '.ico'  = 'image/x-icon'
}

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
  } catch {
    break
  }

  $path = $ctx.Request.Url.LocalPath.TrimStart('/')
  if ([string]::IsNullOrWhiteSpace($path)) { $path = 'index.html' }

  $file = Join-Path $root $path
  $resolved = [System.IO.Path]::GetFullPath($file)
  $rootFull = [System.IO.Path]::GetFullPath($root)

  if ($resolved.StartsWith($rootFull.TrimEnd('\') + '\', [System.StringComparison]::OrdinalIgnoreCase) -and (Test-Path $resolved -PathType Leaf)) {
    $ext = [System.IO.Path]::GetExtension($resolved).ToLowerInvariant()
    $ctx.Response.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
    try {
      $bytes = [System.IO.File]::ReadAllBytes($resolved)
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } catch {
      # клиент отвалился — сервер продолжает работать
    }
  } else {
    $ctx.Response.StatusCode = 404
    $body = [System.Text.Encoding]::UTF8.GetBytes('Not found')
    $ctx.Response.OutputStream.Write($body, 0, $body.Length)
  }

  $ctx.Response.Close()
}
