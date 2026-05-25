# git-fast (`gf`)

快速切换 git 账户与提交信息的命令行工具。

## 安装

```bash
cargo install --path .
```

安装后可直接使用 `gf` 命令。

## 功能

| 命令 | 说明 |
|------|------|
| `gf status` | 查看当前 git 身份和所有已保存的 Profiles |
| `gf use <alias>` | 切换当前仓库的 git 账户 |
| `gf use <alias> --global` | 切换全局 git 账户（~/.gitconfig） |
| `gf profile add` | 添加新 Profile |
| `gf profile update` | 更新已有 Profile |
| `gf profile remove` | 删除 Profile |
| `gf profile list` | 列出所有 Profile |
| `gf commit -m <msg>` | 快速 git commit |

## 快速上手

```bash
# 添加工作账户和个人账户
gf profile add work  -n "张三" -e "zhangsan@company.com"
gf profile add home  -n "张三" -e "zhangsan@gmail.com"

# 切换当前仓库账户
gf use work

# 切换全局账户
gf use home --global

# 查看当前状态
gf status

# 快速提交（提交前自动切换 Profile）
gf commit -m "feat: 新增功能" --profile work

# 带 -a 自动 stage 所有变更
gf commit -m "fix: 修复问题" -a
```

## 配置文件

Profiles 存储在系统配置目录：

- **Windows**: `%APPDATA%\git-fast\config.toml`
- **macOS/Linux**: `~/.config/git-fast/config.toml`

格式示例：

```toml
[profiles.work]
name = "张三"
email = "zhangsan@company.com"

[profiles.home]
name = "张三"
email = "zhangsan@gmail.com"
signing_key = "ABC123DEF"
```
