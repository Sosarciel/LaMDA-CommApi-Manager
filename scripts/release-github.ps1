function GetFiles($pkg) {
    if ($pkg.files) {
        # 确保 package.json 一定在列表里
        $list = @($pkg.files)
        if ($list -notcontains "package.json") {
            $list += "package.json"
            $list += "README.md"
        }
        return $list
    }else{
        # 如果未指定 files 字段，使用常见默认值
        throw "package.json 中缺少 files 字段"
    }
}

# release 分支名
$ReleaseBranch = "release"
# release 目录名
$ReleaseDir = "release"

# 1) 读取 package.json
Write-Host "== 读取 package.json =="
if (-not (Test-Path "./package.json")) { throw "当前目录下未找到 package.json" }

$pkg = Get-Content "./package.json" -Raw -Encoding UTF8 | ConvertFrom-Json

$ProjectName = $pkg.name
if (-not $ProjectName) { throw "package.json 中缺少 name 字段" }

$version = $pkg.version
if (-not $version) { throw "package.json 中缺少 version 字段" }

# 获取远端 URL
$RepoUrl = git remote get-url origin
if (-not $RepoUrl) { throw "未找到 Git 远端 origin" }
$files = GetFiles $pkg

$tagName   = "$version"
$latestTag = "latest"

Write-Host "项目名称: $ProjectName"
Write-Host "版本号:   $version"
Write-Host "仓库地址: $RepoUrl"
Write-Host "分支:     $ReleaseBranch"
Write-Host "标签:     $tagName"
Write-Host "文件列表: $($files -join ', ')"

# 3) 克隆仓库
Write-Host "== 检查 release 目录 =="
if (-not (Test-Path "./$ReleaseDir")) {
    Write-Host "$ReleaseDir 目录不存在，开始克隆仓库..."
    git clone $RepoUrl $ReleaseDir --depth=1 | Write-Host
    if ($LASTEXITCODE -ne 0) { throw "git clone 失败" }
}

Push-Location $ReleaseDir -ErrorAction Stop

# 获取当前物理路径，并统一转化为 Unix 风格的正斜杠
# 使用 FullName 确保获取到的是绝对路径，并通过 Replace 转换
$currentPath = (Get-Location).Path.Replace('\', '/').TrimEnd('/')

# 获取 Git 认为的根目录
$gitRoot = (git rev-parse --show-toplevel 2>$null).TrimEnd('/')

# 检查是否为有效的 git 仓库
if ($currentPath -ne $gitRoot) { throw "$ReleaseDir 目录存在但不是有效的 git 仓库" }

# 4) 切换或创建 release 分支
Write-Host "== 切换到 release 分支 =="
git checkout $ReleaseBranch 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "$ReleaseBranch 分支不存在，正在创建..."
    git checkout -b $ReleaseBranch | Write-Host
    if ($LASTEXITCODE -ne 0) { throw "无法创建 $ReleaseBranch 分支" }
}

# 5) 清空分支内容
Write-Host "== 清空 release 分支内容 =="
# 删除文件
Get-ChildItem -Force | ForEach-Object {
    if ($_.Name -notin @(".git")) {
        try { Remove-Item -Recurse -Force $_.FullName } catch {
            throw "无法删除文件: $($_.FullName)"
        }
    }
}

# 6) 复制 package.json 中 files 列表的文件
Write-Host "== 复制 package.json 中 files 列表的文件 =="
foreach ($f in $files) {
    $src = Join-Path ".." $f
    if (Test-Path $src) {
        Write-Host "复制: $src"
        Copy-Item $src -Recurse -Force -Destination "."
    } else {
        Write-Host "$src 不存在，跳过"
    }
}

# 7) 添加、提交并推送
Write-Host "== 添加并提交 =="
git add .
$commitOutput = git commit -m "release" 2>&1
if ($LASTEXITCODE -ne 0 -and ($commitOutput -match "nothing to commit")) {
    Write-Host "没有需要提交的变更，继续后续步骤"
} else {
    Write-Host $commitOutput
}
git push origin $ReleaseBranch | Write-Host

# 8) 创建版本标签并推送
Write-Host "== 创建版本标签 =="
git tag -f $tagName | Write-Host
git push -f origin $tagName | Write-Host

# 9) 检查/创建 latest 标签
Write-Host "== 更新 latest 标签指向当前版本 =="
git tag -f $latestTag $tagName | Write-Host
git push -f origin $latestTag | Write-Host
Pop-Location