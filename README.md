# HaruhikageGit (`hg`)

快速切换 git 账户与提交信息的命令行工具。

## 安装

```bash
cargo install --path .
```

安装后可直接使用 `hg` 命令。

## 功能

| 命令 | 说明 |
|------|------|
| `hg status` | 查看当前 git 身份和所有已保存的 Profiles |
| `hg use <alias>` | 切换当前仓库的 git 账户 |
| `hg use <alias> --global` | 切换全局 git 账户（~/.gitconfig） |
| `hg profile add` | 添加新 Profile |
| `hg profile update` | 更新已有 Profile |
| `hg profile remove` | 删除 Profile |
| `hg profile list` | 列出所有 Profile |
| `hg commit -m <msg>` | 快速 git commit |

## 快速上手

```bash
# 添加工作账户和个人账户
hg profile add work  -n "张三" -e "zhangsan@company.com"
hg profile add home  -n "张三" -e "zhangsan@gmail.com"

# 切换当前仓库账户
hg use work

# 切换全局账户
hg use home --global

# 查看当前状态
hg status

# 快速提交（提交前自动切换 Profile）
hg commit -m "feat: 新增功能" --profile work

# 带 -a 自动 stage 所有变更
hg commit -m "fix: 修复问题" -a
```

## 配置文件

Profiles 存储在系统配置目录：

- **Windows**: `%USERPROFILE%\.haruhikage-git\config.toml`
- **macOS/Linux**: `~/.haruhikage-git/config.toml`

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
