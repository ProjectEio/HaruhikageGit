use haruhikage_git::core::{git, ops};

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

#[tauri::command]
fn get_git_status() -> Result<Vec<git::GitFileStatus>, String> {
    ops::get_git_status().map_err(|e| e.to_string())
}

#[tauri::command]
fn git_pull(alias: Option<String>, global: bool) -> Result<String, String> {
    ops::git_pull(alias.as_deref(), global).map_err(|e| e.to_string())
}

#[tauri::command]
fn git_fetch() -> Result<String, String> {
    ops::git_fetch().map_err(|e| e.to_string())
}

#[tauri::command]
fn git_checkout(target: String) -> Result<String, String> {
    ops::git_checkout(&target).map_err(|e| e.to_string())
}

#[tauri::command]
fn git_create_branch(name: String, start_point: Option<String>) -> Result<String, String> {
    ops::git_create_branch(&name, start_point.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
fn git_delete_branch(name: String, force: bool) -> Result<String, String> {
    ops::git_delete_branch(&name, force).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_git_branches() -> Result<Vec<String>, String> {
    ops::get_git_branches().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_git_commits(limit: usize) -> Result<Vec<git::CommitInfo>, String> {
    ops::get_git_commits(limit).map_err(|e| e.to_string())
}

#[tauri::command]
fn git_stage_files(specs: Vec<String>) -> Result<(), String> {
    ops::git_stage_files(specs).map_err(|e| e.to_string())
}

#[tauri::command]
fn git_unstage_files(specs: Vec<String>) -> Result<(), String> {
    ops::git_unstage_files(specs).map_err(|e| e.to_string())
}

#[tauri::command]
fn git_commit(message: String, all: bool, profile: Option<String>) -> Result<(), String> {
    ops::quick_commit(&message, all, profile.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
fn git_push() -> Result<String, String> {
    ops::git_push().map_err(|e| e.to_string())
}

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

use std::path::PathBuf;
use std::process::Command;

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
fn get_remote_url() -> Result<String, String> {
    let out = Command::new("git")
        .args(&["remote", "get-url", "origin"])
        .output()
        .map_err(|e| e.to_string())?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
    } else {
        Err("没有配置远程源 origin".to_string())
    }
}

#[tauri::command]
fn git_discard_changes() -> Result<(), String> {
    let out1 = Command::new("git")
        .args(&["reset", "--hard", "HEAD"])
        .output()
        .map_err(|e| e.to_string())?;
    if !out1.status.success() {
        return Err(String::from_utf8_lossy(&out1.stderr).trim().to_string());
    }
    let out2 = Command::new("git")
        .args(&["clean", "-df"])
        .output()
        .map_err(|e| e.to_string())?;
    if !out2.status.success() {
        return Err(String::from_utf8_lossy(&out2.stderr).trim().to_string());
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_status_info,
            switch_profile,
            add_profile,
            remove_profile,
            get_git_status,
            git_pull,
            git_fetch,
            git_checkout,
            git_create_branch,
            git_delete_branch,
            get_git_branches,
            get_git_commits,
            git_stage_files,
            git_unstage_files,
            git_commit,
            git_push,
            github_request_code,
            github_complete_login,
            github_pat_login,
            get_proxy_status,
            set_proxy_url,
            set_proxy_auto_detect,
            get_managed_repositories,
            add_managed_repository,
            remove_managed_repository,
            switch_active_repository,
            open_in_explorer,
            open_in_vscode,
            get_remote_url,
            git_discard_changes
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
