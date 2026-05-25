import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface QuickActionsPanelProps {
  activePath: string | null;
  showNotif: (msg: string, type?: "success" | "danger" | "info") => void;
}

export const QuickActionsPanel: React.FC<QuickActionsPanelProps> = ({ activePath, showNotif }) => {
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!activePath) {
      setRemoteUrl(null);
      return;
    }
    // Fetch remote URL when active path changes
    invoke<string>("get_remote_url")
      .then((url) => {
        setRemoteUrl(url);
      })
      .catch((_) => {
        setRemoteUrl(null);
      });
  }, [activePath]);

  const handleOpenExplorer = async () => {
    if (!activePath) return;
    try {
      await invoke("open_in_explorer", { path: activePath });
      showNotif("已成功在资源管理器中打开目录", "success");
    } catch (err) {
      showNotif("无法打开目录: " + err, "danger");
    }
  };

  const handleOpenVSCode = async () => {
    if (!activePath) return;
    try {
      await invoke("open_in_vscode", { path: activePath });
      showNotif("已在 VS Code 中启动该项目", "success");
    } catch (err) {
      showNotif("启动 VS Code 失败: " + err, "danger");
    }
  };

  const handleJumpToRemote = () => {
    if (!remoteUrl) {
      showNotif("该仓库未配置远程源 origin", "danger");
      return;
    }

    // Convert git SSH or HTTPS URL to browser-openable HTTPS URL
    // e.g. git@github.com:ProjectEio/HaruhikageGit.git -> https://github.com/ProjectEio/HaruhikageGit
    // e.g. https://github.com/ProjectEio/HaruhikageGit.git -> https://github.com/ProjectEio/HaruhikageGit
    let webUrl = remoteUrl.trim();
    if (webUrl.startsWith("git@")) {
      // replace only the prefix git@ and the colon before org name
      // e.g. git@github.com:ProjectEio/HaruhikageGit.git
      const match = webUrl.match(/^git@([^:]+):(.+)$/);
      if (match) {
        const host = match[1];
        const repoPath = match[2].replace(/\.git$/, "");
        webUrl = `https://${host}/${repoPath}`;
      } else {
        webUrl = webUrl.replace(/^git@/, "https://").replace(/:/g, "/").replace(/\.git$/, "");
      }
    } else if (webUrl.endsWith(".git")) {
      webUrl = webUrl.substring(0, webUrl.length - 4);
    }

    // Open URL
    const a = document.createElement("a");
    a.href = webUrl;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.click();
    showNotif("正在开启浏览器跳转到远程仓库...", "success");
  };

  return (
    <div className="section-card quick-actions-panel" style={{ flexShrink: 0 }}>
      <h3 className="section-title">快捷操作</h3>
      <div className="identity-group" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <button
          className="btn btn-secondary"
          onClick={handleOpenExplorer}
          disabled={!activePath}
          style={{ width: "100%", justifyContent: "flex-start", padding: "10px 14px" }}
        >
          打开文件管理器
        </button>
        <button
          className="btn btn-secondary"
          onClick={handleOpenVSCode}
          disabled={!activePath}
          style={{ width: "100%", justifyContent: "flex-start", padding: "10px 14px" }}
        >
          打开 VS Code
        </button>
        <button
          className="btn btn-primary"
          onClick={handleJumpToRemote}
          disabled={!remoteUrl}
          style={{ width: "100%", justifyContent: "flex-start", padding: "10px 14px" }}
        >
          跳转到 Remote 仓库
        </button>
      </div>
      {remoteUrl && (
        <div
          className="profile-item-email"
          style={{
            fontSize: "0.65rem",
            color: "var(--text-muted)",
            wordBreak: "break-all",
            marginTop: "8px",
            fontFamily: "var(--font-mono)",
            background: "rgba(0,0,0,0.15)",
            padding: "6px 10px",
            borderRadius: "4px"
          }}
          title={remoteUrl}
        >
          Origin: {remoteUrl}
        </div>
      )}
    </div>
  );
};
