## Restart dev:all to pick up the fix. Same sequence as last time (cleans up any zombie/hung process before relaunching):

  Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }

  Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }

  -- Remove-Item dev.log -ErrorAction SilentlyContinue

  npm run dev:all 2>&1 | Tee-Object dev.log