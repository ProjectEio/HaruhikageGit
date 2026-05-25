use anyhow::{bail, Context, Result};
use std::io::Write;
use std::process::{Command, Output, Stdio};

fn run_git(args: &[&str]) -> Result<Output> {
    Command::new("git")
        .args(args)
        .output()
        .context("执行 git 命令失败，请确认 git 已安装并在 PATH 中")
}

fn git_output(args: &[&str]) -> Result<String> {
    let out = run_git(args)?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
    } else {
        let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
        bail!("{}", stderr)
    }
}

/// 设置 git config（local 或 global）
pub fn set_config(key: &str, value: &str, global: bool) -> Result<()> {
    let scope = if global { "--global" } else { "--local" };
    let out = run_git(&["config", scope, key, value])?;
    if out.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
        bail!("{}", stderr)
    }
}

/// 获取指定作用域的 git config 值
pub fn get_config_scoped(key: &str, global: bool) -> Option<String> {
    let scope = if global { "--global" } else { "--local" };
    git_output(&["config", scope, key])
        .ok()
        .filter(|s| !s.is_empty())
}

/// 判断当前目录是否在 git 仓库中
pub fn is_git_repo() -> bool {
    run_git(&["rev-parse", "--git-dir"])
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// 执行 git commit
pub fn commit(message: &str, all: bool) -> Result<()> {
    let mut args = vec!["commit", "-m", message];
    if all {
        args.push("-a");
    }
    let status = Command::new("git")
        .args(&args)
        .status()
        .context("执行 git commit 失败")?;
    if status.success() {
        Ok(())
    } else {
        bail!("git commit 返回非零退出码")
    }
}

/// 获取当前仓库或全局的用户 name/email
pub fn current_identity(global: bool) -> (Option<String>, Option<String>) {
    let name = get_config_scoped("user.name", global);
    let email = get_config_scoped("user.email", global);
    (name, email)
}

/// 添加或更新 remote（已存在则 set-url）
pub fn add_remote(name: &str, url: &str) -> Result<()> {
    let out = run_git(&["remote", "add", name, url])?;
    if out.status.success() {
        return Ok(());
    }
    let out = run_git(&["remote", "set-url", name, url])?;
    if out.status.success() {
        Ok(())
    } else {
        bail!("{}", String::from_utf8_lossy(&out.stderr).trim())
    }
}

/// git push（-u origin <branch>），branch 默认用 HEAD
pub fn push(remote: &str, branch: &str, set_upstream: bool) -> Result<()> {
    let mut args = vec!["push"];
    if set_upstream {
        args.push("-u");
    }
    args.push(remote);
    args.push(branch);
    let status = Command::new("git")
        .args(&args)
        .status()
        .context("执行 git push 失败")?;
    if status.success() {
        Ok(())
    } else {
        bail!("git push 返回非零退出码")
    }
}

/// 获取当前分支名
pub fn current_branch() -> Result<String> {
    git_output(&["rev-parse", "--abbrev-ref", "HEAD"])
        .context("获取当前分支失败")
}

/// 将凭据写入 git credential store（兼容任何已配置的 credential helper）
pub fn credential_approve(host: &str, username: &str, password: &str) -> Result<()> {
    let mut child = Command::new("git")
        .args(["credential", "approve"])
        .stdin(Stdio::piped())
        .spawn()
        .context("执行 git credential approve 失败")?;

    if let Some(mut stdin) = child.stdin.take() {
        write!(
            stdin,
            "protocol=https\nhost={}\nusername={}\npassword={}\n\n",
            host, username, password
        )?;
    }

    let status = child.wait().context("等待 git credential approve 失败")?;
    if status.success() {
        Ok(())
    } else {
        bail!("git credential approve 失败（请检查是否配置了 credential helper）")
    }
}
