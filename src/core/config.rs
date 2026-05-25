use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Profile {
    pub name: String,
    pub email: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub signing_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub github_user: Option<String>,
}

/// 代理配置，默认开启自动检测
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxySettings {
    /// 是否自动检测系统代理（默认 true）
    #[serde(default = "default_true")]
    pub auto_detect: bool,
    /// 手动指定代理 URL，优先于自动检测
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
}

fn default_true() -> bool {
    true
}

impl Default for ProxySettings {
    fn default() -> Self {
        Self { auto_detect: true, url: None }
    }
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct Config {
    #[serde(default)]
    pub profiles: HashMap<String, Profile>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub github_client_id: Option<String>,
    #[serde(default)]
    pub proxy: ProxySettings,
}

impl Config {
    /// 数据目录：~/.{APP_NAME}/
    pub fn data_dir() -> Result<PathBuf> {
        let home = dirs::home_dir().context("无法获取 HOME 目录")?;
        let dir = home.join(format!(".{}", crate::APP_NAME));
        fs::create_dir_all(&dir)?;
        Ok(dir)
    }

    pub fn config_path() -> Result<PathBuf> {
        Ok(Self::data_dir()?.join("config.toml"))
    }

    pub fn load() -> Result<Self> {
        let path = Self::config_path()?;
        if !path.exists() {
            return Ok(Self::default());
        }
        let content = fs::read_to_string(&path)
            .with_context(|| format!("读取配置文件失败: {}", path.display()))?;
        toml::from_str(&content).context("解析配置文件失败")
    }

    pub fn save(&self) -> Result<()> {
        let path = Self::config_path()?;
        let content = toml::to_string_pretty(self).context("序列化配置失败")?;
        fs::write(&path, content)
            .with_context(|| format!("写入配置文件失败: {}", path.display()))
    }
}
