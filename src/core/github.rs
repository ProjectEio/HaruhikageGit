use std::{thread, time::Duration};

use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};

use crate::core::config::ProxySettings;

const DEVICE_CODE_URL: &str = "https://github.com/login/device/code";
const TOKEN_URL: &str = "https://github.com/login/oauth/access_token";
const API_BASE: &str = "https://api.github.com";
const SCOPES: &str = "repo read:user user:email admin:org";
const UA: &str = concat!("HaruhikageGit/", env!("CARGO_PKG_VERSION"));

// ── 类型定义 ──────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct DeviceCode {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub interval: u64,
}

#[derive(Deserialize)]
struct RawDeviceCode {
    device_code: Option<String>,
    user_code: Option<String>,
    verification_uri: Option<String>,
    interval: Option<u64>,
    error: Option<String>,
    error_description: Option<String>,
}

#[derive(Deserialize)]
struct TokenPoll {
    access_token: Option<String>,
    error: Option<String>,
    interval: Option<u64>,
}

#[derive(Debug, Deserialize)]
pub struct GitHubUser {
    pub login: String,
    pub name: Option<String>,
    pub email: Option<String>,
}

#[derive(Deserialize)]
struct EmailEntry {
    email: String,
    primary: bool,
    verified: bool,
}

#[derive(Debug)]
pub struct RepoInfo {
    pub html_url: String,
    pub clone_url: String,
    pub ssh_url: String,
}

// ── Client ────────────────────────────────────────────────────────────────────

/// GitHub API 客户端，持有带代理配置的 ureq::Agent
pub struct Client {
    agent: ureq::Agent,
}

impl Client {
    pub fn new(proxy: &ProxySettings) -> Self {
        Self {
            agent: crate::core::proxy::build_agent(proxy),
        }
    }

    fn auth_header(token: &str) -> String {
        format!("Bearer {}", token)
    }

    // ── OAuth Device Flow ──────────────────────────────────────────────────

    pub fn request_device_code(&self, client_id: &str) -> Result<DeviceCode> {
        let raw: RawDeviceCode = self
            .agent
            .post(DEVICE_CODE_URL)
            .set("Accept", "application/json")
            .send_form(&[("client_id", client_id), ("scope", SCOPES)])
            .context("无法连接到 GitHub，请检查网络或代理配置")?
            .into_json()
            .context("解析 device code 响应失败")?;

        if let Some(ref err) = raw.error {
            let desc = raw.error_description.as_deref().unwrap_or("");
            bail!("GitHub 拒绝请求: {} — {}\n请确认 client_id 正确", err, desc);
        }

        Ok(DeviceCode {
            device_code: raw.device_code.context("响应缺少 device_code")?,
            user_code: raw.user_code.context("响应缺少 user_code")?,
            verification_uri: raw
                .verification_uri
                .context("响应缺少 verification_uri")?,
            interval: raw.interval.unwrap_or(5),
        })
    }

    pub fn poll_for_token(&self, client_id: &str, device: &DeviceCode) -> Result<String> {
        let mut wait = device.interval.max(5);
        loop {
            thread::sleep(Duration::from_secs(wait));

            let poll: TokenPoll = self
                .agent
                .post(TOKEN_URL)
                .set("Accept", "application/json")
                .send_form(&[
                    ("client_id", client_id),
                    ("device_code", &device.device_code),
                    ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
                ])
                .context("轮询授权时网络失败")?
                .into_json()
                .context("解析授权轮询响应失败")?;

            match poll.error.as_deref() {
                None => {
                    return poll
                        .access_token
                        .ok_or_else(|| anyhow::anyhow!("授权成功但响应中缺少 access_token"))
                }
                Some("authorization_pending") => {}
                Some("slow_down") => wait = poll.interval.unwrap_or(wait + 5),
                Some("expired_token") => {
                    bail!("验证码已过期，请重新运行 `hg github login`")
                }
                Some("access_denied") => bail!("授权被取消"),
                Some(e) => bail!("授权错误: {}", e),
            }
        }
    }

    // ── 用户信息 ───────────────────────────────────────────────────────────

    pub fn get_user(&self, token: &str) -> Result<GitHubUser> {
        self.agent
            .get(&format!("{}/user", API_BASE))
            .set("Authorization", &Self::auth_header(token))
            .set("Accept", "application/vnd.github+json")
            .set("User-Agent", UA)
            .call()
            .context("获取 GitHub 用户信息失败")?
            .into_json::<GitHubUser>()
            .context("解析用户信息失败")
    }

    pub fn get_primary_email(&self, token: &str) -> Result<Option<String>> {
        let emails: Vec<EmailEntry> = self
            .agent
            .get(&format!("{}/user/emails", API_BASE))
            .set("Authorization", &Self::auth_header(token))
            .set("Accept", "application/vnd.github+json")
            .set("User-Agent", UA)
            .call()
            .context("获取邮箱列表失败")?
            .into_json()
            .context("解析邮箱列表失败")?;

        Ok(emails
            .into_iter()
            .find(|e| e.primary && e.verified)
            .map(|e| e.email))
    }

    // ── 仓库管理 ──────────────────────────────────────────────────

    /// 创建 GitHub 仓库（org 为 None 时创建在个人账户下）
    /// 要求 token 来自 OAuth App（不能是 GitHub App）且包含 repo scope
    pub fn create_repo(
        &self,
        token: &str,
        name: &str,
        org: Option<&str>,
        description: &str,
        private: bool,
    ) -> Result<RepoInfo> {
        let url = match org {
            Some(o) => format!("{}/orgs/{}/repos", API_BASE, o),
            None => format!("{}/user/repos", API_BASE),
        };

        let resp = self
            .agent
            .post(&url)
            .set("Authorization", &Self::auth_header(token))
            .set("Accept", "application/vnd.github+json")
            .set("User-Agent", UA)
            .send_json(ureq::json!({
                "name": name,
                "description": description,
                "private": private,
                "auto_init": false,
            }))
            .map_err(|e| match e {
                ureq::Error::Status(code, resp) => {
                    let body = resp.into_string().unwrap_or_default();
                    let msg = serde_json::from_str::<serde_json::Value>(&body)
                        .ok()
                        .and_then(|v| v["message"].as_str().map(|s| s.to_string()))
                        .unwrap_or(body);
                    anyhow::anyhow!("GitHub API {} 错误: {}", code, msg)
                }
                other => anyhow::anyhow!(other).context("创建仓库网络失败"),
            })?;

        let json: serde_json::Value = resp.into_json().context("解析创建仓库响应失败")?;
        Ok(RepoInfo {
            html_url: json["html_url"]
                .as_str()
                .context("响应缺少 html_url")?
                .to_string(),
            clone_url: json["clone_url"]
                .as_str()
                .context("响应缺少 clone_url")?
                .to_string(),
            ssh_url: json["ssh_url"]
                .as_str()
                .context("响应缺少 ssh_url")?
                .to_string(),
        })
    }
}
