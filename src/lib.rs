/// 应用名称，用于目录命名（~/.{APP_NAME}/）等，改名时只需改这里
pub const APP_NAME: &str = "haruhikage-git";

/// 内置 GitHub OAuth App client_id（必须是 OAuth App，不能是 GitHub App）
/// 可通过 `hg github set-client <id>` 覆盖
/// 注册地址: https://github.com/settings/applications/new
pub const GITHUB_CLIENT_ID: &str = "Ov23lii52OuOLzDU1VUV";

pub mod cli;
pub mod core;
