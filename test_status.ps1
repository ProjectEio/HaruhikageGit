# 模拟 Rust 的 line[3..] 操作
$output = git -C "e:\NewDevelop\git-fast" status --porcelain
foreach ($line in $output) {
    if ($line.Length -ge 4) {
        $indexChar = $line[0]
        $workChar = $line[1]
        # Rust line[3..] 等价于 PowerShell $line.Substring(3)
        $rawPath = $line.Substring(3)
        $filePath = $rawPath.Trim()
        Write-Host "Line: '$line' | index='$indexChar' work='$workChar' path='$filePath'"
    }
}
