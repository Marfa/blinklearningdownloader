$url = "https://www.blinklearning.com/v/1778658518/themes/tmpux/launch.php"
$html = Invoke-WebRequest -Uri $url -UseBasicParsing
$html.Content | Out-File -FilePath "launch.html" -Encoding utf8
Select-String -Path "launch.html" -Pattern "form|action|name=|input|login|email|password" -AllMatches | ForEach-Object { $_.Line.Trim() } | Select-Object -First 50
