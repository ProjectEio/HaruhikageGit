/// 应用名称，用于目录命名（~/.{APP_NAME}/）等，改名时只需改这里
pub const APP_NAME: &str = "haruhikage-git";

/// 内置 GitHub OAuth App client_id（可通过 `gf github set-client` 覆盖）
pub const GITHUB_CLIENT_ID: &str = "Iv23lieUKkjriv9oXKxI";

pub mod cli;
pub mod core;
