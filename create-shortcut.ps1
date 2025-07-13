$desktop = [Environment]::GetFolderPath('Desktop')
$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$desktop\Audio Gemini TTS.lnk")
$Shortcut.TargetPath = "C:\Projects\audio-gemini\run-tts.bat"
$Shortcut.WorkingDirectory = "C:\Projects\audio-gemini"
$Shortcut.Description = "Converte texto em audio usando Google Gemini TTS"
$Shortcut.Save()
Write-Host "Atalho criado com sucesso na area de trabalho: $desktop\Audio Gemini TTS.lnk"