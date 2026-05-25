import React, { useState } from "react";
import { GitFileStatus, StatusInfo, CommitInfo } from "../types";

interface WorkspacePanelProps {
  status: StatusInfo | null;
  gitStatus: GitFileStatus[];
  commitMsg: string;
  setCommitMsg: (val: string) => void;
  commitStageAll: boolean;
  setCommitStageAll: (val: boolean) => void;
  onStageFile: (path: string, staged: boolean) => void;
  onStageAll: () => void;
  onGitCommit: () => void;
  commits: CommitInfo[];
  onCopyHash: (hash: string) => void;
  onUndoAll: () => void;
  onSelectFileForPreview: (path: string) => void;
  onSwitchProfile: (alias: string, global: boolean) => Promise<void>;
}

export const WorkspacePanel: React.FC<WorkspacePanelProps> = ({
  status,
  gitStatus,
  commitMsg,
  setCommitMsg,
  commitStageAll,
  setCommitStageAll,
  onStageFile,
  onStageAll,
  onGitCommit,
  commits,
  onCopyHash,
  onUndoAll,
  onSelectFileForPreview,
  onSwitchProfile,
}) => {
  const hasChanges = gitStatus.length > 0;
  const [activeTab, setActiveTab] = useState<"changes" | "history">("changes");
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const hasUnstaged = gitStatus.some((f) => f.status !== "staged");

  const activeIdentityName = status?.local_name || status?.global_name || "Guest";
  const activeIdentityEmail = status?.local_email || status?.global_email || "guest@haruhikage.git";

  const getAvatarInitials = (name: string) => {
    if (!name) return "?";
    return name.trim().charAt(0).toUpperCase();
  };

  const getAvatarGradient = (name: string) => {
    if (!name || name === "Guest") return "linear-gradient(135deg, #94a3b8, #64748b)";
    const charCode = name.charCodeAt(0) || 0;
    const gradients = [
      "linear-gradient(135deg, #ec4899, #db2777)", // Sakura Pink
      "linear-gradient(135deg, #3b82f6, #1d4ed8)", // Premium Blue
      "linear-gradient(135deg, #10b981, #047857)", // Emerald Green
      "linear-gradient(135deg, #f59e0b, #d97706)", // Amber
      "linear-gradient(135deg, #8b5cf6, #6d28d9)", // Purple
      "linear-gradient(135deg, #06b6d4, #0891b2)", // Cyan
    ];
    return gradients[charCode % gradients.length];
  };

  return (
    <div className="section-card workspace-panel" style={{ flex: 1, display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* Panel Headers with Tab Selector */}
      <div className="section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 className="section-title">
          {activeTab === "changes" ? "未提交工作区" : "项目提交历史"}
        </h3>
        
        {/* Tab switchers: Always visible */}
        <div className="tab-switcher" style={{ display: "flex", background: "#f1f5f9", borderRadius: "6px", padding: "2px", border: "1px solid var(--border-color)" }}>
          <button
            className={`tab-btn ${activeTab === "changes" ? "active" : ""}`}
            onClick={() => setActiveTab("changes")}
            style={{ border: "none", background: "transparent", color: activeTab === "changes" ? "#fff" : "var(--text-secondary)", fontSize: "0.75rem", padding: "4px 10px", cursor: "pointer", borderRadius: "4px", fontWeight: "600", transition: "all 0.2s" }}
          >
            未提交变更 ({gitStatus.length})
          </button>
          <button
            className={`tab-btn ${activeTab === "history" ? "active" : ""}`}
            onClick={() => setActiveTab("history")}
            style={{ border: "none", background: "transparent", color: activeTab === "history" ? "#fff" : "var(--text-secondary)", fontSize: "0.75rem", padding: "4px 10px", cursor: "pointer", borderRadius: "4px", fontWeight: "600", transition: "all 0.2s" }}
          >
            提交历史
          </button>
        </div>
      </div>

      {/* Tab Contents: Changes Panel */}
      {activeTab === "changes" && (
        hasChanges ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", animation: "modalIn 0.2s ease" }}>
          {/* File Staging Table */}
          <div className="files-container">
            <div className="file-list-header">
              <span>文件名 / 路径</span>
              <span>状态</span>
              <span>操作</span>
            </div>
            <div className="files-list" style={{ maxHeight: "200px" }}>
              {gitStatus.map((f) => {
                const isStaged = f.status === "staged";
                return (
                  <div className="file-item" key={f.path}>
                    <span
                      className="file-path"
                      title="点击查看详细变更差异"
                      onClick={() => onSelectFileForPreview(f.path)}
                      style={{ cursor: "pointer", textDecoration: "underline", color: "var(--color-primary)" }}
                    >
                      {f.path}
                    </span>
                    <span className={`file-status-badge ${f.status}`}>{f.status}</span>
                    <button
                      className={`file-action-btn ${isStaged ? "unstage" : "stage"}`}
                      onClick={() => onStageFile(f.path, isStaged)}
                    >
                      {isStaged ? "取消暂存" : "暂存文件"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Sync & Discard Options */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {hasUnstaged ? (
              <button className="btn btn-sm btn-success" onClick={onStageAll}>
                暂存所有文件
              </button>
            ) : (
              <div style={{ fontSize: "0.8rem", color: "var(--color-success-hover)", fontWeight: "500" }}>
                ✓ 所有变更已成功暂存
              </div>
            )}
            
            <button
              className="btn btn-sm btn-secondary btn-delete"
              onClick={onUndoAll}
              title="放弃当前所有未提交的变动并还原代码"
              style={{
                background: "rgba(239, 68, 68, 0.1)",
                color: "var(--color-danger)",
                borderColor: "rgba(239, 68, 68, 0.3)"
              }}
            >
              放弃所有变更 (Undo)
            </button>
          </div>

          {/* Commit Form */}
          <div className="commit-form" style={{ marginTop: "6px", position: "relative" }}>
            <div className="form-row" style={{ position: "relative" }}>
              <label htmlFor="commit-msg-textarea" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>提交说明 (Commit Message):</span>
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", cursor: "default" }}>
                  当前身份: {activeIdentityName}
                </span>
              </label>
              
              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", marginTop: "4px" }}>
                {/* Circular Profile Avatar */}
                <div style={{ position: "relative" }}>
                  <div
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                    title={`当前 Git 身份: ${activeIdentityName} <${activeIdentityEmail}> \n点击快速切换身份`}
                    style={{
                      width: "38px",
                      height: "38px",
                      borderRadius: "50%",
                      background: getAvatarGradient(activeIdentityName),
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.95rem",
                      fontWeight: "700",
                      cursor: "pointer",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                      border: "2px solid #ffffff",
                      transition: "transform 0.15s, box-shadow 0.15s",
                      flexShrink: 0,
                      userSelect: "none"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "scale(1.06)";
                      e.currentTarget.style.boxShadow = "0 3px 10px rgba(236, 72, 153, 0.25)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "scale(1)";
                      e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.1)";
                    }}
                  >
                    {getAvatarInitials(activeIdentityName)}
                  </div>

                  {/* Profile quick selection dropdown menu (renders above the avatar) */}
                  {showProfileMenu && (
                    <div
                      className="profile-quick-menu"
                      style={{
                        position: "absolute",
                        bottom: "44px", // above the avatar
                        left: "0",
                        background: "#ffffff",
                        border: "1px solid var(--border-color)",
                        borderRadius: "var(--radius-md)",
                        boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                        padding: "6px",
                        zIndex: 1000,
                        width: "210px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "2px",
                        animation: "modalIn 0.15s cubic-bezier(0.16, 1, 0.3, 1)"
                      }}
                    >
                      <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: "700", padding: "4px 6px 6px 6px", borderBottom: "1px solid rgba(0,0,0,0.05)", textAlign: "left" }}>
                        切换当前项目 Git 身份
                      </div>
                      <div style={{ maxHeight: "150px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "2px", marginTop: "4px" }}>
                        {status?.profiles.length === 0 ? (
                          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", padding: "10px", textAlign: "center" }}>
                            暂无其他身份配置
                          </div>
                        ) : (
                          status?.profiles.map(([alias, p]) => {
                            const isActive = status.local_name === p.name && status.local_email === p.email;
                            return (
                              <div
                                key={alias}
                                onClick={() => {
                                  onSwitchProfile(alias, false);
                                  setShowProfileMenu(false);
                                }}
                                style={{
                                  padding: "6px 8px",
                                  borderRadius: "4px",
                                  cursor: "pointer",
                                  fontSize: "0.75rem",
                                  display: "flex",
                                  flexDirection: "column",
                                  background: isActive ? "rgba(236, 72, 153, 0.05)" : "transparent",
                                  color: isActive ? "var(--color-primary)" : "var(--text-primary)",
                                  fontWeight: isActive ? "600" : "500",
                                  transition: "all 0.12s",
                                  textAlign: "left"
                                }}
                                onMouseEnter={(e) => {
                                  if (!isActive) e.currentTarget.style.background = "#f1f5f9";
                                }}
                                onMouseLeave={(e) => {
                                  if (!isActive) e.currentTarget.style.background = "transparent";
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{alias}</span>
                                  {isActive && <span style={{ fontSize: "0.7rem" }}>✓</span>}
                                </div>
                                <div style={{ fontSize: "0.6rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {p.name} <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.55rem" }}>&lt;{p.email}&gt;</span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <textarea
                  id="commit-msg-textarea"
                  value={commitMsg}
                  onChange={(e) => setCommitMsg(e.target.value)}
                  placeholder="输入本次提交的简要说明..."
                  rows={2}
                  style={{ flex: 1, resize: "none" }}
                />
              </div>
            </div>

            <div className="form-row inline-row" style={{ marginTop: "8px", display: "flex", justifyContent: "flex-end" }}>
              <div className="checkbox-wrapper" style={{ paddingTop: "0" }}>
                <input
                  type="checkbox"
                  id="stage-all-checkbox"
                  checked={commitStageAll}
                  onChange={(e) => setCommitStageAll(e.target.checked)}
                />
                <label htmlFor="stage-all-checkbox" title="相当于 git commit -a">
                  自动暂存所有变更 (-a)
                </label>
              </div>
            </div>

            <div className="form-actions" style={{ marginTop: "10px" }}>
              <button className="btn btn-success btn-large" onClick={onGitCommit} style={{ width: "100%", padding: "10px 0" }}>
                快速提交 Commit
              </button>
            </div>
          </div>
        </div>
        ) : (
          <div className="empty-placeholder" style={{ padding: "50px 20px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", border: "1px dashed var(--border-color)", borderRadius: "var(--radius-md)", background: "#fafafa" }}>
            <span style={{ fontSize: "1.8rem", color: "var(--color-success)" }}>✓</span>
            <span style={{ fontWeight: "600", fontSize: "0.9rem", color: "var(--text-primary)" }}>工作区干净</span>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", maxWidth: "80%", textAlign: "center" }}>没有任何未暂存或未提交的变更，代码已完全同步。</span>
          </div>
        )
      )}

      {/* Tab Contents: History Panel */}
      {activeTab === "history" && (
        <div className="timeline" style={{ maxHeight: "380px", overflowY: "auto", paddingLeft: "10px", animation: "modalIn 0.2s ease" }}>
          {!status || !status.is_repo ? (
            <div className="empty-placeholder" style={{ padding: "40px" }}>未在 Git 仓库内，暂无历史提交日志</div>
          ) : commits.length === 0 ? (
            <div className="empty-placeholder" style={{ padding: "40px" }}>暂无提交记录</div>
          ) : (
            commits.map((c) => {
              const shortHash = c.hash.substring(0, 7);
              return (
                <div className="timeline-item" key={c.hash}>
                  <div className="timeline-header">
                    <span
                      className="commit-hash"
                      onClick={() => onCopyHash(c.hash)}
                      title="点击复制完整 Hash"
                      style={{ cursor: "pointer" }}
                    >
                      {shortHash}
                    </span>
                    <span className="commit-date">{c.date}</span>
                  </div>
                  <div className="commit-msg">{c.message}</div>
                  <div className="commit-meta">
                    {c.author} &lt;{c.email}&gt;
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
