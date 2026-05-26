use crate::core::config::ProxySettings;

pub fn resolve(settings: &ProxySettings) -> Option<String> {
    if let Some(ref url) = settings.url {
        return Some(url.clone());
    }

    if !settings.auto_detect {
        return None;
    }
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


pub fn build_agent(settings: &ProxySettings) -> ureq::Agent {
    let mut builder = ureq::AgentBuilder::new();
    if let Some(url) = resolve(settings) {
        if let Ok(proxy) = ureq::Proxy::new(&url) {
            builder = builder.proxy(proxy);
        }
    }
    builder.build()
}
