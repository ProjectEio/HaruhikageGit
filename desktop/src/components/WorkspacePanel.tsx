import React, { useState } from "react";
import { GitFileStatus, StatusInfo, CommitInfo } from "../types";
import { FileStaging } from "./FileStaging";
import { CommitForm } from "./CommitForm";

interface WorkspacePanelProps {
  status: StatusInfo | null;
  gitStatus: GitFileStatus[];
  currentBranch: string;
  commitMsg: string;
  setCommitMsg: (val: string) => void;
  commitStageAll: boolean;
  setCommitStageAll: (val: boolean) => void;
  onStageFiles: (paths: string[], stage: boolean) => void;
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
  currentBranch,
  commitMsg,
  setCommitMsg,
  commitStageAll,
  setCommitStageAll,
  onStageFiles,
  onStageAll,
  onGitCommit,
  commits,
  onCopyHash,
  onUndoAll,
  onSelectFileForPreview,
  onSwitchProfile,
}) => {
  const [activeTab, setActiveTab] = useState<"changes" | "history">("changes");

  const stagedCount = React.useMemo(() => {
    const map = new Map<string, boolean>();
    gitStatus.forEach((f) => {
      if (!map.has(f.path)) map.set(f.path, f.status === "staged");
      else if (f.status === "staged") map.set(f.path, true);
    });
    return Array.from(map.values()).filter(Boolean).length;
  }, [gitStatus]);

  return (
    <div className="workspace-panel" style={{ display: "flex", flexDirection: "column", height: "100%", background: "#fff" }}>
      {/* Tab Selector */}
      <div className="tab-switcher" style={{ display: "flex", width: "100%", borderBottom: "1px solid var(--border-color)", background: "#f8fafc" }}>
        <button
          className={`tab-btn ${activeTab === "changes" ? "active" : ""}`}
          onClick={() => setActiveTab("changes")}
          style={{ flex: 1, border: "none", background: "transparent", color: activeTab === "changes" ? "var(--color-primary)" : "var(--text-secondary)", fontSize: "0.8rem", padding: "8px 0", cursor: "pointer", fontWeight: "600", transition: "all 0.2s", borderBottom: activeTab === "changes" ? "2px solid var(--color-primary)" : "2px solid transparent", borderRadius: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
        >
          <span>Changes</span>
          {gitStatus.length > 0 && (
            <span style={{ background: activeTab === "changes" ? "var(--color-primary)" : "rgba(0,0,0,0.1)", color: activeTab === "changes" ? "#fff" : "var(--text-secondary)", fontSize: "0.65rem", padding: "2px 6px", borderRadius: "10px", lineHeight: 1 }}>
              {gitStatus.length}
            </span>
          )}
        </button>
        <button
          className={`tab-btn ${activeTab === "history" ? "active" : ""}`}
          onClick={() => setActiveTab("history")}
          style={{ flex: 1, border: "none", background: "transparent", color: activeTab === "history" ? "var(--color-primary)" : "var(--text-secondary)", fontSize: "0.8rem", padding: "8px 0", cursor: "pointer", fontWeight: "600", transition: "all 0.2s", borderBottom: activeTab === "history" ? "2px solid var(--color-primary)" : "2px solid transparent", borderRadius: 0 }}
        >
          History
        </button>
      </div>

      {/* Tab Contents */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {activeTab === "changes" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <FileStaging
              gitStatus={gitStatus}
              onStageFiles={onStageFiles}
              onStageAll={onStageAll}
              onUndoAll={onUndoAll}
              onSelectFileForPreview={onSelectFileForPreview}
            />
            <CommitForm
              commitMsg={commitMsg}
              setCommitMsg={setCommitMsg}
              commitStageAll={commitStageAll}
              setCommitStageAll={setCommitStageAll}
              onGitCommit={onGitCommit}
              status={status}
              onSwitchProfile={onSwitchProfile}
              currentBranch={currentBranch}
              stagedCount={stagedCount}
            />
          </div>
        )}

        {activeTab === "history" && (
          <div className="timeline" style={{ padding: "10px", animation: "modalIn 0.2s ease", overflowY: "auto", flex: 1 }}>
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
    </div>
  );
};
