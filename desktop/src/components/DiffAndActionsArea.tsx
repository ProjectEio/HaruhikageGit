import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface DiffAndActionsAreaProps {
  filePath: string | null;
  activePath: string | null;
  onClosePreview: () => void;
  showNotif: (msg: string, type?: "success" | "danger" | "info") => void;
}

export const DiffAndActionsArea: React.FC<DiffAndActionsAreaProps> = ({
  filePath,
  activePath,
  onClosePreview,
  showNotif,
}) => {
  const [diff, setDiff] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null);

  // Fetch Remote URL
  useEffect(() => {
    if (!activePath) {
      setRemoteUrl(null);
      return;
    }
    invoke<string>("get_remote_url")
      .then((url) => setRemoteUrl(url))
      .catch(() => setRemoteUrl(null));
  }, [activePath]);

  // Fetch Diff
  useEffect(() => {
    if (!filePath) {
      setDiff("");
      return;
    }
    setLoading(true);
    console.log("[DiffArea] invoking get_file_diff with path:", JSON.stringify(filePath), "charCodes:", Array.from(filePath).map(c => c.charCodeAt(0)));
    invoke<string>("get_file_diff", { path: filePath })
      .then((res) => {
        setDiff(res);
        setLoading(false);
      })
      .catch((err) => {
        setDiff("获取差异失败: " + err);
        setLoading(false);
      });
  }, [filePath]);


  // Quick Actions Handlers
  const handleOpenExplorer = () => {
    if (activePath) {
      invoke("open_in_explorer", { path: activePath }).catch(err => {
        if (showNotif) showNotif(`无法打开文件管理器: ${err}`, "danger");
      });
    }
  };

  const handleOpenVSCode = () => {
    if (activePath) {
      invoke("open_in_vscode", { path: activePath }).catch(err => {
        if (showNotif) showNotif(`无法打开VSCode: ${err}`, "danger");
      });
    }
  };

  const handleJumpToRemote = () => {
    if (!remoteUrl) {
      showNotif("该仓库未配置远程源 origin", "danger");
      return;
    }
    let webUrl = remoteUrl.trim();
    if (webUrl.startsWith("git@")) {
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
    const a = document.createElement("a");
    a.href = webUrl;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.click();
    showNotif("正在开启浏览器跳转到远程仓库...", "success");
  };

  const renderDiffLines = () => {
    if (!diff) return null;
    const rawLines = diff.split("\n").filter(line => 
      !line.startsWith("diff --git") && 
      !line.startsWith("index") && 
      !line.startsWith("---") && 
      !line.startsWith("+++")
    );
    let startIndex = rawLines.findIndex(l => l.startsWith("@@"));
    if (startIndex === -1) startIndex = 0;
    
    const lines = rawLines.slice(startIndex);

    return lines.map((line, idx) => {
      let bgColor = "transparent";
      let textColor = "var(--text-primary)";
      let prefix = " ";
      let lineNumberBlock = null;

      if (line.startsWith("+")) {
        bgColor = "rgba(16, 185, 129, 0.08)";
        textColor = "#059669";
        prefix = "+";
      } else if (line.startsWith("-")) {
        bgColor = "rgba(239, 68, 68, 0.06)";
        textColor = "#dc2626";
        prefix = "-";
      } else if (line.startsWith("@@")) {
        bgColor = "#f1f5f9";
        textColor = "var(--text-muted)";
      } else {
        prefix = " ";
      }

      if (!line.startsWith("@@")) {
        lineNumberBlock = (
          <div style={{
            width: "40px",
            flexShrink: 0,
            background: line.startsWith("+") ? "rgba(34,197,94,0.1)" : line.startsWith("-") ? "rgba(239,68,68,0.1)" : "rgba(0,0,0,0.02)",
            borderRight: "1px solid var(--border-color)",
            marginRight: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-muted)",
            fontSize: "0.7rem",
            userSelect: "none"
          }}>
            {prefix}
          </div>
        );
      }

      return (
        <div key={idx} style={{ 
          display: "flex", 
          backgroundColor: bgColor, 
          color: textColor, 
          padding: "2px 0",
          fontSize: "0.85rem",
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
          fontFamily: "var(--font-mono)",
          borderBottom: "1px solid rgba(0,0,0,0.02)"
        }}>
          {lineNumberBlock}
          <div style={{ flex: 1, paddingLeft: lineNumberBlock ? "0" : "52px" }}>
            {line}
          </div>
        </div>
      );
    });
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Top Action Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 16px", borderBottom: "1px solid var(--border-color)", background: "#f8fafc" }}>
        {/* Left Side: Breadcrumb / Path */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {filePath ? (
            <span style={{ fontSize: "0.85rem", color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontWeight: "500" }}>
              {filePath}
            </span>
          ) : (
            <span style={{ fontWeight: "600", color: "var(--text-primary)", fontSize: "0.95rem" }}>
              极简工作区
            </span>
          )}
        </div>

        {/* Right Side: Quick Actions & Close */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button className="btn btn-sm btn-secondary" style={{ border: "1px solid transparent", background: "rgba(0,0,0,0.03)" }} onClick={handleOpenExplorer} disabled={!activePath}>
            文件管理器
          </button>
          <button className="btn btn-sm btn-secondary" style={{ border: "1px solid transparent", background: "rgba(0,0,0,0.03)" }} onClick={handleOpenVSCode} disabled={!activePath}>
            VS Code
          </button>
          <button className="btn btn-sm btn-primary" onClick={handleJumpToRemote} disabled={!remoteUrl}>
            Remote 远程
          </button>
          {filePath && (
            <button
              onClick={onClosePreview}
              title="关闭预览"
              style={{ border: "none", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: "1.2rem", padding: "0 6px" }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Main Diff Content Area */}
      <div style={{ flex: 1, overflowY: "auto", background: "#f8fafc", padding: "16px" }}>
        {filePath ? (
          loading ? (
            <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>正在拉取差异详情...</div>
          ) : (
            <div style={{ background: "#ffffff", border: "1px solid var(--border-color)", padding: "10px 0" }}>
              {renderDiffLines()}
            </div>
          )
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "20px", color: "var(--text-secondary)", textAlign: "center" }}>
            <div style={{ color: "var(--text-muted)" }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            </div>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.4rem", fontWeight: "700", color: "var(--text-primary)" }}>HaruhikageGit 极简工作区</h2>
            <p style={{ fontSize: "0.85rem", maxWidth: "400px", lineHeight: "1.6" }}>
              点击左侧列表中的修改文件，即刻预览差异对比。<br />
              或者在顶部快捷栏使用一键直达功能。
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
