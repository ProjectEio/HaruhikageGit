import React, { useState } from "react";
import { GitFileStatus, StatusInfo, CommitInfo } from "../types";

interface WorkspacePanelProps {
  status: StatusInfo | null;
  gitStatus: GitFileStatus[];
  commitMsg: string;
  setCommitMsg: (val: string) => void;
  commitStageAll: boolean;
  setCommitStageAll: (val: boolean) => void;
  commitProfile: string;
  setCommitProfile: (val: string) => void;
  onStageFile: (path: string, staged: boolean) => void;
  onStageAll: () => void;
  onGitCommit: () => void;
  commits: CommitInfo[];
  onCopyHash: (hash: string) => void;
  onUndoAll: () => void;
  onSelectFileForPreview: (path: string) => void; // Added callback when clicking on a changed file
}

export const WorkspacePanel: React.FC<WorkspacePanelProps> = ({
  status,
  gitStatus,
  commitMsg,
  setCommitMsg,
  commitStageAll,
  setCommitStageAll,
  commitProfile,
  setCommitProfile,
  onStageFile,
  onStageAll,
  onGitCommit,
  commits,
  onCopyHash,
  onUndoAll,
  onSelectFileForPreview,
}) => {
  const hasChanges = gitStatus.length > 0;
  const [activeTab, setActiveTab] = useState<"changes" | "history">("changes");

  const hasUnstaged = gitStatus.some((f) => f.status !== "staged");

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
          <div className="commit-form" style={{ marginTop: "6px" }}>
            <div className="form-row">
              <label htmlFor="commit-msg-textarea">提交说明 (Commit Message):</label>
              <textarea
                id="commit-msg-textarea"
                value={commitMsg}
                onChange={(e) => setCommitMsg(e.target.value)}
                placeholder="输入本次提交的简要说明..."
                rows={2}
              />
            </div>

            <div className="form-row inline-row">
              <div className="profile-select-wrapper">
                <label htmlFor="commit-profile-select">切换提交账户 (可选 Override):</label>
                <select
                  id="commit-profile-select"
                  value={commitProfile}
                  onChange={(e) => setCommitProfile(e.target.value)}
                >
                  <option value="">默认当前仓库身份 (Default)</option>
                  {status?.profiles.map(([alias, p]) => (
                    <option value={alias} key={alias}>
                      {alias} ({p.name})
                    </option>
                  ))}
                </select>
              </div>
              <div className="checkbox-wrapper">
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

            <div className="form-actions">
              <button className="btn btn-success btn-large" onClick={onGitCommit} style={{ width: "100%" }}>
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
