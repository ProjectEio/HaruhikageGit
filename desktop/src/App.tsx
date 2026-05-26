import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

// --- Components & Types ---
import { StatusInfo, DeviceCode, ProxySettings, Notification, ManagedRepository } from "./types";
import { TopNavBar } from "./components/TopNavBar";
import { AddProfileModal, GithubLoginModal, ProxyModal } from "./components/Modals";
import { AccountManager } from "./components/AccountManager";

function App() {
  const appWindow = getCurrentWindow();

  // --- States ---
  const [status, setStatus] = useState<StatusInfo | null>(null);
  const [currentBranch, setCurrentBranch] = useState<string>("unknown");
  
  // Multi-repository states
  const [repos, setRepos] = useState<ManagedRepository[]>([]);
  const [activeRepoPath, setActiveRepoPath] = useState<string | null>(null);

  // Proxy States
  const [proxyAuto, setProxyAuto] = useState(true);
  const [proxyUrl, setProxyUrl] = useState("");
  const [effectiveProxy, setEffectiveProxy] = useState<string | null>(null);

  // Active Modals
  const [activeModal, setActiveModal] = useState<"add" | "github" | "proxy" | null>(null);

  // Notification States
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Add Profile form
  const [newAlias, setNewAlias] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newGpg, setNewGpg] = useState("");

  // GitHub OAuth Flow States
  const [githubAlias, setGithubAlias] = useState("github");
  const [githubPat, setGithubPat] = useState("");
  const [githubDevice, setGithubDevice] = useState<DeviceCode | null>(null);
  const [githubPollingMsg, setGithubPollingMsg] = useState("等待用户在浏览器中完成授权...");

  const githubPollingRef = useRef<number | null>(null);

  // --- Notification Helper ---
  const showNotif = (message: string, type: "success" | "danger" | "info" = "success") => {
    const id = Date.now() + Math.random();
    setNotifications((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 3500);
  };

  // --- Reload Managed Repositories ---
  const loadRepos = async () => {
    try {
      const list: ManagedRepository[] = await invoke("get_managed_repositories");
      setRepos(list);
      
      // Auto-set first repo as active if not yet set and we have repos
      if (list.length > 0 && !activeRepoPath) {
        setActiveRepoPath(list[0].path);
        await invoke("switch_active_repository", { path: list[0].path });
      }
    } catch (err) {
      console.error("加载托管仓库列表失败:", err);
    }
  };

  // --- Reload All State Data ---
  const reloadData = async () => {
    try {
      const res: StatusInfo = await invoke("get_status_info");
      setStatus(prev => {
        if (prev && JSON.stringify(prev) === JSON.stringify(res)) return prev;
        return res;
      });

      if (res.is_repo) {
        if (!activeRepoPath) {
          try {
            const root: string = await invoke("get_git_root");
            setActiveRepoPath(root);
            await invoke("switch_active_repository", { path: root });
          } catch (e) {
            console.error("Failed to get git root", e);
          }
        }

        // Fetch Current Branch
        try {
          const c: string = await invoke("get_current_branch");
          setCurrentBranch(c);
        } catch (e) {
          setCurrentBranch("unknown");
        }
      } else {
        setCurrentBranch("");
      }
    } catch (err) {
      console.error("加载数据失败:", err);
    }
  };

  // --- Setup Polling Loops ---
  useEffect(() => {
    loadRepos();
  }, []);

  useEffect(() => {
    reloadData();
    const interval = setInterval(() => {
      if (!activeModal) {
        reloadData();
      }
    }, 4500);
    return () => clearInterval(interval);
  }, [activeModal, activeRepoPath]);

  // --- GitHub OAuth Token Polling ---
  useEffect(() => {
    if (!githubDevice) {
      if (githubPollingRef.current) {
        clearInterval(githubPollingRef.current);
        githubPollingRef.current = null;
      }
      return;
    }

    let attempts = 0;
    const maxAttempts = 60;
    setGithubPollingMsg("等待用户在浏览器中完成授权...");

    githubPollingRef.current = window.setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        if (githubPollingRef.current) clearInterval(githubPollingRef.current);
        setGithubDevice(null);
        setGithubPollingMsg("验证超时，请重试");
        showNotif("GitHub 授权轮询已超时", "danger");
        return;
      }

      try {
        await invoke("github_complete_login", {
          alias: githubAlias,
          deviceCode: githubDevice.device_code,
          userCode: githubDevice.user_code,
          verificationUri: githubDevice.verification_uri,
          interval: githubDevice.interval,
        });

        // Successful login
        if (githubPollingRef.current) clearInterval(githubPollingRef.current);
        setGithubDevice(null);
        setActiveModal(null);
        showNotif(`GitHub 一键登录成功！别名 '${githubAlias}' 已创建`, "success");
        reloadData();
      } catch (err: any) {
        if (err.includes("authorization_pending")) {
          // Keep polling
        } else {
          if (githubPollingRef.current) clearInterval(githubPollingRef.current);
          setGithubDevice(null);
          setGithubPollingMsg("授权失败: " + err);
          showNotif("GitHub 登录授权错误: " + err, "danger");
        }
      }
    }, githubDevice.interval * 1000);

    return () => {
      if (githubPollingRef.current) {
        clearInterval(githubPollingRef.current);
      }
    };
  }, [githubDevice, githubAlias]);

  // --- Action Functions ---

  const handleSwitchRepo = async (path: string) => {
    try {
      showNotif(`正在切换至仓库: ${path}`, "info");
      await invoke("switch_active_repository", { path });
      setActiveRepoPath(path);
      showNotif(`成功切换仓库工作区！`, "success");
      reloadData();
    } catch (err) {
      showNotif("切换仓库失败: " + err, "danger");
    }
  };

  const handleAddRepo = async (name: string, path: string, org: string, user: string, group: string) => {
    try {
      await invoke("add_managed_repository", { name, path, organization: org, user, customGroup: group });
      showNotif(`托管仓库 '${name}' 添加成功！`, "success");
      loadRepos();
      setActiveRepoPath(path);
    } catch (err) {
      showNotif("添加托管仓库失败: " + err, "danger");
    }
  };

  const handleRemoveRepo = async (path: string) => {
    try {
      await invoke("remove_managed_repository", { path });
      showNotif(`已成功取消该仓库的托管`, "success");
      loadRepos();
      if (activeRepoPath === path) {
        setActiveRepoPath(null);
      }
    } catch (err) {
      showNotif("删除托管失败: " + err, "danger");
    }
  };

  const handleSwitchProfile = async (alias: string, global: boolean) => {
    try {
      await invoke("switch_profile", { alias, global });
      showNotif(`已应用别名 '${alias}' 到${global ? "全局" : "当前项目"}`, "success");
      reloadData();
    } catch (err) {
      showNotif("应用 Profile 失败: " + err, "danger");
    }
  };

  const handleDeleteProfile = async (alias: string) => {
    if (confirm(`确认要删除别名为 '${alias}' 的 Profile 吗？`)) {
      try {
        await invoke("remove_profile", { alias });
        showNotif(`别名 '${alias}' 已被安全删除`, "success");
        reloadData();
      } catch (err) {
        showNotif("删除 Profile 失败: " + err, "danger");
      }
    }
  };

  const handleOpenProxy = async () => {
    try {
      const [proxy, effective]: [ProxySettings, string | null] = await invoke("get_proxy_status");
      setProxyAuto(proxy.auto_detect);
      setProxyUrl(proxy.url || "");
      setEffectiveProxy(effective);
      setActiveModal("proxy");
    } catch (err) {
      showNotif("拉取代理配置失败: " + err, "danger");
    }
  };

  const handleSaveProxy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await invoke("set_proxy_auto_detect", { enabled: proxyAuto });
      await invoke("set_proxy_url", { url: proxyUrl.trim() || null });
      showNotif("网络代理设置保存成功", "success");
      setActiveModal(null);
      reloadData();
    } catch (err) {
      showNotif("保存网络代理失败: " + err, "danger");
    }
  };

  const handleAddProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlias.trim() || !newName.trim() || !newEmail.trim()) {
      showNotif("必须填写别名、姓名和邮箱", "danger");
      return;
    }
    try {
      await invoke("add_profile", {
        alias: newAlias.trim(),
        name: newName.trim(),
        email: newEmail.trim(),
        signingKey: newGpg.trim() || null,
      });
      showNotif(`新别名 '${newAlias}' 已成功创建并保存`, "success");
      setActiveModal(null);
      reloadData();
    } catch (err) {
      showNotif("添加别名失败: " + err, "danger");
    }
  };

  const handleGitHubCodeRequest = async () => {
    if (!githubAlias.trim()) {
      showNotif("请输入要保存的别名", "danger");
      return;
    }
    try {
      const device: DeviceCode = await invoke("github_request_code");
      setGithubDevice(device);
    } catch (err) {
      showNotif("向 GitHub 请求验证码失败: " + err, "danger");
    }
  };

  const handleGitHubPatSubmit = async () => {
    if (!githubAlias.trim() || !githubPat.trim()) {
      showNotif("请输入别名和 PAT 令牌", "danger");
      return;
    }
    try {
      showNotif("正在使用 PAT 登录 GitHub...", "info");
      await invoke("github_pat_login", { token: githubPat.trim(), alias: githubAlias.trim() });
      showNotif(`GitHub 登录成功！Profile '${githubAlias}' 已创建`, "success");
      setActiveModal(null);
      reloadData();
    } catch (err) {
      showNotif("PAT 登录授权失败: " + err, "danger");
    }
  };

  const handleClose = async () => {
    try {
      await appWindow.close();
    } catch (err) {
      console.error("关闭窗口失败:", err);
    }
  };

  const handleHeaderMouseDown = async (e: React.MouseEvent) => {
    if (e.button === 0 && !(e.target as HTMLElement).closest("button, select, input, a")) {
      try {
        await appWindow.startDragging();
      } catch (err) {
        console.error("Failed to start dragging:", err);
      }
    }
  };

  return (
    <div className="app-container">
      {/* Top Titlebar Navigation (Abbreviation/logo removed, and solid text colors instead of gradient) */}
      <header className="app-header" data-tauri-drag-region onMouseDown={handleHeaderMouseDown} style={{ height: "30px", minHeight: "30px", padding: "0 10px" }}>
        <div className="brand" data-tauri-drag-region>
          <span className="title" data-tauri-drag-region style={{ paddingLeft: "4px", fontSize: "0.85rem", fontWeight: "600" }}>
            HaruhikageGit
          </span>
        </div>
        <div className="header-actions">
          <button
            className="win-btn-flat"
            onClick={handleOpenProxy}
            title="设置与代理"
          >
            ⚙
          </button>
          <button
            className="win-btn-flat close-btn-flat"
            onClick={handleClose}
            title="关闭窗口"
          >
            ✕
          </button>
        </div>
      </header>
      
      {/* Top Navigation Bar */}
        <TopNavBar
          repos={repos}
          activeRepoPath={activeRepoPath}
          onSelectRepo={handleSwitchRepo}
          onAddRepo={handleAddRepo}
          currentBranch={currentBranch}
          onRemoveRepo={handleRemoveRepo}
        />

      <AccountManager
        status={status}
        onAddProfile={() => setActiveModal("add")}
        onGithubLogin={() => setActiveModal("github")}
        onSwitchProfile={handleSwitchProfile}
        onDeleteProfile={handleDeleteProfile}
        onOpenProxy={handleOpenProxy}
      />

      {/* MODALS */}
      <AddProfileModal
        isOpen={activeModal === "add"}
        onClose={() => setActiveModal(null)}
        newAlias={newAlias}
        setNewAlias={setNewAlias}
        newName={newName}
        setNewName={setNewName}
        newEmail={newEmail}
        setNewEmail={setNewEmail}
        newGpg={newGpg}
        setNewGpg={setNewGpg}
        onSubmit={handleAddProfileSubmit}
      />

      <GithubLoginModal
        isOpen={activeModal === "github"}
        onClose={() => {
          setGithubDevice(null);
          setActiveModal(null);
        }}
        githubAlias={githubAlias}
        setGithubAlias={setGithubAlias}
        githubPat={githubPat}
        setGithubPat={setGithubPat}
        githubDevice={githubDevice}
        githubPollingMsg={githubPollingMsg}
        onRequestCode={handleGitHubCodeRequest}
        onPatSubmit={handleGitHubPatSubmit}
      />

      <ProxyModal
        isOpen={activeModal === "proxy"}
        onClose={() => setActiveModal(null)}
        proxyAuto={proxyAuto}
        setProxyAuto={setProxyAuto}
        proxyUrl={proxyUrl}
        setProxyUrl={setProxyUrl}
        effectiveProxy={effectiveProxy}
        onSubmit={handleSaveProxy}
      />

      {/* Notifications Portal */}
      <div style={{ position: "fixed", bottom: "20px", right: "20px", zIndex: 9999, display: "flex", flexDirection: "column", gap: "10px" }}>
        {notifications.map((n) => {
          let bg = "linear-gradient(135deg, #3b82f6, #2563eb)";
          let prefix = "";
          if (n.type === "success") {
            bg = "linear-gradient(135deg, #ec4899, #db2777)"; // Sakura pink notification
            prefix = "";
          } else if (n.type === "danger") {
            bg = "linear-gradient(135deg, #ef4444, #dc2626)";
            prefix = "";
          }

          return (
            <div
              key={n.id}
              style={{
                background: bg,
                padding: "12px 24px",
                borderRadius: "8px",
                color: "#fff",
                boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                fontSize: "0.85rem",
                fontWeight: "600",
                animation: "modalIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
              }}
            >
              {prefix}
              {n.message}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default App;
