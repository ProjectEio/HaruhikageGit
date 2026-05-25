use crate::core::config::ProxySettings;

/// 根据配置解析最终使用的代理 URL
/// 优先级：手动指定 URL > 环境变量 > Windows 注册表（仅 auto_detect=true 时）
pub fn resolve(settings: &ProxySettings) -> Option<String> {
    if let Some(ref url) = settings.url {
        return Some(url.clone());
    }

    if !settings.auto_detect {
        return None;
    }

    // 检查环境变量（Clash/V2Ray 等工具会设置这些）
    let from_env = std::env::var("HTTPS_PROXY")
        .or_else(|_| std::env::var("https_proxy"))
        .or_else(|_| std::env::var("HTTP_PROXY"))
        .or_else(|_| std::env::var("http_proxy"))
        .or_else(|_| std::env::var("ALL_PROXY"))
        .ok()
        .filter(|s| !s.is_empty());

    if from_env.is_some() {
        return from_env;
    }

    // Windows 系统代理（注册表）
    #[cfg(windows)]
    {
        if let Some(url) = windows_system_proxy() {
            return Some(url);
        }
    }

    None
}

#[cfg(windows)]
fn windows_system_proxy() -> Option<String> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let key = hkcu
        .open_subkey(r"Software\Microsoft\Windows\CurrentVersion\Internet Settings")
        .ok()?;

    let enabled: u32 = key.get_value("ProxyEnable").ok()?;
    if enabled == 0 {
        return None;
    }

    let server: String = key.get_value("ProxyServer").ok()?;
    // ProxyServer 可以是 "127.0.0.1:7890" 或 "http=127.0.0.1:7890;https=127.0.0.1:7890"
    let url = if server.contains('=') {
        server
            .split(';')
            .find_map(|part| {
                let mut kv = part.splitn(2, '=');
                let proto = kv.next()?.trim().to_lowercase();
                let addr = kv.next()?.trim();
                if proto == "https" || proto == "http" {
                    Some(format!("http://{}", addr))
                } else {
                    None
                }
            })
            .unwrap_or_else(|| format!("http://{}", server))
    } else {
        format!("http://{}", server)
    };

    Some(url)
}

/// 构建带代理配置的 ureq::Agent
pub fn build_agent(settings: &ProxySettings) -> ureq::Agent {
    let mut builder = ureq::AgentBuilder::new();
    if let Some(url) = resolve(settings) {
        if let Ok(proxy) = ureq::Proxy::new(&url) {
            builder = builder.proxy(proxy);
        }
    }
    builder.build()
}
