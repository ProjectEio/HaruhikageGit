use std::path::PathBuf;

use anyhow::{bail, Context, Result};

use crate::core::{
    config::{Config, Profile, ProxySettings},
    git, github, proxy,
};

use serde::Serialize;

/// 根据配置构建 GitHub 客户端
fn gh_client() -> Result<github::Client> {
    let cfg = Config::load()?;
    Ok(github::Client::new(&cfg.proxy))
}

/// `hg status` 返回的完整状态快照
#[derive(Serialize)]
pub struct StatusInfo {
    pub global_name: Option<String>,
    pub global_email: Option<String>,
    pub local_name: Option<String>,
    pub local_email: Option<String>,
    pub is_repo: bool,
    pub profiles: Vec<(String, Profile)>,
    pub config_path: PathBuf,
}

pub fn add_profile(alias: &str, name: &str, email: &str, signing_key: Option<&str>) -> Result<()> {
    let mut cfg = Config::load()?;
    if cfg.profiles.contains_key(alias) {
        bail!("Profile '{}' 已存在，请先删除或使用 profile update", alias);
    }
    cfg.profiles.insert(
        alias.to_string(),
        Profile {
            name: name.to_string(),
            email: email.to_string(),
            signing_key: signing_key.map(|s| s.to_string()),
            token: None,
            github_user: None,
        },
    );
    cfg.save()
}

pub fn update_profile(
    alias: &str,
    name: Option<&str>,
    email: Option<&str>,
    signing_key: Option<&str>,
) -> Result<()> {
    let mut cfg = Config::load()?;
    let profile = cfg
        .profiles
        .get_mut(alias)
        .ok_or_else(|| anyhow::anyhow!("Profile '{}' 不存在", alias))?;
    if let Some(n) = name {
        profile.name = n.to_string();
    }
    if let Some(e) = email {
        profile.email = e.to_string();
    }
    if let Some(k) = signing_key {
        profile.signing_key = if k.is_empty() { None } else { Some(k.to_string()) };
    }
    cfg.save()
}

pub fn remove_profile(alias: &str) -> Result<()> {
    let mut cfg = Config::load()?;
    if cfg.profiles.remove(alias).is_none() {
        bail!("Profile '{}' 不存在", alias);
    }
    cfg.save()
}

pub fn list_profiles() -> Result<Vec<(String, Profile)>> {
    let cfg = Config::load()?;
    let mut profiles: Vec<_> = cfg.profiles.into_iter().collect();
    profiles.sort_by(|a, b| a.0.cmp(&b.0));
    Ok(profiles)
}

/// 将指定 profile 应用到 git config，返回所应用的 Profile
pub fn switch_profile(alias: &str, global: bool) -> Result<Profile> {
    if !global && !git::is_git_repo() {
        bail!("当前目录不是 git 仓库，请使用 --global 切换全局账户");
    }
    let cfg = Config::load()?;
    let profile = cfg
        .profiles
        .get(alias)
        .ok_or_else(|| anyhow::anyhow!("Profile '{}' 不存在，请先用 `hg profile add` 添加", alias))?
        .clone();

    git::set_config("user.name", &profile.name, global)?;
    git::set_config("user.email", &profile.email, global)?;
    if let Some(ref key) = profile.signing_key {
        git::set_config("user.signingkey", key, global)?;
    }
    Ok(profile)
}

/// 从当前 git 身份（local 或 global）导入为一个新 Profile
pub fn import_profile(alias: &str, global: bool) -> Result<Profile> {
    let (name, email) = git::current_identity(global);
    let name = name.ok_or_else(|| {
        anyhow::anyhow!(
            "当前{}未配置 user.name，请先设置或手动添加",
            if global { "全局" } else { "仓库" }
        )
    })?;
    let email = email.ok_or_else(|| {
        anyhow::anyhow!(
            "当前{}未配置 user.email，请先设置或手动添加",
            if global { "全局" } else { "仓库" }
        )
    })?;

    let mut cfg = Config::load()?;
    if cfg.profiles.contains_key(alias) {
        bail!("Profile '{}' 已存在，请先删除或使用 profile update", alias);
    }
    let profile = Profile { name, email, signing_key: None, token: None, github_user: None };
    cfg.profiles.insert(alias.to_string(), profile.clone());
    cfg.save()?;
    Ok(profile)
}

// ── GitHub OAuth ──────────────────────────────────────────────────────────────

pub fn set_github_client(client_id: &str) -> Result<()> {
    let mut cfg = Config::load()?;
    cfg.github_client_id = Some(client_id.to_string());
    cfg.save()
}

pub fn get_github_client() -> Result<String> {
    let cfg = Config::load()?;
    Ok(cfg
        .github_client_id
        .unwrap_or_else(|| crate::GITHUB_CLIENT_ID.to_string()))
}

/// 第一步：请求 device_code，返回给 CLI 层展示
pub fn github_request_code() -> Result<github::DeviceCode> {
    let client_id = get_github_client()?;
    gh_client()?.request_device_code(&client_id)
}

/// 第二步：轮询直到用户授权完成，拉取用户信息并保存 Profile
pub fn github_complete_login(alias: &str, device: &github::DeviceCode) -> Result<Profile> {
    let client_id = get_github_client()?;
    let client = gh_client()?;
    let token = client.poll_for_token(&client_id, device)?;
    let user = client.get_user(&token)?;

    let email = match user.email.as_deref() {
        Some(e) if !e.is_empty() => e.to_string(),
        _ => client
            .get_primary_email(&token)?
            .ok_or_else(|| anyhow::anyhow!("无法获取 GitHub 邮箱，请确认授权了 user:email 权限"))?,
    };
    let name = user.name.as_deref().unwrap_or(&user.login).to_string();

    let mut cfg = Config::load()?;
    let profile = Profile {
        name,
        email,
        signing_key: None,
        token: Some(token.clone()),
        github_user: Some(user.login.clone()),
    };
    cfg.profiles.insert(alias.to_string(), profile.clone());
    cfg.save()?;

    git::credential_approve("github.com", &user.login, &token)?;
    Ok(profile)
}


/// 用 PAT 直接登录：拉取用户信息并保存 Profile
pub fn github_pat_login(token: &str, alias: &str) -> Result<Profile> {
    let client = gh_client()?;
    let user = client.get_user(token)?;
    let email = match user.email.as_deref() {
        Some(e) if !e.is_empty() => e.to_string(),
        _ => client
            .get_primary_email(token)?
            .ok_or_else(|| anyhow::anyhow!("无法获取 GitHub 邮箱"))?,
    };
    let name = user.name.as_deref().unwrap_or(&user.login).to_string();
    let mut cfg = Config::load()?;
    let profile = Profile {
        name,
        email,
        signing_key: None,
        token: Some(token.to_string()),
        github_user: Some(user.login.clone()),
    };
    cfg.profiles.insert(alias.to_string(), profile.clone());
    cfg.save()?;
    git::credential_approve("github.com", &user.login, token)?;
    Ok(profile)
}

/// 创建 GitHub 仓库并配置本地 remote
pub fn github_create_repo(
    profile_alias: &str,
    repo_name: &str,
    org: Option<&str>,
    description: &str,
    private: bool,
) -> Result<github::RepoInfo> {
    let cfg = Config::load()?;
    let token = cfg
        .profiles
        .get(profile_alias)
        .ok_or_else(|| anyhow::anyhow!("Profile '{}' 不存在", profile_alias))?
        .token
        .as_deref()
        .ok_or_else(|| {
            anyhow::anyhow!("Profile '{}' 没有 token，请先 `hg github login`", profile_alias)
        })?
        .to_string();
    let client = github::Client::new(&cfg.proxy);
    let info = client.create_repo(&token, repo_name, org, description, private)?;
    git::add_remote("origin", &info.clone_url)?;
    Ok(info)
}

/// 推送当前分支到 origin，自动注入 GitHub token（绕过 credential.helper）
pub fn git_push() -> Result<String> {
    if !git::is_git_repo() {
        bail!("当前目录不是 git 仓库");
    }
    let branch = git::current_branch()?;
    let cfg = Config::load()?;
    let proxy_url = proxy::resolve(&cfg.proxy);

    // 尝试从 profiles 中找到含 token 的 GitHub profile，并把 token 注入 URL
    let auth_url = git::get_remote_url("origin").ok().and_then(|url| {
        cfg.profiles
            .values()
            .find(|p| p.token.is_some() && p.github_user.is_some())
            .and_then(|p| inject_token(&url, p.github_user.as_deref()?, p.token.as_deref()?))
    });

    git::push("origin", &branch, true, proxy_url.as_deref(), auth_url.as_deref())?;
    Ok(branch)
}

fn inject_token(url: &str, username: &str, token: &str) -> Option<String> {
    if let Some(rest) = url.trim().strip_prefix("https://") {
        let host_path = if let Some(at) = rest.find('@') {
            &rest[at + 1..]
        } else {
            rest
        };
        Some(format!("https://{}:{}@{}", username, token, host_path))
    } else {
        None
    }
}

// ── 代理配置 ──────────────────────────────────────────────────────────────

pub fn set_proxy_url(url: Option<&str>) -> Result<()> {
    let mut cfg = Config::load()?;
    cfg.proxy.url = url.map(|s| s.to_string());
    cfg.save()
}

pub fn set_proxy_auto_detect(enabled: bool) -> Result<()> {
    let mut cfg = Config::load()?;
    cfg.proxy.auto_detect = enabled;
    cfg.save()
}

pub fn get_proxy_status() -> Result<(ProxySettings, Option<String>)> {
    let cfg = Config::load()?;
    let resolved = proxy::resolve(&cfg.proxy);
    Ok((cfg.proxy, resolved))
}

// ── 安装 ─────────────────────────────────────────────────────────────────────

pub struct InstallResult {
    pub dest: PathBuf,
    pub dir: PathBuf,
    pub path_updated: bool,
}

pub fn install(custom_dir: Option<PathBuf>, add_to_path: bool) -> Result<InstallResult> {
    let current_exe = std::env::current_exe().context("无法获取当前可执行文件路径")?;
    let dir = custom_dir.unwrap_or_else(|| {
        dirs::home_dir()
            .expect("home dir")
            .join(format!(".{}", crate::APP_NAME))
            .join("bin")
    });
    std::fs::create_dir_all(&dir).context("创建安装目录失败")?;

    let filename = current_exe
        .file_name()
        .ok_or_else(|| anyhow::anyhow!("无法获取可执行文件名"))?;
    let dest = dir.join(filename);
    std::fs::copy(&current_exe, &dest)
        .with_context(|| format!("复制失败: {} -> {}", current_exe.display(), dest.display()))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = std::fs::metadata(&dest)?.permissions();
        perms.set_mode(0o755);
        std::fs::set_permissions(&dest, perms)?;
    }

    let path_updated = if add_to_path && !is_in_path(&dir) {
        add_to_path_impl(&dir)?;
        true
    } else {
        false
    };

    Ok(InstallResult { dest, dir, path_updated })
}

fn is_in_path(dir: &std::path::Path) -> bool {
    std::env::var("PATH")
        .map(|p| std::env::split_paths(&p).any(|d| d == dir))
        .unwrap_or(false)
}

#[cfg(windows)]
fn add_to_path_impl(dir: &std::path::Path) -> Result<()> {
    use std::process::Command;
    let dir_str = dir.to_string_lossy();
    let script = format!(
        "$p=[Environment]::GetEnvironmentVariable('Path','User'); \
         if ($p -notlike '*{0}*') {{ [Environment]::SetEnvironmentVariable('Path',\"$p;{0}\",'User') }}",
        dir_str
    );
    Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .status()
        .context("修改用户 PATH 失败")?;
    Ok(())
}

#[cfg(not(windows))]
fn add_to_path_impl(dir: &std::path::Path) -> Result<()> {
    use std::io::Write;
    let dir_str = dir.to_string_lossy();
    let line = format!("\nexport PATH=\"{}:$PATH\"", dir_str);
    let home = dirs::home_dir().context("无法获取 HOME 目录")?;
    for rc in [".bashrc", ".zshrc", ".profile"] {
        let path = home.join(rc);
        if path.exists() {
            let content = std::fs::read_to_string(&path).unwrap_or_default();
            if !content.contains(dir_str.as_ref()) {
                let mut f = std::fs::OpenOptions::new().append(true).open(&path)?;
                writeln!(f, "{}", line)?;
            }
        }
    }
    Ok(())
}

/// 快速 commit，可选提交前切换 profile（仅 local）
pub fn quick_commit(message: &str, all: bool, profile_alias: Option<&str>) -> Result<()> {
    if !git::is_git_repo() {
        bail!("当前目录不是 git 仓库");
    }
    if let Some(alias) = profile_alias {
        switch_profile(alias, false)?;
    }
    git::commit(message, all)
}

pub fn get_status() -> Result<StatusInfo> {
    let cfg = Config::load()?;
    let is_repo = git::is_git_repo();
    let (global_name, global_email) = git::current_identity(true);
    let (local_name, local_email) = if is_repo {
        git::current_identity(false)
    } else {
        (None, None)
    };
    let mut profiles: Vec<_> = cfg.profiles.into_iter().collect();
    profiles.sort_by(|a, b| a.0.cmp(&b.0));
    let config_path = Config::config_path()?;

    Ok(StatusInfo {
        global_name,
        global_email,
        local_name,
        local_email,
        is_repo,
        profiles,
        config_path,
    })
}

pub fn get_git_status() -> Result<Vec<git::GitFileStatus>> {
    git::get_status()
}

pub fn git_pull(alias: Option<&str>, global: bool) -> Result<String> {
    if !git::is_git_repo() {
        bail!("当前目录不是 git 仓库");
    }
    let branch = git::current_branch()?;
    if let Some(a) = alias {
        switch_profile(a, global)?;
    }
    let cfg = Config::load()?;
    let proxy_url = proxy::resolve(&cfg.proxy);
    git::pull("origin", &branch, proxy_url.as_deref())
}

pub fn git_fetch() -> Result<String> {
    if !git::is_git_repo() {
        bail!("当前目录不是 git 仓库");
    }
    let cfg = Config::load()?;
    let proxy_url = proxy::resolve(&cfg.proxy);
    git::fetch("origin", proxy_url.as_deref())
}

pub fn git_checkout(target: &str) -> Result<String> {
    if !git::is_git_repo() {
        bail!("当前目录不是 git 仓库");
    }
    git::checkout(target)
}

pub fn git_create_branch(name: &str, start_point: Option<&str>) -> Result<String> {
    if !git::is_git_repo() {
        bail!("当前目录不是 git 仓库");
    }
    git::create_branch(name, start_point)
}

pub fn git_delete_branch(name: &str, force: bool) -> Result<String> {
    if !git::is_git_repo() {
        bail!("当前目录不是 git 仓库");
    }
    git::delete_branch(name, force)
}

pub fn get_git_branches() -> Result<Vec<String>> {
    git::get_branches()
}

pub fn get_git_commits(limit: usize) -> Result<Vec<git::CommitInfo>> {
    git::get_log(limit)
}

pub fn git_stage_files(specs: Vec<String>) -> Result<()> {
    if !git::is_git_repo() {
        bail!("当前目录不是 git 仓库");
    }
    let refs: Vec<&str> = specs.iter().map(|s| s.as_str()).collect();
    git::add_files(&refs)
}

pub fn git_unstage_files(specs: Vec<String>) -> Result<()> {
    if !git::is_git_repo() {
        bail!("当前目录不是 git 仓库");
    }
    let refs: Vec<&str> = specs.iter().map(|s| s.as_str()).collect();
    git::reset_files(&refs)
}
