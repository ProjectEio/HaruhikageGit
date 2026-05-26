use haruhikage_git::core::{git, ops};
use std::path::PathBuf;
use std::process::Command;

// ─── Git Passthrough ─────────────────────────────────────────────────────────

#[derive(serde::Serialize)]
pub struct GitOutput {
    pub stdout: String,
    pub stderr: String,
    pub success: bool,
    pub code: i32,
}

/// 透传 git 命令，自动注入代理环境变量
#[tauri::command]
fn git_passthrough(args: Vec<String>, cwd: Option<String>) -> Result<GitOutput, String> {
    use haruhikage_git::core::config::Config;
    use haruhikage_git::core::proxy;

    let cfg = Config::load().map_err(|e| e.to_string())?;
    let proxy_url = proxy::resolve(&cfg.proxy);

    let working_dir = match cwd {
        Some(ref p) => PathBuf::from(p),
        None => std::env::current_dir().unwrap_or_default(),
    };

    let mut cmd = Command::new("git");
    cmd.args(&args).current_dir(&working_dir);

    if let Some(ref url) = proxy_url {
        cmd.env("HTTPS_PROXY", url)
            .env("https_proxy", url)
            .env("HTTP_PROXY", url)
            .env("http_proxy", url);
    }

    let output = cmd.output().map_err(|e| format!("执行 git 失败: {}", e))?;

    Ok(GitOutput {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        success: output.status.success(),
        code: output.status.code().unwrap_or(-1),
    })
}

/// 检测文件夹是否为 git 仓库，并提取基础信息
#[derive(serde::Serialize)]
pub struct RepoDetectInfo {
    pub is_git: bool,
    pub name: String,
    pub remote_url: Option<String>,
    pub org: String,
    pub current_branch: String,
}

#[tauri::command]
fn detect_git_repo_info(path: String) -> Result<RepoDetectInfo, String> {
    let p = std::path::Path::new(&path);
    if !p.exists() || !p.is_dir() {
        return Err("路径不存在或不是文件夹".to_string());
    }

    // folder name as default repo name
    let name = p
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    // check if git repo
    let repo = match git2::Repository::discover(p) {
        Ok(r) => r,
        Err(_) => {
            return Ok(RepoDetectInfo {
                is_git: false,
                name,
                remote_url: None,
                org: String::new(),
                current_branch: String::new(),
            });
        }
    };

    // get remote URL
    let remote_url = repo
        .find_remote("origin")
        .ok()
        .and_then(|r| r.url().map(|s| s.to_string()));

    // extract org from remote URL
    let org = remote_url
        .as_deref()
        .and_then(|url| {
            // handles https://github.com/Org/Repo.git or git@github.com:Org/Repo.git
            let url = url.trim_end_matches(".git");
            if let Some(rest) = url.strip_prefix("https://") {
                let parts: Vec<&str> = rest.splitn(3, '/').collect();
                if parts.len() >= 2 {
                    return Some(parts[1].to_string());
                }
            } else if url.contains(':') {
                // git@github.com:Org/Repo
                let after_colon = url.split(':').nth(1)?;
                let parts: Vec<&str> = after_colon.splitn(2, '/').collect();
                if !parts.is_empty() {
                    return Some(parts[0].to_string());
                }
            }
            None
        })
        .unwrap_or_default();

    // get current branch
    let current_branch = repo
        .head()
        .ok()
        .and_then(|h| h.shorthand().map(|s| s.to_string()))
        .unwrap_or_default();

    Ok(RepoDetectInfo {
        is_git: true,
        name,
        remote_url,
        org,
        current_branch,
    })
}

// ─── Status & Profile Commands ───────────────────────────────────────────────

#[tauri::command]
fn get_status_info() -> Result<ops::StatusInfo, String> {
    ops::get_status().map_err(|e| e.to_string())
}

#[tauri::command]
fn switch_profile(alias: String, global: bool) -> Result<(), String> {
    ops::switch_profile(&alias, global).map(|_| ()).map_err(|e| e.to_string())
}

#[tauri::command]
fn add_profile(alias: String, name: String, email: String, signing_key: Option<String>) -> Result<(), String> {
    ops::add_profile(&alias, &name, &email, signing_key.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
fn remove_profile(alias: String) -> Result<(), String> {
    ops::remove_profile(&alias).map_err(|e| e.to_string())
}

// ─── GitHub Auth Commands ─────────────────────────────────────────────────────

#[tauri::command]
fn github_request_code() -> Result<haruhikage_git::core::github::DeviceCode, String> {
    ops::github_request_code().map_err(|e| e.to_string())
}

#[tauri::command]
fn github_complete_login(
    alias: String,
    device_code: String,
    user_code: String,
    verification_uri: String,
    interval: u64,
) -> Result<haruhikage_git::core::config::Profile, String> {
    let dev = haruhikage_git::core::github::DeviceCode {
        device_code,
        user_code,
        verification_uri,
        interval,
    };
    ops::github_complete_login(&alias, &dev).map_err(|e| e.to_string())
}

#[tauri::command]
fn github_pat_login(token: String, alias: String) -> Result<haruhikage_git::core::config::Profile, String> {
    ops::github_pat_login(&token, &alias).map_err(|e| e.to_string())
}

// ─── Proxy Commands ───────────────────────────────────────────────────────────

#[tauri::command]
fn get_proxy_status() -> Result<(haruhikage_git::core::config::ProxySettings, Option<String>), String> {
    ops::get_proxy_status().map_err(|e| e.to_string())
}

#[tauri::command]
fn set_proxy_url(url: Option<String>) -> Result<(), String> {
    ops::set_proxy_url(url.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_proxy_auto_detect(enabled: bool) -> Result<(), String> {
    ops::set_proxy_auto_detect(enabled).map_err(|e| e.to_string())
}

// ─── Repository Management Commands ─────────────────────────────────────────

#[tauri::command]
fn get_managed_repositories() -> Result<Vec<haruhikage_git::core::config::ManagedRepository>, String> {
    ops::get_managed_repositories().map_err(|e| e.to_string())
}

#[tauri::command]
fn add_managed_repository(
    name: String,
    path: String,
    organization: String,
    user: String,
    custom_group: String,
) -> Result<(), String> {
    let p = PathBuf::from(path);
    ops::add_managed_repository(&name, p, &organization, &user, &custom_group).map_err(|e| e.to_string())
}

#[tauri::command]
fn remove_managed_repository(path: String) -> Result<(), String> {
    let p = PathBuf::from(path);
    ops::remove_managed_repository(p).map_err(|e| e.to_string())
}

#[tauri::command]
fn switch_active_repository(path: String) -> Result<ops::StatusInfo, String> {
    let p = std::path::Path::new(&path);
    if !p.exists() || !p.is_dir() {
        return Err("目录不存在或不是文件夹".to_string());
    }
    std::env::set_current_dir(p).map_err(|e| format!("切换工作目录失败: {}", e))?;
    ops::get_status().map_err(|e| e.to_string())
}

// ─── Utility Commands ─────────────────────────────────────────────────────────

#[tauri::command]
fn open_in_explorer(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        let cmd = if cfg!(target_os = "macos") { "open" } else { "xdg-open" };
        Command::new(cmd)
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn open_in_vscode(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(&["/c", "code", "."])
            .current_dir(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        Command::new("code")
            .arg(".")
            .current_dir(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn get_current_branch() -> Result<String, String> {
    git::current_branch().map_err(|e| e.to_string())
}

// ─── Tauri Entry Point ────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            // git passthrough
            git_passthrough,
            detect_git_repo_info,
            // status & profiles
            get_status_info,
            switch_profile,
            add_profile,
            remove_profile,
            // github auth
            github_request_code,
            github_complete_login,
            github_pat_login,
            // proxy
            get_proxy_status,
            set_proxy_url,
            set_proxy_auto_detect,
            // repository management
            get_managed_repositories,
            add_managed_repository,
            remove_managed_repository,
            switch_active_repository,
            // utilities
            open_in_explorer,
            open_in_vscode,
            get_current_branch,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
