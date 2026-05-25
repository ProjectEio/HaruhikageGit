import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

// --- Components & Types ---
import { StatusInfo, GitFileStatus, CommitInfo, DeviceCode, ProxySettings, Notification } from "./types";
import { IdentityPanel } from "./components/IdentityPanel";
import { ProfilesPanel } from "./components/ProfilesPanel";
import { WorkspacePanel } from "./components/WorkspacePanel";
import { BranchPanel } from "./components/BranchPanel";
import { HistoryPanel } from "./components/HistoryPanel";
import { AddProfileModal, GithubLoginModal, ProxyModal } from "./components/Modals";

function App() {
  const appWindow = getCurrentWindow();

  // --- States ---
  const [status, setStatus] = useState<StatusInfo | null>(null);
  const [gitStatus, setGitStatus] = useState<GitFileStatus[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [currentBranch, setCurrentBranch] = useState<string>("");
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  
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
  const [commitProfile, setCommitProfile] = useState("");

  const githubPollingRef = useRef<number | null>(null);

  // --- Notification Helper ---
  const showNotif = (message: string, type: "success" | "danger" | "info" = "success") => {
    const id = Date.now() + Math.random();
    setNotifications((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 3500);
  };

  // --- Reload All State Data ---
  const reloadData = async () => {
    try {
      const res: StatusInfo = await invoke("get_status_info");
      setStatus(res);

      if (res.is_repo) {
        // Fetch Working Tree
        const files: GitFileStatus[] = await invoke("get_git_status");
        setGitStatus(files);

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
        setBranches(cleanBranches);
        setCurrentBranch(active);

        // Fetch Logs
        const logs: CommitInfo[] = await invoke("get_git_commits", { limit: 10 });
        setCommits(logs);
      }
    } catch (err) {
      console.error("加载数据失败:", err);
    }
  };

  // --- Setup Polling Loops ---
  useEffect(() => {
    reloadData();
    const interval = setInterval(() => {
      // Only refresh if no modals are open
      if (!activeModal) {
        reloadData();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [activeModal]);

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
        showNotif("GitHub 授权轮询已超时 ⏳", "danger");
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
        showNotif(`GitHub 一键登录成功！别名 '${githubAlias}' 已创建 ✔`, "success");
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

  const handleSwitchProfile = async (alias: string, global: boolean) => {
    try {
      await invoke("switch_profile", { alias, global });
      showNotif(`已应用别名 '${alias}' 到${global ? "全局" : "当前项目"} ✔`, "success");
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
      showNotif("网络代理设置保存成功 ✔", "success");
      setActiveModal(null);
      reloadData();
    } catch (err) {
      showNotif("保存网络代理失败: " + err, "danger");
    }
  };

  const handleAddProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlias.trim() || !newName.trim() || !newEmail.trim()) {
      showNotif("必须填写别名、姓名和邮箱 ⚠️", "danger");
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
      showNotif(`GitHub 登录成功！Profile '${githubAlias}' 已创建 ✔`, "success");
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

  const handleDeleteBranch = async (name: string) => {
    if (confirm(`确定要删除分支 '${name}' 吗？`)) {
      try {
        const out: string = await invoke("git_delete_branch", { name, force: false });
        showNotif(out || `分支 '${name}' 已删除`, "success");
        reloadData();
      } catch (err) {
        if (confirm(`删除普通分支失败 (${err})，是否进行强行删除？`)) {
          try {
            const forceOut: string = await invoke("git_delete_branch", { name, force: true });
            showNotif(forceOut || `分支 '${name}' 已被强制删除`, "success");
            reloadData();
          } catch (fErr) {
            showNotif("强制删除分支失败: " + fErr, "danger");
          }
        }
      }
    }
  };

  const handleStageAll = async () => {
    try {
      await invoke("git_stage_files", { specs: ["."] });
      showNotif("已暂存工作区当前所有变更 📥", "success");
      reloadData();
    } catch (err) {
      showNotif("暂存失败: " + err, "danger");
    }
  };

  const handleStageFile = async (path: string, staged: boolean) => {
    try {
      if (staged) {
        await invoke("git_unstage_files", { specs: [path] });
        showNotif(`已取消暂存: ${path}`, "success");
      } else {
        await invoke("git_stage_files", { specs: [path] });
        showNotif(`已暂存文件: ${path}`, "success");
      }
      reloadData();
    } catch (err) {
      showNotif("操作变更失败: " + err, "danger");
    }
  };

  const handleGitFetch = async () => {
    try {
      showNotif("正在拉取远程变更 (Git Fetch)...", "info");
      const out: string = await invoke("git_fetch");
      showNotif(out || "Fetch 抓取远程成功，本地分支状态已刷新", "success");
      reloadData();
    } catch (err) {
      showNotif("Fetch 失败: " + err, "danger");
    }
  };

  const handleGitPull = async () => {
    try {
      showNotif("正在拉取远程变更并合并 (Git Pull)...", "info");
      const out: string = await invoke("git_pull", { alias: null, global: false });
      showNotif(out || "Pull 合并成功，工作区已与远程对齐 ✨", "success");
      reloadData();
    } catch (err) {
      showNotif("Pull 失败: " + err, "danger");
    }
  };

  const handleGitPush = async () => {
    try {
      showNotif("正在推送本地提交至远程 (Git Push)...", "info");
      const out: string = await invoke("git_push");
      showNotif(out || "Push 成功！远程仓库已同步 🚀", "success");
      reloadData();
    } catch (err) {
      showNotif("Push 失败: " + err, "danger");
    }
  };

  const handleGitCommit = async () => {
    if (!commitMsg.trim()) {
      showNotif("提交信息 (Commit Message) 不能为空 ⚠️", "danger");
      return;
    }
    try {
      showNotif("正在执行本地提交 (Commit)...", "info");
      await invoke("git_commit", {
        message: commitMsg.trim(),
        all: commitStageAll,
        profile: commitProfile || null,
      });
      showNotif("✨ Git Commit 提交成功！", "success");
      setCommitMsg("");
      reloadData();
    } catch (err) {
      showNotif("提交失败: " + err, "danger");
    }
  };

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    showNotif("提交 Hash 已复制到剪贴板 📋", "success");
  };

  const handleMinimize = async () => {
    try {
      await appWindow.minimize();
    } catch (err) {
      console.error("最小化窗口失败:", err);
    }
  };

  const handleClose = async () => {
    try {
      await appWindow.close();
    } catch (err) {
      console.error("关闭窗口失败:", err);
    }
  };

  return (
    <div className="app-container">
      {/* Top Titlebar */}
      <header className="app-header" data-tauri-drag-region>
        <div className="brand" data-tauri-drag-region>
          <span className="logo" data-tauri-drag-region>🌸</span>
          <span className="title" data-tauri-drag-region>HaruhikageGit</span>
          <span className="version" data-tauri-drag-region>v0.1.0</span>
        </div>
        <div className="repo-badge" data-tauri-drag-region>
          <span className={`indicator ${status?.is_repo ? "green" : "red"}`} data-tauri-drag-region></span>
          <span className="text" data-tauri-drag-region>{status?.is_repo ? "已连接 Git 仓库" : "未检测到 Git 仓库"}</span>
        </div>
        <div className="header-actions">
          <button className="icon-btn" onClick={handleOpenProxy} title="代理设置">
            🌐 代理
          </button>
          <button className="icon-btn win-ctrl-btn" onClick={handleMinimize} title="最小化" style={{ minWidth: "32px", padding: "6px 0", justifyContent: "center" }}>
            ➖
          </button>
          <button className="icon-btn win-ctrl-btn close-btn-win" onClick={handleClose} title="关闭" style={{ minWidth: "32px", padding: "6px 0", justifyContent: "center" }}>
            ❌
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="main-layout">
        {/* Left Side: Identities & Profiles */}
        <aside className="sidebar-left">
          <IdentityPanel status={status} />
          
          <ProfilesPanel
            status={status}
            onSwitchProfile={handleSwitchProfile}
            onDeleteProfile={handleDeleteProfile}
            onOpenAddModal={() => {
              setNewAlias("");
              setNewName("");
              setNewEmail("");
              setNewGpg("");
              setActiveModal("add");
            }}
            onOpenGithubModal={() => {
              setGithubAlias("github");
              setGithubPat("");
              setGithubDevice(null);
              setActiveModal("github");
            }}
          />
        </aside>

        {/* Center: Stage List & Commit Controls */}
        <main className="workspace-center">
          <WorkspacePanel
            status={status}
            gitStatus={gitStatus}
            commitMsg={commitMsg}
            setCommitMsg={setCommitMsg}
            commitStageAll={commitStageAll}
            setCommitStageAll={setCommitStageAll}
            commitProfile={commitProfile}
            setCommitProfile={setCommitProfile}
            onStageFile={handleStageFile}
            onStageAll={handleStageAll}
            onGitFetch={handleGitFetch}
            onGitPull={handleGitPull}
            onGitPush={handleGitPush}
            onGitCommit={handleGitCommit}
          />
        </main>

        {/* Right Side: Branches & Commit History */}
        <aside className="sidebar-right">
          <BranchPanel
            status={status}
            branches={branches}
            currentBranch={currentBranch}
            onCheckoutBranch={handleCheckoutBranch}
            onCreateBranch={handleCreateBranch}
            onDeleteBranch={handleDeleteBranch}
          />

          <HistoryPanel
            status={status}
            commits={commits}
            onCopyHash={handleCopyHash}
          />
        </aside>
      </div>

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
          let prefix = "ℹ️ ";
          if (n.type === "success") {
            bg = "linear-gradient(135deg, #10b981, #059669)";
            prefix = "✨ ";
          } else if (n.type === "danger") {
            bg = "linear-gradient(135deg, #ef4444, #dc2626)";
            prefix = "❌ ";
          }

          return (
            <div
              key={n.id}
              style={{
                background: bg,
                padding: "12px 24px",
                borderRadius: "8px",
                color: "#fff",
                boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
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
