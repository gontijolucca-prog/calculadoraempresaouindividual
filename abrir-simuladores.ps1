# Script para abrir os Simuladores Recofátima como uma aplicação nativa no Windows
# Não requer instalação. Basta clicar com o botão direito e "Executar com o PowerShell".

$url = "https://recofatima.github.io/recofatima-simuladores-v1/"
$edgePath = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"

if (-not (Test-Path $edgePath)) {
    $edgePath = "${env:ProgramFiles}\Microsoft\Edge\Application\msedge.exe"
}

if (Test-Path $edgePath) {
    Start-Process $edgePath -ArgumentList "--app=$url", "--window-size=1280,800"
} else {
    Write-Host "Microsoft Edge não encontrado. A abrir no browser predefinido..."
    Start-Process $url
}
