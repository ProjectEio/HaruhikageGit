import React, { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ManagedRepository } from "../types";

interface RepoPanelProps {
  repos: ManagedRepository[];
  activeRepoPath: string | null;
  isDragOver?: boolean;
  onSwitchRepo: (path: string) => void;
  onAddRepo: (name: string, path: string, org: string, user: string, group: string) => void;
  onRemoveRepo: (path: string) => void;
  onOpenInExplorer: (path: string) => void;
  onOpenInVscode: (path: string) => void;
}

type GroupKey = "org" | "group";

interface RepoDetectInfo {
  is_git: boolean;
  name: string;
  remote_url: string | null;
  org: string;
  current_branch: string;
}

interface AddForm {
  name: string;
  path: string;
  org: string;
  user: string;
  group: string;
}

export const RepoPanel: React.FC<RepoPanelProps> = ({
  repos,
  activeRepoPath,
  isDragOver = false,
  onSwitchRepo,
  onAddRepo,
  onRemoveRepo,
  onOpenInExplorer,
  onOpenInVscode,
}) => {
  const [groupBy, setGroupBy] = useState<GroupKey>("group");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; repo: ManagedRepository } | null>(null);

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>({ name: "", path: "", org: "未分组", user: "", group: "默认" });
  const [detecting, setDetecting] = useState(false);

  const normalizePath = (p: string | null) =>
    p ? p.replace(/\\/g, "/").toLowerCase() : "";

  const toggleGroup = (key: string) =>
    setExpandedGroups(prev => ({ ...prev, [key]: prev[key] !== false ? false : true }));

  // ─── Grouping ─────────────────────────────────────────────────────────────

  const getGrouped = () => {
    const groups: Record<string, ManagedRepository[]> = {};
    for (const repo of repos) {
      const key = groupBy === "org"
        ? (repo.organization || "独立")
        : (repo.custom_group || "默认");
      if (!groups[key]) groups[key] = [];
      groups[key].push(repo);
    }
    return groups;
  };

  const grouped = getGrouped();

  // ─── Browse for folder (manual add) ──────────────────────────────────────

  const autoDetectAndFill = async (path: string) => {
    setDetecting(true);
    try {
      const info: RepoDetectInfo = await invoke("detect_git_repo_info", { path });
      if (info.is_git) {
        setAddForm({
          name: info.name,
          path,
          org: info.org || "未分组",
          user: "",
          group: "默认",
        });
        setShowAddForm(true);
      } else {
        alert(`"${path}" 不是 Git 仓库`);
      }
    } catch (err) {
      console.error("detect error", err);
    } finally {
      setDetecting(false);
    }
  };

  const handleBrowseForFolder = useCallback(async () => {
    const input = document.createElement("input");
    input.type = "file";
    (input as any).webkitdirectory = true;
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      const path = (f as any).path as string | undefined;
      if (path) {
        await autoDetectAndFill(path);
      }
    };
    input.click();
  }, []);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name.trim() || !addForm.path.trim()) return;
    onAddRepo(addForm.name, addForm.path, addForm.org, addForm.user, addForm.group);
    setShowAddForm(false);
    setAddForm({ name: "", path: "", org: "未分组", user: "", group: "默认" });
  };

  // ─── Context Menu ─────────────────────────────────────────────────────────

  const handleContextMenu = (e: React.MouseEvent, repo: ManagedRepository) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, repo });
  };

  const closeContextMenu = () => setContextMenu(null);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      className="repo-panel"
      onClick={closeContextMenu}
    >
      {/* Header */}
      <div className="repo-panel-header">
        <div className="repo-panel-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          仓库
          <span className="count-badge">{repos.length}</span>
        </div>
        <div className="repo-panel-actions">
          <button className="icon-btn-sm" onClick={handleBrowseForFolder} title="选择文件夹添加仓库">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          </button>
          <button className="icon-btn-sm" onClick={() => setShowAddForm(true)} title="手动添加">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Group tabs */}
      <div className="group-tabs">
        <button
          className={`group-tab ${groupBy === "group" ? "active" : ""}`}
          onClick={() => setGroupBy("group")}
        >自定义组</button>
        <button
          className={`group-tab ${groupBy === "org" ? "active" : ""}`}
          onClick={() => setGroupBy("org")}
        >组织</button>
      </div>

      {/* Drop zone hint / repo list */}
      <div className={`repo-list-wrapper ${isDragOver ? "drag-over" : ""}`}>
        {detecting && (
          <div className="drop-hint detecting">正在检测仓库...</div>
        )}

        {repos.length === 0 && !isDragOver && !detecting && (
          <div className="drop-hint">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            <span>拖入文件夹添加仓库</span>
            <span style={{ fontSize: "0.7rem", opacity: 0.5 }}>或点击上方 + 按钮</span>
          </div>
        )}

        {isDragOver && (
          <div className="drop-hint active">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span>松开以添加 Git 仓库</span>
          </div>
        )}

        {!isDragOver && repos.length > 0 &&
          Object.entries(grouped).map(([groupName, items]) => {
            const isExpanded = expandedGroups[groupName] !== false;
            return (
              <div key={groupName} className="repo-group">
                <div
                  className="repo-group-header"
                  onClick={() => toggleGroup(groupName)}
                >
                  <svg
                    width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.15s" }}
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  <span className="repo-group-name">{groupName}</span>
                  <span className="repo-group-count">{items.length}</span>
                </div>

                {isExpanded && (
                  <div className="repo-group-items">
                    {items.map(repo => {
                      const isActive = normalizePath(repo.path) === normalizePath(activeRepoPath);
                      return (
                        <div
                          key={repo.path}
                          className={`repo-item ${isActive ? "active" : ""}`}
                          onClick={() => onSwitchRepo(repo.path)}
                          onContextMenu={(e) => handleContextMenu(e, repo)}
                        >
                          <div className="repo-item-icon">
                            {isActive
                              ? <span style={{ color: "var(--color-primary)" }}>●</span>
                              : <span style={{ color: "var(--text-muted)" }}>○</span>
                            }
                          </div>
                          <div className="repo-item-info">
                            <span className="repo-item-name">{repo.name}</span>
                            <span className="repo-item-path" title={repo.path}>
                              {repo.path}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        }
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 200 }}
            onClick={closeContextMenu}
            onContextMenu={(e) => { e.preventDefault(); closeContextMenu(); }}
          />
          <div
            className="context-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={closeContextMenu}
          >
            <button onClick={() => onSwitchRepo(contextMenu.repo.path)}>切换到此仓库</button>
            <button onClick={() => onOpenInExplorer(contextMenu.repo.path)}>在资源管理器中打开</button>
            <button onClick={() => onOpenInVscode(contextMenu.repo.path)}>在 VS Code 中打开</button>
            <div className="context-menu-divider" />
            <button
              className="danger"
              onClick={() => {
                if (confirm(`取消托管 '${contextMenu.repo.name}'？本地文件不受影响。`)) {
                  onRemoveRepo(contextMenu.repo.path);
                }
              }}
            >取消托管</button>
          </div>
        </>
      )}

      {/* Add Repo Form Modal */}
      {showAddForm && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ width: 420 }}>
            <div className="modal-header">
              <h3>添加 Git 仓库</h3>
              <button className="close-btn" onClick={() => setShowAddForm(false)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleAddSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div className="form-group">
                  <label>仓库名称</label>
                  <input
                    value={addForm.name}
                    onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="显示别名，如 my-project"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>本地路径</label>
                  <input
                    value={addForm.path}
                    onChange={e => setAddForm(f => ({ ...f, path: e.target.value }))}
                    placeholder="例如 E:\projects\my-repo"
                    required
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div className="form-group">
                    <label>组织</label>
                    <input
                      value={addForm.org}
                      onChange={e => setAddForm(f => ({ ...f, org: e.target.value }))}
                      placeholder="例如 GitHub / 公司"
                    />
                  </div>
                  <div className="form-group">
                    <label>自定义分组</label>
                    <input
                      value={addForm.group}
                      onChange={e => setAddForm(f => ({ ...f, group: e.target.value }))}
                      placeholder="例如 Work / Personal"
                    />
                  </div>
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddForm(false)}>取消</button>
                  <button type="submit" className="btn btn-primary">确认添加</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
