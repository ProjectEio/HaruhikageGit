use anyhow::{bail, Context, Result};
use git2::{BranchType, Cred, FetchOptions, IndexAddOption, PushOptions, RemoteCallbacks, Repository, Status, StatusOptions};
use serde::{Deserialize, Serialize};
use std::io::Write;
use std::path::Path;
use std::process::{Command, Stdio};



/// 设置 git config（local 或 global）
pub fn set_config(key: &str, value: &str, global: bool) -> Result<()> {
    if global {
        let mut cfg = git2::Config::open_default().context("打开全局 git 配置失败")?;
        cfg.set_str(key, value).context("写入全局 git 配置失败")
    } else {
        let repo = Repository::discover(".").context("当前目录不是 git 仓库")?;
        let mut cfg = repo.config().context("打开仓库 git 配置失败")?;
        cfg.set_str(key, value).context("写入仓库 git 配置失败")
    }
}

/// 获取指定作用域的 git config 值
pub fn get_config_scoped(key: &str, global: bool) -> Option<String> {
    let value = if global {
        git2::Config::open_default().ok()?.get_string(key).ok()
    } else {
        Repository::discover(".").ok()?.config().ok()?.get_string(key).ok()
    };
    value.filter(|s| !s.is_empty())
}

/// 判断当前目录是否在 git 仓库中
pub fn is_git_repo() -> bool {
    Repository::discover(".").is_ok()
}

/// 执行 git commit
pub fn commit(message: &str, all: bool) -> Result<()> {
    let repo = Repository::discover(".").context("当前目录不是 git 仓库")?;
    let workdir = repo.workdir().context("裸仓库无法提交")?.to_path_buf();
    let mut index = repo.index().context("打开 git index 失败")?;

    if all {
        let mut opts = StatusOptions::new();
        opts.include_untracked(false).recurse_untracked_dirs(true);
        for entry in repo.statuses(Some(&mut opts))?.iter() {
            let Some(path) = entry.path() else { continue; };
            let status = entry.status();
            if status.contains(Status::WT_DELETED) {
                let _ = index.remove_path(Path::new(path));
            } else if status.intersects(Status::WT_MODIFIED | Status::WT_RENAMED | Status::WT_TYPECHANGE) {
                index.add_path(Path::new(path)).with_context(|| format!("stage 文件失败: {}", path))?;
            }
        }
    }
    index.write().context("写入 git index 失败")?;

    let tree_oid = index.write_tree().context("写入 git tree 失败")?;
    let tree = repo.find_tree(tree_oid)?;
    let sig = repo.signature().context("读取提交身份失败，请先配置 user.name 和 user.email")?;
    let parent = repo.head().ok().and_then(|h| h.target()).and_then(|oid| repo.find_commit(oid).ok());
    let parents: Vec<&git2::Commit<'_>> = parent.iter().collect();
    repo.commit(Some("HEAD"), &sig, &sig, message, &tree, &parents)
        .context("创建 git commit 失败")?;
    let _ = workdir;
    Ok(())
}

/// 获取当前仓库或全局的用户 name/email
pub fn current_identity(global: bool) -> (Option<String>, Option<String>) {
    let name = get_config_scoped("user.name", global);
    let email = get_config_scoped("user.email", global);
    (name, email)
}

/// 添加或更新 remote（已存在则 set-url）
pub fn add_remote(name: &str, url: &str) -> Result<()> {
    let repo = Repository::discover(".").context("当前目录不是 git 仓库")?;
    match repo.remote(name, url) {
        Ok(_) => Ok(()),
        Err(_) => {
            repo.remote_set_url(name, url).context("设置 remote URL 失败")
        }
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
    let repo = Repository::discover(".").context("当前目录不是 git 仓库")?;
    let mut callbacks = RemoteCallbacks::new();
    callbacks.credentials(|_url, username_from_url, _allowed| {
        Cred::credential_helper(&repo.config()?, _url, username_from_url)
            .or_else(|_| Cred::default())
    });
    let mut options = PushOptions::new();
    options.remote_callbacks(callbacks);
    if let Some(proxy) = proxy_url {
        let mut p = git2::ProxyOptions::new();
        p.url(proxy);
        options.proxy_options(p);
    }
    let mut remote_obj = match auth_url {
        Some(url) => repo.remote_anonymous(url)?,
        None => repo.find_remote(remote).with_context(|| format!("找不到 remote: {}", remote))?,
    };
    let refspec = format!("refs/heads/{0}:refs/heads/{0}", branch);
    remote_obj.push(&[refspec.as_str()], Some(&mut options)).context("git push 失败")?;
    if set_upstream && auth_url.is_none() {
        if let Ok(mut b) = repo.find_branch(branch, BranchType::Local) {
            b.set_upstream(Some(&format!("{}/{}", remote, branch))).ok();
        }
    }
    Ok(())
}

/// 获取 remote 的 URL
pub fn get_remote_url(remote: &str) -> Result<String> {
    let repo = Repository::discover(".").context("当前目录不是 git 仓库")?;
    repo.find_remote(remote)
        .with_context(|| format!("找不到 remote: {}", remote))?
        .url()
        .map(|s| s.to_string())
        .ok_or_else(|| anyhow::anyhow!("remote '{}' 没有 URL", remote))
}

/// 获取当前分支名
pub fn current_branch() -> Result<String> {
    let repo = Repository::discover(".").context("当前目录不是 git 仓库")?;
    let head = repo.head().context("获取当前分支失败")?;
    Ok(head.shorthand().unwrap_or("HEAD").to_string())
}

/// 将凭据写入 git credential store（兼容任何已配置的 credential helper，会自动先 reject 掉旧凭据以防无法覆盖）
pub fn credential_approve(host: &str, username: &str, password: &str) -> Result<()> {
    // 1. 先执行 git credential reject 擦除该 host 的旧凭据，确保新凭据能够覆盖
    let mut reject_child = Command::new("git")
        .args(["credential", "reject"])
        .stdin(Stdio::piped())
        .spawn()
        .context("执行 git credential reject 失败")?;

    if let Some(mut stdin) = reject_child.stdin.take() {
        write!(
            stdin,
            "protocol=https\nhost={}\n\n",
            host
        )?;
    }
    let _ = reject_child.wait(); // 忽略 reject 的错误，即使原本没有旧凭据也可以继续

    // 2. 执行 git credential approve 写入新凭据
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
    fetch(remote, proxy_url)?;
    let repo = Repository::discover(".").context("当前目录不是 git 仓库")?;
    let remote_ref = format!("refs/remotes/{}/{}", remote, branch);
    let annotated = repo.find_annotated_commit(repo.refname_to_id(&remote_ref)?)?;
    let (analysis, _) = repo.merge_analysis(&[&annotated])?;
    if analysis.is_up_to_date() {
        return Ok("Already up to date".to_string());
    }
    if analysis.is_fast_forward() {
        let refname = format!("refs/heads/{}", branch);
        let mut reference = repo.find_reference(&refname)?;
        reference.set_target(annotated.id(), "Fast-Forward")?;
        repo.set_head(&refname)?;
        repo.checkout_head(Some(git2::build::CheckoutBuilder::default().force()))?;
        return Ok("Fast-forward 完成".to_string());
    }
    bail!("当前分支需要合并提交，请使用完整 Git 客户端处理")
}

pub fn fetch(remote: &str, proxy_url: Option<&str>) -> Result<String> {
    let repo = Repository::discover(".").context("当前目录不是 git 仓库")?;
    let mut callbacks = RemoteCallbacks::new();
    callbacks.credentials(|url, username_from_url, _allowed| {
        Cred::credential_helper(&repo.config()?, url, username_from_url)
            .or_else(|_| Cred::default())
    });
    let mut options = FetchOptions::new();
    options.remote_callbacks(callbacks);
    if let Some(proxy) = proxy_url {
        let mut p = git2::ProxyOptions::new();
        p.url(proxy);
        options.proxy_options(p);
    }
    let mut remote_obj = repo.find_remote(remote).with_context(|| format!("找不到 remote: {}", remote))?;
    remote_obj.fetch(&[] as &[&str], Some(&mut options), None).context("git fetch 失败")?;
    Ok("Fetch 完成".to_string())
}

pub fn checkout(target: &str) -> Result<String> {
    let repo = Repository::discover(".").context("当前目录不是 git 仓库")?;
    let obj = repo.revparse_single(target).with_context(|| format!("找不到引用: {}", target))?;
    repo.checkout_tree(&obj, None).context("检出工作区失败")?;
    if let Some(commit) = obj.as_commit() {
        if repo.find_branch(target, BranchType::Local).is_ok() {
            repo.set_head(&format!("refs/heads/{}", target))?;
        } else {
            repo.set_head_detached(commit.id())?;
        }
    }
    Ok(format!("已切换到 {}", target))
}

pub fn create_branch(name: &str, start_point: Option<&str>) -> Result<String> {
    let repo = Repository::discover(".").context("当前目录不是 git 仓库")?;
    let obj = match start_point {
        Some(sp) => repo.revparse_single(sp)?,
        None => repo.head()?.peel(git2::ObjectType::Commit)?,
    };
    let commit = obj.into_commit().map_err(|_| anyhow::anyhow!("起点不是 commit"))?;
    repo.branch(name, &commit, false).context("创建分支失败")?;
    Ok(format!("已创建分支 {}", name))
}

pub fn delete_branch(name: &str, force: bool) -> Result<String> {
    let repo = Repository::discover(".").context("当前目录不是 git 仓库")?;
    let mut branch = repo.find_branch(name, BranchType::Local).context("找不到本地分支")?;
    let _ = force;
    branch.delete().context("删除分支失败")?;
    Ok(format!("已删除分支 {}", name))
}

pub fn get_branches() -> Result<Vec<String>> {
    if !is_git_repo() {
        return Ok(Vec::new());
    }
    let repo = Repository::discover(".").context("当前目录不是 git 仓库")?;
    let mut branches = Vec::new();
    for item in repo.branches(Some(BranchType::Local))? {
        let (branch, _) = item?;
        if let Some(name) = branch.name()? {
            branches.push(name.to_string());
        }
    }
    branches.sort();
    Ok(branches)
}

pub fn get_log(limit: usize) -> Result<Vec<CommitInfo>> {
    if !is_git_repo() {
        bail!("当前目录不是 git 仓库");
    }
    let repo = Repository::discover(".").context("当前目录不是 git 仓库")?;
    let mut revwalk = repo.revwalk()?;
    revwalk.push_head()?;
    revwalk.set_sorting(git2::Sort::TIME)?;
    let mut commits = Vec::new();
    let upstream_oid = repo.head().ok()
        .and_then(|h| h.shorthand().map(str::to_string))
        .and_then(|name| repo.find_branch(&name, BranchType::Local).ok())
        .and_then(|b| b.upstream().ok())
        .and_then(|b| b.get().target());
    for oid in revwalk.take(limit).flatten() {
        let commit = repo.find_commit(oid)?;
        let author = commit.author();
        let time = commit.time().seconds().to_string();
        let is_remote = upstream_oid
            .map(|up| repo.graph_descendant_of(up, oid).unwrap_or(false))
            .unwrap_or(false);
        commits.push(CommitInfo {
            hash: oid.to_string(),
            author: author.name().unwrap_or("").to_string(),
            email: author.email().unwrap_or("").to_string(),
            date: time,
            message: commit.summary().unwrap_or("").to_string(),
            is_remote,
        });
    }
    Ok(commits)
}

pub fn get_sync_status() -> Result<SyncStatus> {
    if !is_git_repo() {
        return Ok(SyncStatus { ahead: 0, behind: 0, has_upstream: false });
    }
    let repo = Repository::discover(".").context("当前目录不是 git 仓库")?;
    let Some(local_oid) = repo.head().ok().and_then(|h| h.target()) else {
        return Ok(SyncStatus { ahead: 0, behind: 0, has_upstream: false });
    };
    let upstream_oid = repo.head().ok()
        .and_then(|h| h.shorthand().map(str::to_string))
        .and_then(|name| repo.find_branch(&name, BranchType::Local).ok())
        .and_then(|b| b.upstream().ok())
        .and_then(|b| b.get().target());
    if let Some(remote_oid) = upstream_oid {
        let (ahead, behind) = repo.graph_ahead_behind(local_oid, remote_oid)?;
        Ok(SyncStatus { ahead: ahead as u32, behind: behind as u32, has_upstream: true })
    } else {
        Ok(SyncStatus { ahead: 0, behind: 0, has_upstream: false })
    }
}

pub fn get_status() -> Result<Vec<GitFileStatus>> {
    if !is_git_repo() {
        return Ok(Vec::new());
    }

    let repo = Repository::discover(".").context("当前目录不是 git 仓库")?;
    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true)
        .renames_head_to_index(true)
        .renames_index_to_workdir(true);
    let statuses = repo.statuses(Some(&mut opts)).context("读取 git status 失败")?;
    let mut files = Vec::new();
    for entry in statuses.iter() {
        let Some(path) = entry.path().map(str::to_string) else { continue; };
        let s = entry.status();
        if s.contains(Status::WT_NEW) {
            files.push(GitFileStatus { path, status: "untracked".to_string() });
            continue;
        }
        if s.intersects(Status::INDEX_NEW | Status::INDEX_MODIFIED | Status::INDEX_DELETED | Status::INDEX_RENAMED | Status::INDEX_TYPECHANGE) {
            files.push(GitFileStatus { path: path.clone(), status: "staged".to_string() });
        }
        if s.intersects(Status::WT_MODIFIED | Status::WT_RENAMED | Status::WT_TYPECHANGE) {
            files.push(GitFileStatus { path: path.clone(), status: "modified".to_string() });
        }
        if s.contains(Status::WT_DELETED) {
            files.push(GitFileStatus { path, status: "deleted".to_string() });
        }
    }
    Ok(files)
}


pub fn add_files(specs: &[&str]) -> Result<()> {
    let repo = Repository::discover(".").context("当前目录不是 git 仓库")?;
    let mut index = repo.index().context("打开 git index 失败")?;
    for spec in specs {
        index.add_all([*spec], IndexAddOption::DEFAULT, None)
            .or_else(|_| index.add_path(Path::new(spec)))
            .with_context(|| format!("stage 文件失败: {}", spec))?;
    }
    index.write().context("写入 git index 失败")
}

pub fn reset_files(specs: &[&str]) -> Result<()> {
    let repo = Repository::discover(".").context("当前目录不是 git 仓库")?;
    let obj = repo.head()?.peel(git2::ObjectType::Commit)?;
    let paths: Vec<&Path> = specs.iter().map(Path::new).collect();
    repo.reset_default(Some(&obj), paths).context("取消暂存失败")?;
    Ok(())
}

pub fn workdir_root() -> Result<String> {
    let repo = Repository::discover(".").context("当前目录不是 git 仓库")?;
    repo.workdir()
        .map(|p| p.display().to_string())
        .ok_or_else(|| anyhow::anyhow!("裸仓库没有工作区"))
}

pub fn file_diff(path: &str) -> Result<String> {
    let repo = Repository::discover(".").context("当前目录不是 git 仓库")?;
    let mut opts = git2::DiffOptions::new();
    opts.pathspec(path);
    let tree = repo.head().ok()
        .and_then(|h| h.peel_to_tree().ok());
    let diff = repo.diff_tree_to_workdir_with_index(tree.as_ref(), Some(&mut opts))?;
    let mut out = Vec::new();
    diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
        out.extend_from_slice(line.origin().encode_utf8(&mut [0; 4]).as_bytes());
        out.extend_from_slice(line.content());
        true
    })?;
    let text = String::from_utf8_lossy(&out).to_string();
    if !text.is_empty() {
        return Ok(text);
    }
    let workdir = repo.workdir().context("裸仓库没有工作区")?;
    let clean_path = path.trim_matches('"').trim_matches('\'');
    let abs = workdir.join(clean_path);
    if abs.exists() && abs.is_file() {
        let content = std::fs::read_to_string(&abs).unwrap_or_else(|_| "无法读取该文件内容".to_string());
        let mut synthetic = format!("--- /dev/null\n+++ b/{}\n@@ -0,0 +1,{} @@\n", clean_path, content.lines().count());
        for line in content.lines() {
            synthetic.push_str(&format!("+{}\n", line));
        }
        Ok(synthetic)
    } else {
        Ok(format!("文件为空，不存在，或已被删除: {}", abs.display()))
    }
}

/// 丢弃当前工作区的所有未提交更改（包括修改、删除和未跟踪的文件）
pub fn discard_changes() -> Result<()> {
    let repo = Repository::discover(".").context("当前目录不是 git 仓库")?;
    
    // 1. 重置 HEAD（等同于 reset --hard HEAD）
    if let Ok(head) = repo.head() {
        let obj = head.peel(git2::ObjectType::Commit).context("HEAD 不是 commit")?;
        let mut checkout_opts = git2::build::CheckoutBuilder::new();
        checkout_opts.force();
        repo.reset(&obj, git2::ResetType::Hard, Some(&mut checkout_opts)).context("重置 HEAD 失败")?;
    }
    
    // 2. 清理未跟踪的文件和文件夹（等同于 clean -df）
    let mut status_opts = StatusOptions::new();
    status_opts.include_untracked(true)
        .recurse_untracked_dirs(true);
    let statuses = repo.statuses(Some(&mut status_opts)).context("读取 git status 失败")?;
    let workdir = repo.workdir().context("裸仓库没有工作区")?;
    
    for entry in statuses.iter() {
        let status = entry.status();
        if status.contains(Status::WT_NEW) {
            if let Some(path_str) = entry.path() {
                let full_path = workdir.join(path_str);
                if full_path.exists() {
                    if full_path.is_file() {
                        let _ = std::fs::remove_file(&full_path);
                    } else if full_path.is_dir() {
                        let _ = std::fs::remove_dir_all(&full_path);
                    }
                }
            }
        }
    }
    Ok(())
}
