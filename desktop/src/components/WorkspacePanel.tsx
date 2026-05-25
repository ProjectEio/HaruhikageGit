import React from "react";
import { GitFileStatus, StatusInfo } from "../types";

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
  onGitFetch: () => void;
  onGitPull: () => void;
  onGitPush: () => void;
  onGitCommit: () => void;
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
  onGitFetch,
  onGitPull,
  onGitPush,
  onGitCommit,
}) => {
  const hasUnstaged = gitStatus.some((f) => f.status !== "staged");

  return (
    <>
      {/* Staging Changed Files Panel */}
      <div className="section-card stage-panel">
        <div className="section-header">
          <h3 className="section-title">📂 工作区变更</h3>
          {gitStatus.length > 0 && hasUnstaged && (
            <div className="header-btns">
              <button className="btn btn-sm btn-success" onClick={onStageAll}>
                暂存所有 📥
              </button>
            </div>
          )}
        </div>

        <div className="files-container">
          <div className="file-list-header">
            <span>文件名 / 路径</span>
            <span>状态</span>
            <span>操作</span>
          </div>
          <div className="files-list">
            {!status || !status.is_repo ? (
              <div className="empty-placeholder">未在 Git 仓库内，暂无工作区变更 🚫</div>
            ) : gitStatus.length === 0 ? (
              <div className="empty-placeholder">暂无工作区变更，代码很干净 ✨</div>
            ) : (
              gitStatus.map((f) => {
                const isStaged = f.status === "staged";
                return (
                  <div className="file-item" key={f.path}>
                    <span className="file-path" title={f.path}>
                      {f.path}
                    </span>
                    <span className={`file-status-badge ${f.status}`}>{f.status}</span>
                    <button
                      className={`file-action-btn ${isStaged ? "unstage" : "stage"}`}
                      onClick={() => onStageFile(f.path, isStaged)}
                    >
                      {isStaged ? "取消暂存 ↩" : "暂存文件 📥"}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Sync and Commit Actions Panel */}
      {status?.is_repo && (
        <div className="section-card commit-panel">
          <h3 className="section-title">📝 快速同步与提交</h3>
          <div className="sync-actions-row">
            <button className="btn btn-secondary" onClick={onGitFetch}>
              🔄 Fetch 抓取
            </button>
            <button className="btn btn-secondary" onClick={onGitPull}>
              ⬇️ Pull 拉取
            </button>
            <button className="btn btn-primary" onClick={onGitPush}>
              ⬆️ Push 推送至 Origin
            </button>
          </div>

          <div className="commit-form">
            <div className="form-row">
              <label htmlFor="commit-msg-textarea">提交信息 (Commit Message):</label>
              <textarea
                id="commit-msg-textarea"
                value={commitMsg}
                onChange={(e) => setCommitMsg(e.target.value)}
                placeholder="输入提交说明 (例如: feat: 新增 UI 功能)..."
                rows={3}
              />
            </div>

            <div className="form-row inline-row">
              <div className="profile-select-wrapper">
                <label htmlFor="commit-profile-select">提交身份 (可选 Override):</label>
                <select
                  id="commit-profile-select"
                  value={commitProfile}
                  onChange={(e) => setCommitProfile(e.target.value)}
                >
                  <option value="">保持当前仓库身份 (Default)</option>
                  {status.profiles.map(([alias, p]) => (
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
                  自动 Stage 所有变更 (-a)
                </label>
              </div>
            </div>

            <div className="form-actions">
              <button className="btn btn-success btn-large" onClick={onGitCommit}>
                ✨ 快速提交 Commit
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
