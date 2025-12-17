

# --- 配置：需要转换的包映射表 ---
$GitDeps = @{
    "@sosraciel-lamda/kook-protoclient"     = "github:Sosarciel/LaMDA-KOOK-ProtoClient#latest"
    "@sosraciel-lamda/onebot11-protoclient" = "github:Sosarciel/LaMDA-OneBot11-ProtoClient#latest"
}
$pkgPath = "./package.json"

# 1) 读取并备份原始 package.json
$originalJson = Get-Content $pkgPath -Raw -Encoding UTF8
$pkg = $originalJson | ConvertFrom-Json

try{
    # 遍历并重写依赖
    foreach ($depName in $GitDeps.Keys) {
        if ($pkg.dependencies.$depName) {
            Write-Host "重写依赖: $depName -> $($GitDeps[$depName])" -ForegroundColor Cyan
            $pkg.dependencies.$depName = $GitDeps[$depName]
        }
    }

    # 覆写到磁盘 (注意：必须使用 UTF8NoBOM 避免一些工具解析 JSON 报错)
    $publishJson = $pkg | ConvertTo-Json -Depth 100
    Set-Content -Path $pkgPath -Value $publishJson -Encoding UTF8

    scripts/release-github
}catch{
    Write-Error "发布过程中出现错误: $($_.Exception.Message)"
}finally {
    # 4) 无论成功还是失败，绝对会执行还原
    Write-Host "== 还原原始 package.json ==" -ForegroundColor Green
    Set-Content -Path $pkgPath -Value $originalJson -Encoding UTF8
}

