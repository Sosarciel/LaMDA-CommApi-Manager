

# --- 配置：需要转换的包映射表 ---
$GitDeps = @{
    "@sosraciel-lamda/kook-protoclient"     = "github:Sosarciel/LaMDA-KOOK-ProtoClient#latest"
    "@sosraciel-lamda/onebot11-protoclient" = "github:Sosarciel/LaMDA-OneBot11-ProtoClient#latest"
}
$pkgPath = "./package.json"

# 1) 读取并备份原始 package.json
$originalJson = Get-Content $pkgPath -Raw -Encoding UTF8
$publishJson = $originalJson

try{
    # 遍历并重写依赖
    foreach ($depName in $GitDeps.Keys) {
        $newTarget = $GitDeps[$depName]
        $pattern = "(?m)(^\s*`"$depName`"\s*:\s*`")[^`"]+(`")"
        if ($publishJson -match $pattern) {
            Write-Host "替换: $depName" -ForegroundColor Cyan
            $publishJson = $publishJson -replace $pattern, "`$1$newTarget`$2"
        }
    }
    Set-Content -Path $pkgPath -Value $publishJson.Trim() -Encoding UTF8

    scripts/release-github
}catch{
    Write-Error "发布过程中出现错误: $($_.Exception.Message)"
}finally {
    # 4) 无论成功还是失败，绝对会执行还原
    Write-Host "== 还原原始 package.json ==" -ForegroundColor Green
    Set-Content -Path $pkgPath -Value $originalJson.Trim() -Encoding UTF8
}

