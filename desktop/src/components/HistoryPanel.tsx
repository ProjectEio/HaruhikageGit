import React from "react";
import { CommitInfo, StatusInfo } from "../types";

interface HistoryPanelProps {
  status: StatusInfo | null;
  commits: CommitInfo[];
  onCopyHash: (hash: string) => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  status,
  commits,
  onCopyHash,
}) => {
  return (
    <div className="section-card history-panel">
      <h3 className="section-title">提交历史日志</h3>
      <div className="timeline">
        {!status || !status.is_repo ? (
          <div className="empty-placeholder">暂无历史提交日志</div>
        ) : commits.length === 0 ? (
          <div className="empty-placeholder">暂无提交记录</div>
        ) : (
          commits.map((c) => {
            const shortHash = c.hash.substring(0, 7);
            return (
              <div className="timeline-item" key={c.hash}>
                <div className="timeline-header">
                  <span
                    className="commit-hash"
                    onClick={() => onCopyHash(c.hash)}
                    title="点击复制 Hash"
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
    </div>
  );
};
