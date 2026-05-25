use anyhow::Result;
use clap::{Parser, Subcommand};
use colored::Colorize;

use crate::core::{github::DeviceCode, ops};

// ── clap 结构定义 ────────────────────────────────────────────────────────────

/// git-fast (gf) — 快速切换 git 账户与提交信息
#[derive(Parser)]
#[command(
    name = "gf",
    version,
    about = "快速切换 git 账户与提交信息",
    long_about = None
)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// 查看当前 git 身份和已保存的 Profiles
    Status,

    /// 切换 git 账户（默认切换当前仓库，--global 切换全局）
    Use {
        /// Profile 别名
        alias: String,
        /// 切换全局 git 配置（~/.gitconfig）
        #[arg(short, long)]
        global: bool,
    },

    /// 管理 git 账户 Profiles
    #[command(subcommand)]
    Profile(ProfileCommands),

    /// GitHub OAuth 登录（Device Flow）
    #[command(subcommand)]
    Github(GithubCommands),

    /// 安装 gf 到本地目录并注册 PATH
    Install {
        /// 安装目标目录（默认 ~/.haruhikage-git/bin/）
        #[arg(short, long)]
        dir: Option<String>,
        /// 不修改 PATH
        #[arg(long)]
        no_path: bool,
    },

    /// 代理配置
    #[command(subcommand)]
    Proxy(ProxyCommands),

    /// 推送当前分支到 origin
    Publish,

    /// 快速 git commit
    Commit {
        /// 提交信息
        #[arg(short, long)]
        message: String,
        /// 自动 stage 所有已跟踪文件的变更（git commit -a）
        #[arg(short, long)]
        all: bool,
        /// 提交前先切换到指定 Profile（仅 local）
        #[arg(short = 'p', long = "profile")]
        profile: Option<String>,
    },
}

#[derive(Subcommand)]
enum ProfileCommands {
    /// 添加新 Profile
    Add {
        /// Profile 别名（如 work、personal）
        alias: String,
        /// git user.name
        #[arg(short = 'n', long)]
        name: String,
        /// git user.email
        #[arg(short = 'e', long)]
        email: String,
        /// GPG 签名 key（可选）
        #[arg(short = 'k', long)]
        signing_key: Option<String>,
        /// 添加后立即应用（本仓库），与 --global 配合可应用到全局
        #[arg(short = 'u', long = "use")]
        apply: bool,
        /// 与 --use 配合时应用到全局
        #[arg(short, long)]
        global: bool,
    },
    /// 将当前 git 身份（local 或 --global）直接导入为 Profile
    Import {
        /// 保存用的别名
        alias: String,
        /// 从全局配置（~/.gitconfig）导入
        #[arg(short, long)]
        global: bool,
        /// 导入后立即应用
        #[arg(short = 'u', long = "use")]
        apply: bool,
    },
    /// 更新已有 Profile
    Update {
        /// Profile 别名
        alias: String,
        #[arg(short = 'n', long)]
        name: Option<String>,
        #[arg(short = 'e', long)]
        email: Option<String>,
        #[arg(short = 'k', long)]
        signing_key: Option<String>,
    },
    /// 删除 Profile
    Remove {
        /// Profile 别名
        alias: String,
    },
    /// 列出所有 Profile
    List,
}

#[derive(Subcommand)]
enum ProxyCommands {
    /// 显示当前代理配置及实际生效的代理
    Status,
    /// 开启自动检测系统代理（环境变量 / Windows 注册表）
    Auto,
    /// 关闭代理（自动检测 + 手动 URL 均清除）
    Off,
    /// 手动指定代理 URL
    Set {
        /// 代理地址，如 http://127.0.0.1:7890
        url: String,
    },
}

#[derive(Subcommand)]
enum GithubCommands {
    /// 通过 GitHub OAuth Device Flow 一键登录并创建 Profile
    Login {
        /// 保存的 Profile 别名
        #[arg(default_value = "github")]
        alias: String,
        /// 登录后立即应用到全局
        #[arg(short, long)]
        global: bool,
    },
    /// 配置 GitHub OAuth App 的 client_id（首次使用前需运行一次）
    SetClient {
        /// GitHub OAuth App 的 client_id
        client_id: String,
    },
    /// 在 GitHub 创建仓库并配置本地 remote
    Create {
        /// 仓库名称
        name: String,
        /// 组织名称（不填则在个人账户下创建）
        #[arg(short, long)]
        org: Option<String>,
        /// 创建私有仓库
        #[arg(long)]
        private: bool,
        /// 仓库描述
        #[arg(short, long, default_value = "")]
        desc: String,
        /// 使用哪个 Profile 的 token（默认 "github"）
        #[arg(short, long, default_value = "github")]
        profile: String,
    },
}

// ── 入口 ─────────────────────────────────────────────────────────────────────

/// CLI 入口，由 `main.rs` 调用
pub fn run() -> Result<()> {
    let cli = Cli::parse();
    match cli.command {
        Commands::Status => cmd_status()?,
        Commands::Use { alias, global } => cmd_use(&alias, global)?,
        Commands::Profile(sub) => match sub {
            ProfileCommands::Add { alias, name, email, signing_key, apply, global } => {
                cmd_profile_add(&alias, &name, &email, signing_key.as_deref(), apply, global)?
            }
            ProfileCommands::Import { alias, global, apply } => {
                cmd_profile_import(&alias, global, apply)?
            }
            ProfileCommands::Update { alias, name, email, signing_key } => {
                cmd_profile_update(&alias, name.as_deref(), email.as_deref(), signing_key.as_deref())?
            }
            ProfileCommands::Remove { alias } => cmd_profile_remove(&alias)?,
            ProfileCommands::List => cmd_profile_list()?,
        },
        Commands::Install { dir, no_path } => {
            cmd_install(dir.as_deref().map(std::path::PathBuf::from), !no_path)?
        }
        Commands::Proxy(sub) => match sub {
            ProxyCommands::Status => cmd_proxy_status()?,
            ProxyCommands::Auto => cmd_proxy_auto()?,
            ProxyCommands::Off => cmd_proxy_off()?,
            ProxyCommands::Set { url } => cmd_proxy_set(&url)?,
        },
        Commands::Publish => cmd_publish()?,
        Commands::Github(sub) => match sub {
            GithubCommands::Login { alias, global } => cmd_github_login(&alias, global)?,
            GithubCommands::SetClient { client_id } => cmd_github_set_client(&client_id)?,
            GithubCommands::Create { name, org, private, desc, profile } => {
                cmd_github_create(&name, org.as_deref(), private, &desc, &profile)?
            }
        },
        Commands::Commit { message, all, profile } => {
            cmd_commit(&message, all, profile.as_deref())?
        }
    }
    Ok(())
}

// ── 命令处理（彩色输出层） ────────────────────────────────────────────────────

fn cmd_status() -> Result<()> {
    let info = ops::get_status()?;

    println!("{}", "=== git-fast 状态 ===".bold());
    println!(
        "  {} {}",
        "全局账户:".bold(),
        fmt_identity(info.global_name.as_deref(), info.global_email.as_deref())
    );
    if info.is_repo {
        println!(
            "  {} {}",
            "本仓库:  ".bold(),
            fmt_identity(info.local_name.as_deref(), info.local_email.as_deref())
        );
    } else {
        println!("  {} {}", "本仓库:  ".bold(), "(不在 git 仓库中)".dimmed());
    }

    println!();
    if info.profiles.is_empty() {
        println!("{}", "暂无已保存的 Profile，使用 `gf profile add` 添加".yellow());
    } else {
        println!("{}", "已保存的 Profiles:".bold());
        for (alias, p) in &info.profiles {
            let key_info = p
                .signing_key
                .as_deref()
                .map(|k| format!("  signing-key: {}", k.dimmed()))
                .unwrap_or_default();
            println!(
                "  {} {} <{}>{}",
                alias.cyan().bold(),
                p.name.green(),
                p.email.yellow(),
                key_info
            );
        }
    }

    println!();
    println!(
        "  {} {}",
        "配置文件:".dimmed(),
        info.config_path.display().to_string().dimmed()
    );
    Ok(())
}

fn cmd_use(alias: &str, global: bool) -> Result<()> {
    let profile = ops::switch_profile(alias, global)?;
    let scope = if global {
        "全局 (global)".magenta()
    } else {
        "本仓库 (local)".blue()
    };
    println!(
        "{} 已切换 {} 账户为 {} <{}>",
        "✔".green(),
        scope,
        profile.name.green(),
        profile.email.yellow()
    );
    Ok(())
}

fn cmd_profile_add(
    alias: &str,
    name: &str,
    email: &str,
    signing_key: Option<&str>,
    apply: bool,
    global: bool,
) -> Result<()> {
    ops::add_profile(alias, name, email, signing_key)?;
    println!("{} Profile '{}' 已添加", "✔".green(), alias.cyan());
    if apply {
        cmd_use(alias, global)?;
    }
    Ok(())
}

fn cmd_profile_import(alias: &str, global: bool, apply: bool) -> Result<()> {
    let profile = ops::import_profile(alias, global)?;
    let scope = if global { "全局" } else { "本仓库" };
    println!(
        "{} 已将{}身份 {} <{}> 导入为 Profile '{}'",
        "✔".green(),
        scope,
        profile.name.green(),
        profile.email.yellow(),
        alias.cyan()
    );
    if apply {
        cmd_use(alias, global)?;
    }
    Ok(())
}

fn cmd_profile_update(
    alias: &str,
    name: Option<&str>,
    email: Option<&str>,
    signing_key: Option<&str>,
) -> Result<()> {
    ops::update_profile(alias, name, email, signing_key)?;
    println!("{} Profile '{}' 已更新", "✔".green(), alias.cyan());
    Ok(())
}

fn cmd_profile_remove(alias: &str) -> Result<()> {
    ops::remove_profile(alias)?;
    println!("{} Profile '{}' 已删除", "✔".green(), alias.cyan());
    Ok(())
}

fn cmd_profile_list() -> Result<()> {
    let profiles = ops::list_profiles()?;
    if profiles.is_empty() {
        println!("{}", "暂无 Profile，请使用 `gf profile add` 添加".yellow());
        return Ok(());
    }
    println!("{}", "已保存的 Profiles:".bold());
    for (alias, p) in &profiles {
        let key_info = p
            .signing_key
            .as_deref()
            .map(|k| format!("  signing-key: {}", k.dimmed()))
            .unwrap_or_default();
        println!(
            "  {} {} <{}>{}",
            alias.cyan().bold(),
            p.name.green(),
            p.email.yellow(),
            key_info
        );
    }
    Ok(())
}

// ── GitHub 命令处理 ───────────────────────────────────────────────────────────

fn cmd_github_login(alias: &str, global: bool) -> Result<()> {
    println!("{} 正在向 GitHub 请求授权码...", "→".blue());
    let device: DeviceCode = ops::github_request_code()?;

    println!();
    println!(
        "  请在浏览器打开: {}",
        device.verification_uri.cyan().bold()
    );
    println!("  输入验证码:     {}", device.user_code.green().bold());
    println!();
    println!("{} 等待授权，授权后将自动继续...", "⏳".yellow());

    let profile = ops::github_complete_login(alias, &device)?;

    println!();
    println!("{} GitHub 登录成功！", "✔".green().bold());
    println!(
        "  GitHub 用户名: {}",
        profile.github_user.as_deref().unwrap_or("").cyan()
    );
    println!("  姓名:         {}", profile.name.green());
    println!("  邮箱:         {}", profile.email.yellow());
    println!("  Profile '{}' 已保存", alias.cyan());
    println!(
        "  {} git credential 已配置，可直接 push/pull github.com 仓库",
        "✔".green()
    );

    if global {
        cmd_use(alias, true)?;
    }
    Ok(())
}

fn cmd_github_set_client(client_id: &str) -> Result<()> {
    ops::set_github_client(client_id)?;
    println!("{} GitHub OAuth client_id 已保存", "✔".green());
    println!("  现在可以运行: {}", "gf github login".cyan());
    Ok(())
}

// ── Install ───────────────────────────────────────────────────────────────────

fn cmd_install(dir: Option<std::path::PathBuf>, add_to_path: bool) -> Result<()> {
    let r = ops::install(dir, add_to_path)?;
    println!("{} 已安装到 {}", "✔".green().bold(), r.dest.display().to_string().cyan());
    if r.path_updated {
        println!(
            "  {} 已将 {} 添加到用户 PATH",
            "✔".green(),
            r.dir.display().to_string().cyan()
        );
        println!("  重新打开终端后即可直接使用 {}", "gf".cyan().bold());
    } else if add_to_path {
        println!("  {} 已在 PATH 中，无需修改", r.dir.display().to_string().cyan());
    } else {
        println!(
            "  提示：手动将 {} 添加到 PATH 后即可全局使用 gf",
            r.dir.display().to_string().cyan()
        );
    }
    Ok(())
}

// ── Proxy ─────────────────────────────────────────────────────────────────────

fn cmd_proxy_status() -> Result<()> {
    let (settings, resolved) = ops::get_proxy_status()?;
    println!("=== 代理配置 ===");
    println!(
        "  自动检测: {}",
        if settings.auto_detect { "开启".green().to_string() } else { "关闭".dimmed().to_string() }
    );
    match &settings.url {
        Some(u) => println!("  手动 URL:  {}", u.cyan()),
        None => println!("  手动 URL:  {}", "(未设置)".dimmed()),
    }
    match &resolved {
        Some(u) => println!("  实际使用: {}", u.green().bold()),
        None => println!("  实际使用: {}", "(直连)".dimmed()),
    }
    Ok(())
}

fn cmd_proxy_auto() -> Result<()> {
    ops::set_proxy_auto_detect(true)?;
    println!("{} 已开启代理自动检测", "✔".green());
    println!("  将自动读取 HTTPS_PROXY 环境变量 / Windows 系统代理");
    Ok(())
}

fn cmd_proxy_off() -> Result<()> {
    ops::set_proxy_url(None)?;
    ops::set_proxy_auto_detect(false)?;
    println!("{} 代理已关闭（直连）", "✔".green());
    Ok(())
}

fn cmd_proxy_set(url: &str) -> Result<()> {
    ops::set_proxy_url(Some(url))?;
    println!("{} 代理已设置为 {}", "✔".green(), url.cyan());
    Ok(())
}

// ── Publish ───────────────────────────────────────────────────────────────────

fn cmd_publish() -> Result<()> {
    let branch = ops::git_push()?;
    println!("{} 已推送分支 {} 到 origin", "✔".green().bold(), branch.cyan());
    Ok(())
}

// ── Github Create ─────────────────────────────────────────────────────────────

fn cmd_github_create(
    name: &str,
    org: Option<&str>,
    private: bool,
    desc: &str,
    profile: &str,
) -> Result<()> {
    let info = ops::github_create_repo(profile, name, org, desc, private)?;
    println!("{} GitHub 仓库已创建！", "✔".green().bold());
    println!("  URL:       {}", info.html_url.cyan());
    println!("  Clone URL: {}", info.clone_url.dimmed());
    println!("  已配置本地 remote origin → {}", info.clone_url.cyan());
    println!();
    println!("现在可以运行：{}", "gf publish".cyan().bold());
    Ok(())
}

fn cmd_commit(message: &str, all: bool, profile: Option<&str>) -> Result<()> {
    if let Some(alias) = profile {
        let p = ops::switch_profile(alias, false)?;
        println!(
            "{} 切换至 {} <{}>",
            "→".blue(),
            p.name.green(),
            p.email.yellow()
        );
    }
    ops::quick_commit(message, all, None)?;
    println!("{} 提交成功: {}", "✔".green(), message.cyan());
    Ok(())
}

// ── 输出工具函数 ──────────────────────────────────────────────────────────────

fn fmt_identity(name: Option<&str>, email: Option<&str>) -> String {
    match (name, email) {
        (Some(n), Some(e)) => format!("{} <{}>", n.green(), e.yellow()),
        (Some(n), None) => format!("{} (无邮箱)", n.green()),
        (None, Some(e)) => format!("(无姓名) <{}>", e.yellow()),
        (None, None) => "(未配置)".dimmed().to_string(),
    }
}
