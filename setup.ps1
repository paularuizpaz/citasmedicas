$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Host 'Node.js no está instalado o no está en el PATH.' -ForegroundColor Yellow
    Write-Host 'Instala Node.js LTS desde: https://nodejs.org/' -ForegroundColor Yellow
    Write-Host 'Luego vuelve a ejecutar este script.' -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path '.env')) {
    Copy-Item '.env.example' '.env'
    Write-Host 'Se creó el archivo .env desde .env.example' -ForegroundColor Green
    Write-Host 'Edita .env con tu correo Gmail y la contraseña de aplicación.' -ForegroundColor Green
}

npm install
npm start
