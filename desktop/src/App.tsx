import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

// --- Components & Types ---
import { StatusInfo, GitFileStatus, CommitInfo, DeviceCode, ProxySettings, Notification, ManagedRepository, SyncStatus } from "./types";
import { TopNavBar } from "./components/TopNavBar";
import { WorkspacePanel } from "./components/WorkspacePanel";
import { DiffAndActionsArea } from "./components/DiffAndActionsArea";
import { AddProfileModal, GithubLoginModal, ProxyModal } from "./components/Modals";

function App() {
  const appWindow = getCurrentWindow();

  // --- States ---
  const [status, setStatus] = useState<StatusInfo | null>(null);
  const [gitStatus, setGitStatus] = useState<GitFileStatus[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [currentBranch, setCurrentBranch] = useState<string>("unknown");
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  
  // Multi-repository states
  const [repos, setRepos] = useState<ManagedRepository[]>([]);
  const [activeRepoPath, setActiveRepoPath] = useState<string | null>(null);

  const handleSwitchBranch = async (branchName: string) => {
    try {
      await invoke("git_checkout", { target: branchName });
      reloadData();
    } catch (e) {
      showNotif(`切换分支失败: ${e}`, "danger");
    }
  };

  // File Preview state
  const [selectedPreviewPath, setSelectedPreviewPath] = useState<string | null>(null);

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

  // Commit Form States
  const [commitMsg, setCommitMsg] = useState("");
  const [commitStageAll, setCommitStageAll] = useState(false);

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

        // Fetch Working Tree
        const files: GitFileStatus[] = await invoke("get_git_status");
        setGitStatus(prev => {
          if (prev.length === files.length && JSON.stringify(prev) === JSON.stringify(files)) return prev;
          return files;
        });


        // Fetch Branches
        const rawBranches: string[] = await invoke("get_git_branches");
        let active = "";
        const cleanBranches = rawBranches.map((b) => {
          if (b.startsWith("*")) {
            active = b.replace("*", "").trim();
            return active;
          }
          return b;
        });
        setBranches(prev => {
          if (prev.length === cleanBranches.length && JSON.stringify(prev) === JSON.stringify(cleanBranches)) return prev;
          return cleanBranches;
        });
        setCurrentBranch(active);

        // Fetch Commits
        const logs: CommitInfo[] = await invoke("get_git_commits", { limit: 100 });
        setCommits(prev => {
          if (prev.length === logs.length && prev[0]?.hash === logs[0]?.hash) return prev;
          return logs;
        });
        
        // Fetch Current Branch
        try {
          const c: string = await invoke("get_current_branch");
          setCurrentBranch(c);
        } catch (e) {
          setCurrentBranch("unknown");
        }

        try {
          // Fetch Sync Status
          const sync: SyncStatus = await invoke("get_sync_status");
          setSyncStatus(prev => {
            if (prev && prev.ahead === sync.ahead && prev.behind === sync.behind && prev.has_upstream === sync.has_upstream) return prev;
            return sync;
          });
        } catch (e) {
          console.error("Failed to get sync status", e);
        }
      } else {
        setGitStatus([]);
        setBranches([]);
        setCurrentBranch("");
        setCommits([]);
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
    // Auto-fetch sync status every 60 seconds
    const interval = setInterval(async () => {
      if (activeRepoPath) {
        try {
          // Perform a background fetch to update remote tracking branches
          await invoke("git_fetch");
          // Update sync status
          const sync: SyncStatus = await invoke("get_sync_status");
          setSyncStatus(sync);
        } catch (e) {
          console.error("Auto fetch failed:", e);
        }
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [activeRepoPath]);

  useEffect(() => {
    reloadData();
    const interval = setInterval(() => {
      if (!activeModal) {
        reloadData();
      }
    }, 4500);
    return () => clearInterval(interval);
  }, [activeModal, activeRepoPath]);

  // Reset selected file preview when active repository changes
  useEffect(() => {
    setSelectedPreviewPath(null);
  }, [activeRepoPath]);

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

  const handleUndoAll = async () => {
    if (confirm("⚠️ 确定要放弃当前所有未提交的变动吗？此操作会执行 git reset --hard 并清空所有新增文件，且无法撤销！")) {
      try {
        showNotif("正在还原工作区代码...", "info");
        await invoke("git_discard_changes");
        showNotif("工作区代码已完全还原成功！", "success");
        setSelectedPreviewPath(null); // Reset preview on discard
        reloadData();
      } catch (err) {
        showNotif("还原工作区失败: " + err, "danger");
      }
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

  // @ts-ignore
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

  const handleCheckoutBranch = async (target: string) => {
    try {
      showNotif(`正在切换至分支: ${target}...`, "info");
      const out: string = await invoke("git_checkout", { target });
      showNotif(out || `已成功切换至分支 ${target}`, "success");
      reloadData();
    } catch (err) {
      showNotif("切换分支失败: " + err, "danger");
    }
  };

  const handleCreateBranch = async () => {
    const name = prompt("请输入新分支的名称 (Branch Name):");
    if (name) {
      try {
        const out: string = await invoke("git_create_branch", { name, startPoint: null });
        showNotif(out || `分支 '${name}' 创建成功！`, "success");
        reloadData();
      } catch (err) {
        showNotif("分支创建失败: " + err, "danger");
      }
    }
  };

  const handleStageAll = async () => {
    try {
      await invoke("git_stage_files", { specs: ["."] });
      showNotif("已暂存工作区当前所有变更", "success");
      reloadData();
    } catch (err) {
      showNotif("暂存失败: " + err, "danger");
    }
  };

  const handleStageFiles = async (paths: string[], stage: boolean) => {
    if (paths.length === 0) return;
    try {
      if (!stage) {
        await invoke("git_unstage_files", { specs: paths });
      } else {
        await invoke("git_stage_files", { specs: paths });
      }
      reloadData();
    } catch (err) {
      showNotif("操作变更失败: " + err, "danger");
    }
  };

  const handleGitFetch = async () => {
    try {
      showNotif("正在拉取远程变更...", "info");
      const out: string = await invoke("git_fetch");
      showNotif(out || "Fetch 抓取远程成功", "success");
      reloadData();
    } catch (err) {
      showNotif("Fetch 失败: " + err, "danger");
    }
  };

  const handleGitPull = async () => {
    try {
      showNotif("正在拉取远程变更并合并...", "info");
      await invoke("git_pull", { alias: null, global: false });
      showNotif("Pull 合并成功，工作区已与远程对齐", "success");
      reloadData();
    } catch (err) {
      showNotif("Pull 失败: " + err, "danger");
    }
  };

  const handleGitPush = async () => {
    try {
      showNotif("正在推送本地提交至远程...", "info");
      await invoke("git_push");
      showNotif("Push 推送成功，远程已完全同步", "success");
      reloadData();
    } catch (err) {
      showNotif("Push 失败: " + err, "danger");
    }
  };

  const handleGitCommit = async () => {
    if (!commitMsg.trim()) {
      showNotif("提交信息 (Commit Message) 不能为空", "danger");
      return;
    }
    try {
      showNotif("正在执行本地提交...", "info");
      await invoke("git_commit", {
        message: commitMsg.trim(),
        all: commitStageAll,
        profile: null,
      });
      showNotif("Git Commit 提交成功！", "success");
      setCommitMsg("");
      setSelectedPreviewPath(null); // Reset preview on successful commit
      reloadData();
    } catch (err) {
      showNotif("提交失败: " + err, "danger");
    }
  };

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    showNotif("提交 Hash 已复制到剪贴板", "success");
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
          branches={branches}
          onSwitchBranch={handleSwitchBranch}
          onRemoveRepo={handleRemoveRepo}
          syncStatus={syncStatus}
        />

      {/* Main Workspace Layout (Two-Column with lines) */}
      <div className="main-layout" style={{ flex: 1, overflow: "hidden", display: "flex", gap: "0", padding: "0" }}>
        {/* Left Side: WorkspacePanel */}
        <aside className="sidebar-left" style={{ width: "340px", display: "flex", flexDirection: "column", flexShrink: 0, position: "relative", height: "100%", borderRight: "1px solid var(--border-color)", background: "#ffffff", padding: "0" }}>
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <WorkspacePanel
              status={status}
              gitStatus={gitStatus}
              currentBranch={currentBranch}
              commitMsg={commitMsg}
              setCommitMsg={setCommitMsg}
              commitStageAll={commitStageAll}
              setCommitStageAll={setCommitStageAll}
              onStageFiles={handleStageFiles}
              onStageAll={handleStageAll}
              onGitCommit={handleGitCommit}
              commits={commits}
              onCopyHash={handleCopyHash}
              onUndoAll={handleUndoAll}
              onSelectFileForPreview={(path) => setSelectedPreviewPath(path)}
              onSwitchProfile={handleSwitchProfile}
            />
          </div>
        </aside>

        {/* Center: Diff Preview and Quick Actions */}
        <main className="workspace-center" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", height: "100%", background: "#f8fafc" }}>
          <DiffAndActionsArea
            filePath={selectedPreviewPath}
            activePath={activeRepoPath}
            onClosePreview={() => setSelectedPreviewPath(null)}
            showNotif={showNotif}
          />
        </main>
      </div>

      {/* Bottom Bar: Branch Switcher & neon Sync buttons (With Suitable Colors) */}
      {status?.is_repo && (
        <footer className="app-footer" style={{
          height: "56px",
          minHeight: "56px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
          background: "#fdf2f8", // Sakura soft pink background
          borderTop: "1px solid rgba(236, 72, 153, 0.15)",
          zIndex: 5
        }}>
          {/* Branch Switcher Select */}
          <div className="bottom-branch-block" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: "600" }}>活动分支:</span>
            <select
              id="active-branch-sel"
              value={currentBranch}
              onChange={(e) => e.target.value && handleCheckoutBranch(e.target.value)}
              style={{
                padding: "6px 12px",
                background: "#ffffff",
                borderRadius: "6px",
                border: "1px solid rgba(236, 72, 153, 0.2)",
                color: "var(--text-primary)",
                fontSize: "0.8rem",
                fontWeight: "600",
                cursor: "pointer"
              }}
            >
              {branches.map((b) => (
                <option value={b} key={b}>
                  ● {b}
                </option>
              ))}
            </select>
            <button className="btn btn-sm btn-secondary" onClick={handleCreateBranch} style={{ fontSize: "0.75rem", border: "1px solid rgba(236, 72, 153, 0.2)" }}>
              + 新建分支
            </button>
          </div>

          {/* Sync neon Actions */}
          <div className="bottom-sync-block" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button className="btn btn-sm btn-secondary" onClick={handleGitFetch} style={{ border: "1px solid rgba(236, 72, 153, 0.2)" }}>
              Fetch 抓取
            </button>
            <button className="btn btn-sm btn-secondary" onClick={handleGitPull} style={{ border: "1px solid rgba(236, 72, 153, 0.2)" }}>
              Pull 拉取
            </button>
            <button className="btn btn-sm btn-primary" onClick={handleGitPush}>
              Push 推送至 Origin
            </button>
          </div>
        </footer>
      )}

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
