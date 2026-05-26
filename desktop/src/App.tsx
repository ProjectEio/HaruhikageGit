import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";

import { StatusInfo, DeviceCode, ProxySettings, Notification, ManagedRepository } from "./types";
import { AddProfileModal, GithubLoginModal, ProxyModal } from "./components/Modals";
import { RepoPanel } from "./components/RepoPanel";
import { AccountPanel } from "./components/AccountPanel";
import "./App.css";

function App() {
  const appWindow = getCurrentWindow();

  // Core State
  const [status, setStatus] = useState<StatusInfo | null>(null);
  const [repos, setRepos] = useState<ManagedRepository[]>([]);
  const [activeRepoPath, setActiveRepoPath] = useState<string | null>(null);
  const [currentBranch, setCurrentBranch] = useState<string>("");

  // Proxy State
  const [proxyAuto, setProxyAuto] = useState(true);
  const [proxyUrl, setProxyUrl] = useState("");
  const [effectiveProxy, setEffectiveProxy] = useState<string | null>(null);

  // Modal State
  const [activeModal, setActiveModal] = useState<"add" | "github" | "proxy" | null>(null);

  // Notifications
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Drag-over state for visual feedback
  const [isDragOver, setIsDragOver] = useState(false);

  // Add Profile Form
  const [newAlias, setNewAlias] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newGpg, setNewGpg] = useState("");

  // GitHub OAuth
  const [githubAlias, setGithubAlias] = useState("github");
  const [githubPat, setGithubPat] = useState("");
  const [githubDevice, setGithubDevice] = useState<DeviceCode | null>(null);
  const [githubPollingMsg, setGithubPollingMsg] = useState("等待用户在浏览器中完成授权...");
  const githubPollingRef = useRef<number | null>(null);

  // ─── Helpers ─────────────────────────────────────────────────────────────

  const showNotif = (message: string, type: "success" | "danger" | "info" = "success") => {
    const id = Date.now() + Math.random();
    setNotifications((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setNotifications((prev) => prev.filter((n) => n.id !== id)), 3500);
  };

  // ─── Data Loading ─────────────────────────────────────────────────────────

  const loadRepos = async () => {
    try {
      const list: ManagedRepository[] = await invoke("get_managed_repositories");
      setRepos(list);
      if (list.length > 0 && !activeRepoPath) {
        const first = list[0].path;
        setActiveRepoPath(first);
        await invoke("switch_active_repository", { path: first });
      }
    } catch (err) {
      console.error("加载仓库列表失败:", err);
    }
  };

  const reloadData = async () => {
    try {
      const res: StatusInfo = await invoke("get_status_info");
      setStatus((prev) => {
        if (prev && JSON.stringify(prev) === JSON.stringify(res)) return prev;
        return res;
      });
      if (res.is_repo) {
        try {
          const b: string = await invoke("get_current_branch");
          setCurrentBranch(b);
        } catch {
          setCurrentBranch("");
        }
      } else {
        setCurrentBranch("");
      }
    } catch (err) {
      console.error("加载状态失败:", err);
    }
  };

  // ─── Effects ──────────────────────────────────────────────────────────────

  useEffect(() => {
    loadRepos();
  }, []);

  useEffect(() => {
    reloadData();
    const interval = setInterval(() => {
      if (!activeModal) reloadData();
    }, 5000);
    return () => clearInterval(interval);
  }, [activeModal, activeRepoPath]);

  // Tauri v2 drag-drop events
  useEffect(() => {
    // Tauri v2: drag-enter for visual feedback
    const unlistenEnter = listen("tauri://drag-enter", () => {
      setIsDragOver(true);
    });

    // Tauri v2: drag-leave to clear visual feedback
    const unlistenLeave = listen("tauri://drag-leave", () => {
      setIsDragOver(false);
    });

    // Tauri v2: actual drop event - payload is { paths: string[], position: {...} }
    const unlistenDrop = listen<{ paths: string[] }>("tauri://drag-drop", async (event) => {
      setIsDragOver(false);
      const paths: string[] = event.payload?.paths ?? [];
      if (paths.length === 0) return;

      for (const p of paths) {
        try {
          const info: any = await invoke("detect_git_repo_info", { path: p });
          if (info.is_git) {
            try {
              await invoke("add_managed_repository", {
                name: info.name,
                path: p,
                organization: info.org || "未分组",
                user: "",
                customGroup: "拖入",
              });
              showNotif(`✓ 已添加仓库 "${info.name}"`, "success");
              await loadRepos();
              await invoke("switch_active_repository", { path: p });
              setActiveRepoPath(p);
              reloadData();
            } catch (addErr: any) {
              if (String(addErr).includes("已被添加")) {
                await invoke("switch_active_repository", { path: p });
                setActiveRepoPath(p);
                reloadData();
                showNotif(`已切换到 "${info.name}"`, "info");
              } else {
                showNotif("添加仓库失败: " + String(addErr), "danger");
              }
            }
          } else {
            showNotif(`"${p.split(/[\\/]/).pop()}" 不是 Git 仓库`, "danger");
          }
        } catch (err) {
          showNotif("检测仓库失败: " + String(err), "danger");
        }
      }
    });

    return () => {
      unlistenEnter.then(fn => fn());
      unlistenLeave.then(fn => fn());
      unlistenDrop.then(fn => fn());
    };
  }, []);

  // GitHub OAuth polling
  useEffect(() => {
    if (!githubDevice) {
      if (githubPollingRef.current) { clearInterval(githubPollingRef.current); githubPollingRef.current = null; }
      return;
    }
    let attempts = 0;
    setGithubPollingMsg("等待用户在浏览器中完成授权...");
    githubPollingRef.current = window.setInterval(async () => {
      attempts++;
      if (attempts > 60) {
        clearInterval(githubPollingRef.current!);
        setGithubDevice(null);
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
        clearInterval(githubPollingRef.current!);
        setGithubDevice(null);
        setActiveModal(null);
        showNotif(`GitHub 登录成功！别名 '${githubAlias}' 已创建`, "success");
        reloadData();
      } catch (err: any) {
        if (!String(err).includes("authorization_pending")) {
          clearInterval(githubPollingRef.current!);
          setGithubDevice(null);
          showNotif("GitHub 登录失败: " + err, "danger");
        }
      }
    }, githubDevice.interval * 1000);
    return () => { if (githubPollingRef.current) clearInterval(githubPollingRef.current); };
  }, [githubDevice, githubAlias]);

  // ─── Action Handlers ──────────────────────────────────────────────────────

  const handleSwitchRepo = async (path: string) => {
    try {
      await invoke("switch_active_repository", { path });
      setActiveRepoPath(path);
      reloadData();
    } catch (err) {
      showNotif("切换仓库失败: " + err, "danger");
    }
  };

  const handleAddRepo = async (name: string, path: string, org: string, user: string, group: string) => {
    try {
      await invoke("add_managed_repository", { name, path, organization: org, user, customGroup: group });
      showNotif(`仓库 '${name}' 添加成功！`, "success");
      await loadRepos();
      setActiveRepoPath(path);
    } catch (err) {
      showNotif("添加仓库失败: " + err, "danger");
    }
  };

  const handleRemoveRepo = async (path: string) => {
    try {
      await invoke("remove_managed_repository", { path });
      showNotif("已取消托管该仓库", "success");
      await loadRepos();
      if (activeRepoPath === path) setActiveRepoPath(null);
    } catch (err) {
      showNotif("删除失败: " + err, "danger");
    }
  };

  const handleSwitchProfile = async (alias: string, global: boolean) => {
    try {
      await invoke("switch_profile", { alias, global });
      showNotif(`已应用 '${alias}' 到${global ? "全局" : "当前仓库"}`, "success");
      reloadData();
    } catch (err) {
      showNotif("应用 Profile 失败: " + err, "danger");
    }
  };

  const handleDeleteProfile = async (alias: string) => {
    if (!confirm(`确认删除 Profile '${alias}'？`)) return;
    try {
      await invoke("remove_profile", { alias });
      showNotif(`Profile '${alias}' 已删除`, "success");
      reloadData();
    } catch (err) {
      showNotif("删除失败: " + err, "danger");
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
      showNotif("加载代理配置失败: " + err, "danger");
    }
  };

  const handleSaveProxy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await invoke("set_proxy_auto_detect", { enabled: proxyAuto });
      await invoke("set_proxy_url", { url: proxyUrl.trim() || null });
      showNotif("代理设置已保存", "success");
      setActiveModal(null);
    } catch (err) {
      showNotif("保存失败: " + err, "danger");
    }
  };

  const handleAddProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlias.trim() || !newName.trim() || !newEmail.trim()) {
      showNotif("别名、姓名和邮箱不能为空", "danger");
      return;
    }
    try {
      await invoke("add_profile", {
        alias: newAlias.trim(),
        name: newName.trim(),
        email: newEmail.trim(),
        signingKey: newGpg.trim() || null,
      });
      showNotif(`Profile '${newAlias}' 创建成功`, "success");
      setActiveModal(null);
      setNewAlias(""); setNewName(""); setNewEmail(""); setNewGpg("");
      reloadData();
    } catch (err) {
      showNotif("添加失败: " + err, "danger");
    }
  };

  const handleGitHubCodeRequest = async () => {
    if (!githubAlias.trim()) { showNotif("请输入别名", "danger"); return; }
    try {
      const device: DeviceCode = await invoke("github_request_code");
      setGithubDevice(device);
    } catch (err) {
      showNotif("请求验证码失败: " + err, "danger");
    }
  };

  const handleGitHubPatSubmit = async () => {
    if (!githubAlias.trim() || !githubPat.trim()) { showNotif("请输入别名和 PAT", "danger"); return; }
    try {
      showNotif("正在验证 PAT...", "info");
      await invoke("github_pat_login", { token: githubPat.trim(), alias: githubAlias.trim() });
      showNotif(`GitHub 登录成功！Profile '${githubAlias}' 已创建`, "success");
      setActiveModal(null);
      reloadData();
    } catch (err) {
      showNotif("PAT 登录失败: " + err, "danger");
    }
  };

  const handleClose = async () => {
    try { await appWindow.close(); } catch { /* ignore */ }
  };

  const handleHeaderMouseDown = async (e: React.MouseEvent) => {
    if (e.button === 0 && !(e.target as HTMLElement).closest("button, select, input, a")) {
      try { await appWindow.startDragging(); } catch { /* ignore */ }
    }
  };

  // ─── Active Repo Name ─────────────────────────────────────────────────────

  const normalizePath = (p: string | null) => p ? p.replace(/\\/g, "/").toLowerCase() : "";
  const activeRepo = repos.find(r => normalizePath(r.path) === normalizePath(activeRepoPath));
  const getActiveRepoName = () => {
    if (activeRepo) return activeRepo.name;
    if (!activeRepoPath) return "未选择仓库";
    const parts = activeRepoPath.replace(/\\/g, "/").split("/");
    return parts[parts.length - 1] || activeRepoPath;
  };
  const activeRepoName = getActiveRepoName();

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="app-container">
      {/* Titlebar */}
      <header
        className="app-header"
        data-tauri-drag-region
        onMouseDown={handleHeaderMouseDown}
      >
        <div className="brand" data-tauri-drag-region>
          <span className="brand-dot" />
          <span className="title" data-tauri-drag-region>HaruhikageGit</span>
          {activeRepoName && activeRepoPath && (
            <span className="header-repo-pill">
              {currentBranch && <span className="header-branch-icon">⎇</span>}
              {activeRepoName}
              {currentBranch && <span className="header-branch">{currentBranch}</span>}
            </span>
          )}
        </div>
        <div className="header-actions">
          <button className="win-btn-flat" onClick={handleOpenProxy} title="代理与设置">⚙</button>
          <button className="win-btn-flat close-btn-flat" onClick={handleClose} title="关闭">✕</button>
        </div>
      </header>

      {/* Two-column Main Layout */}
      <div className={`main-layout${isDragOver ? " drag-over-active" : ""}`}>
        {/* Left: Repository Panel */}
        <aside className="sidebar-left">
          <RepoPanel
            repos={repos}
            activeRepoPath={activeRepoPath}
            isDragOver={isDragOver}
            onSwitchRepo={handleSwitchRepo}
            onAddRepo={handleAddRepo}
            onRemoveRepo={handleRemoveRepo}
            onOpenInExplorer={async (path) => {
              try { await invoke("open_in_explorer", { path }); } catch { /* ignore */ }
            }}
            onOpenInVscode={async (path) => {
              try { await invoke("open_in_vscode", { path }); } catch { /* ignore */ }
            }}
          />
        </aside>

        {/* Right: Account Management */}
        <main className="content-right">
          <AccountPanel
            status={status}
            currentBranch={currentBranch}
            onAddProfile={() => setActiveModal("add")}
            onGithubLogin={() => setActiveModal("github")}
            onSwitchProfile={handleSwitchProfile}
            onDeleteProfile={handleDeleteProfile}
            onOpenProxy={handleOpenProxy}
          />
        </main>
      </div>

      {/* Modals */}
      <AddProfileModal
        isOpen={activeModal === "add"}
        onClose={() => setActiveModal(null)}
        newAlias={newAlias} setNewAlias={setNewAlias}
        newName={newName} setNewName={setNewName}
        newEmail={newEmail} setNewEmail={setNewEmail}
        newGpg={newGpg} setNewGpg={setNewGpg}
        onSubmit={handleAddProfileSubmit}
      />
      <GithubLoginModal
        isOpen={activeModal === "github"}
        onClose={() => { setGithubDevice(null); setActiveModal(null); }}
        githubAlias={githubAlias} setGithubAlias={setGithubAlias}
        githubPat={githubPat} setGithubPat={setGithubPat}
        githubDevice={githubDevice}
        githubPollingMsg={githubPollingMsg}
        onRequestCode={handleGitHubCodeRequest}
        onPatSubmit={handleGitHubPatSubmit}
      />
      <ProxyModal
        isOpen={activeModal === "proxy"}
        onClose={() => setActiveModal(null)}
        proxyAuto={proxyAuto} setProxyAuto={setProxyAuto}
        proxyUrl={proxyUrl} setProxyUrl={setProxyUrl}
        effectiveProxy={effectiveProxy}
        onSubmit={handleSaveProxy}
      />

      {/* Notifications */}
      <div className="notif-stack">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`notif-item notif-${n.type}`}
          >
            {n.message}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
