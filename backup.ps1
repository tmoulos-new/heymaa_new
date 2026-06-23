$ts = Get-Date -Format "yyyyMMdd_HHmm"
$dst = "C:\heymaa\backups\$ts"
New-Item -ItemType Directory -Path $dst -Force | Out-Null
Copy-Item "C:\heymaa\backend\main.py" "$dst\main.py"
Copy-Item "C:\heymaa\backend\admin.html" "$dst\admin.html"
Copy-Item "C:\heymaa\backend\.env" "$dst\.env"
Copy-Item "C:\heymaa\App.tsx" "$dst\App.tsx"
Copy-Item "C:\heymaa\Clouflare Heymaa\index.html" "$dst\index.html"
Write-Host "✅ Backup OK → $dst"
