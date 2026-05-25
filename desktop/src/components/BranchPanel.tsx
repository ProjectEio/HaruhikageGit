import React from "react";
import { StatusInfo } from "../types";

interface BranchPanelProps {
  status: StatusInfo | null;
  branches: string[];
  currentBranch: string;
  onCheckoutBranch: (branch: string) => void;
  onCreateBranch: () => void;
  onDeleteBranch: (branch: string) => void;
}

export const BranchPanel: React.FC<BranchPanelProps> = ({
  status,
  branches,
  currentBranch,
  onCheckoutBranch,
  onCreateBranch,
  onDeleteBranch,
}) => {
  return (
    <div className="section-card branch-panel">
      <div className="section-header">
        <h3 className="section-title">分支管理</h3>
        {status?.is_repo && (
          <button className="btn btn-sm btn-primary" onClick={onCreateBranch}>
            + 新建
          </button>
        )}
      </div>

      <div className="branch-selector-row">
        <label htmlFor="active-branch-sel">切换分支:</label>
        <select
          id="active-branch-sel"
          value={currentBranch}
          onChange={(e) => e.target.value && onCheckoutBranch(e.target.value)}
          disabled={!status?.is_repo}
        >
          {!status?.is_repo ? (
            <option value="">(不在 Git 仓库内)</option>
          ) : (
            branches.map((b) => (
              <option value={b} key={b}>
                {b}
              </option>
            ))
          )}
        </select>
      </div>

      <div className="branches-list-wrapper">
        <div className="branches-list">
          {!status || !status.is_repo ? (
            <div className="empty-placeholder">请在 Git 仓库下启动程序</div>
          ) : (
            branches.map((b) => {
              const isActive = b === currentBranch;
              return (
                <div className={`branch-item ${isActive ? "active" : ""}`} key={b}>
                  <span className="branch-item-name">
                    {isActive && "● "}
                    {b}
                  </span>
                  <div className="branch-item-actions">
                    {!isActive && (
                      <button onClick={() => onCheckoutBranch(b)} title="切换至该分支">
                        切换
                      </button>
                    )}
                    {!isActive && (
                      <button onClick={() => onDeleteBranch(b)} title="删除分支">
                        删除
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
