use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};
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

/// git push；auth_url 为含 token 的完整 URL，proxy_url 透传到 HTTPS_PROXY
pub fn push(
    remote: &str,
    branch: &str,
    set_upstream: bool,
    proxy_url: Option<&str>,
    auth_url: Option<&str>,
) -> Result<()> {
    let mut args = vec!["push"];
    if set_upstream {
        args.push("-u");
    }
    let target = auth_url.unwrap_or(remote);
    args.push(target);
    args.push(branch);
    let mut cmd = Command::new("git");
    cmd.args(&args);
    if let Some(proxy) = proxy_url {
        cmd.env("HTTPS_PROXY", proxy).env("HTTP_PROXY", proxy);
    }
    let status = cmd.status().context("执行 git push 失败")?;
    if status.success() {
        Ok(())
    } else {
        bail!("git push 失败")
    }
}

/// 获取 remote 的 URL
pub fn get_remote_url(remote: &str) -> Result<String> {
    git_output(&["remote", "get-url", remote]).context("获取 remote URL 失败")
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitFileStatus {
    pub path: String,
    pub status: String, // "modified", "added", "deleted", "untracked", "staged"
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CommitInfo {
    pub hash: String,
    pub author: String,
    pub email: String,
    pub date: String,
    pub message: String,
    pub is_remote: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SyncStatus {
    pub ahead: u32,
    pub behind: u32,
    pub has_upstream: bool,
}

pub fn pull(remote: &str, branch: &str, proxy_url: Option<&str>) -> Result<String> {
    let mut cmd = Command::new("git");
    cmd.args(&["pull", remote, branch]);
    if let Some(proxy) = proxy_url {
        cmd.env("HTTPS_PROXY", proxy).env("HTTP_PROXY", proxy);
    }
    let out = cmd.output().context("执行 git pull 失败")?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
    } else {
        bail!("{}", String::from_utf8_lossy(&out.stderr).trim())
    }
}

pub fn fetch(remote: &str, proxy_url: Option<&str>) -> Result<String> {
    let mut cmd = Command::new("git");
    cmd.args(&["fetch", remote]);
    if let Some(proxy) = proxy_url {
        cmd.env("HTTPS_PROXY", proxy).env("HTTP_PROXY", proxy);
    }
    let out = cmd.output().context("执行 git fetch 失败")?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
    } else {
        bail!("{}", String::from_utf8_lossy(&out.stderr).trim())
    }
}

pub fn checkout(target: &str) -> Result<String> {
    git_output(&["checkout", target]).context("执行 git checkout 失败")
}

pub fn create_branch(name: &str, start_point: Option<&str>) -> Result<String> {
    let mut args = vec!["branch", name];
    if let Some(sp) = start_point {
        args.push(sp);
    }
    git_output(&args).context("创建分支失败")
}

pub fn delete_branch(name: &str, force: bool) -> Result<String> {
    let flag = if force { "-D" } else { "-d" };
    git_output(&["branch", flag, name]).context("删除分支失败")
}

pub fn get_branches() -> Result<Vec<String>> {
    if !is_git_repo() {
        return Ok(Vec::new());
    }
    let out = git_output(&["branch", "-a"])?;
    let mut branches = Vec::new();
    for line in out.lines() {
        let cleaned = line.trim().trim_start_matches('*').trim().to_string();
        if !cleaned.is_empty() {
            branches.push(cleaned);
        }
    }
    Ok(branches)
}

pub fn get_log(limit: usize) -> Result<Vec<CommitInfo>> {
    if !is_git_repo() {
        bail!("当前目录不是 git 仓库");
    }
    let limit_str = limit.to_string();
    let out = git_output(&[
        "log",
        &format!("-n{}", limit_str),
        "--pretty=format:%H|%an|%ae|%ad|%s|%D",
    ])?;
    if out.is_empty() {
        return Ok(Vec::new());
    }
    let mut commits = Vec::new();
    let mut is_remote_reached = false;
    
    for line in out.lines() {
        let parts: Vec<&str> = line.splitn(6, '|').collect();
        if parts.len() >= 5 {
            let refs = if parts.len() == 6 { parts[5] } else { "" };
            // If we hit a remote tracking branch, this and all older commits are remote
            if refs.contains("origin/") || refs.contains("upstream/") {
                is_remote_reached = true;
            }
            
            commits.push(CommitInfo {
                hash: parts[0].to_string(),
                author: parts[1].to_string(),
                email: parts[2].to_string(),
                date: parts[3].to_string(),
                message: parts[4].to_string(),
                is_remote: is_remote_reached,
            });
        }
    }
    Ok(commits)
}

pub fn get_sync_status() -> Result<SyncStatus> {
    if !is_git_repo() {
        return Ok(SyncStatus { ahead: 0, behind: 0, has_upstream: false });
    }
    let root_out = Command::new("git")
        .args(&["rev-parse", "--show-toplevel"])
        .output()
        .context("获取 git root 失败")?;
    let root = if root_out.status.success() {
        String::from_utf8_lossy(&root_out.stdout).trim().to_string()
    } else {
        bail!("无法获取 git 仓库根目录");
    };

    let out = Command::new("git")
        .current_dir(&root)
        .args(&["rev-list", "--left-right", "--count", "HEAD...@{u}"])
        .output();
    
    match out {
        Ok(output) if output.status.success() => {
            let str_out = String::from_utf8_lossy(&output.stdout);
            let parts: Vec<&str> = str_out.split_whitespace().collect();
            if parts.len() == 2 {
                let ahead = parts[0].parse().unwrap_or(0);
                let behind = parts[1].parse().unwrap_or(0);
                Ok(SyncStatus { ahead, behind, has_upstream: true })
            } else {
                Ok(SyncStatus { ahead: 0, behind: 0, has_upstream: false })
            }
        },
        _ => {
            Ok(SyncStatus { ahead: 0, behind: 0, has_upstream: false })
        }
    }
}

pub fn get_status() -> Result<Vec<GitFileStatus>> {
    if !is_git_repo() {
        return Ok(Vec::new());
    }

    // Use `git -C <toplevel>` to guarantee paths are relative to the repo root,
    // regardless of where the process CWD happens to be.
    let root_out = Command::new("git")
        .args(&["rev-parse", "--show-toplevel"])
        .output()
        .context("获取 git root 失败")?;
    let root = if root_out.status.success() {
        String::from_utf8_lossy(&root_out.stdout).trim().to_string()
    } else {
        bail!("无法获取 git 仓库根目录");
    };

    let out = Command::new("git")
        .current_dir(&root)
        .args(&["status", "--porcelain", "-u"])
        .output()
        .context("执行 git status 失败")?;
    if !out.status.success() {
        bail!("{}", String::from_utf8_lossy(&out.stderr).trim());
    }

    let output = String::from_utf8_lossy(&out.stdout);
    let mut files = Vec::new();

    for line in output.lines() {
        if line.len() < 4 {
            continue;
        }
        let index_char = line.chars().nth(0).unwrap_or(' ');
        let work_char  = line.chars().nth(1).unwrap_or(' ');
        // Porcelain v1: "XY PATH" – path starts at byte offset 3
        let raw_path = &line[3..];
        let mut file_path = raw_path.trim().to_string();

        // Remove surrounding quotes that git emits for paths with special chars
        if file_path.starts_with('"') && file_path.ends_with('"') && file_path.len() >= 2 {
            file_path = file_path[1..file_path.len() - 1].to_string();
        }

        eprintln!("DEBUG get_status: index='{}' work='{}' path='{}'", index_char, work_char, file_path);

        if index_char == '?' && work_char == '?' {
            files.push(GitFileStatus {
                path: file_path,
                status: "untracked".to_string(),
            });
        } else {
            if index_char != ' ' {
                files.push(GitFileStatus {
                    path: file_path.clone(),
                    status: "staged".to_string(),
                });
            }
            if work_char != ' ' {
                let status_str = match work_char {
                    'M' => "modified",
                    'D' => "deleted",
                    _ => "unstaged",
                };
                files.push(GitFileStatus {
                    path: file_path,
                    status: status_str.to_string(),
                });
            }
        }
    }
    Ok(files)
}


pub fn add_files(specs: &[&str]) -> Result<()> {
    let mut args = vec!["add"];
    args.extend(specs);
    let out = run_git(&args)?;
    if out.status.success() {
        Ok(())
    } else {
        bail!("{}", String::from_utf8_lossy(&out.stderr).trim())
    }
}

pub fn reset_files(specs: &[&str]) -> Result<()> {
    let mut args = vec!["reset"];
    args.extend(specs);
    let out = run_git(&args)?;
    if out.status.success() {
        Ok(())
    } else {
        bail!("{}", String::from_utf8_lossy(&out.stderr).trim())
    }
}
