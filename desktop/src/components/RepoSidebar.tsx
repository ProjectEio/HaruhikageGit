import React, { useState } from "react";
import { ManagedRepository } from "../types";

interface RepoSidebarProps {
  repos: ManagedRepository[];
  activePath: string | null;
  onSwitchRepo: (path: string) => void;
  onAddRepo: (name: string, path: string, org: string, user: string, group: string) => void;
  onRemoveRepo: (path: string) => void;
}

type GroupBy = "org" | "user" | "group";

export const RepoSidebar: React.FC<RepoSidebarProps> = ({
  repos,
  activePath,
  onSwitchRepo,
  onAddRepo,
  onRemoveRepo,
}) => {
  const [groupBy, setGroupBy] = useState<GroupBy>("org");
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [org, setOrg] = useState("DefaultOrg");
  const [user, setUser] = useState("DefaultUser");
  const [group, setGroup] = useState("DefaultGroup");

  // Expanded groups state
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupKey]: prev[groupKey] === false ? true : false, // default expanded
    }));
  };

  // Grouping logic
  const getGroups = () => {
    const groups: Record<string, ManagedRepository[]> = {};
    repos.forEach((repo) => {
      let key = "未命名分组";
      if (groupBy === "org") {
        key = repo.organization || "独立组织";
      } else if (groupBy === "user") {
        key = repo.user || "独立用户";
      } else if (groupBy === "group") {
        key = repo.custom_group || "常规";
      }
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(repo);
    });
    return groups;
  };

  const grouped = getGroups();

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !path.trim()) return;
    onAddRepo(name.trim(), path.trim(), org.trim(), user.trim(), group.trim());
    setName("");
    setPath("");
    setIsAddOpen(false);
  };

  return (
    <div className="section-card repo-sidebar" style={{ flex: 1, minHeight: "350px", display: "flex", flexDirection: "column", gap: "10px" }}>
      <div className="section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 className="section-title">仓库管理器</h3>
        <button
          className="btn btn-sm btn-primary"
          onClick={() => setIsAddOpen(true)}
          title="添加本地 Git 仓库托管"
        >
          + 托管
        </button>
      </div>

      {/* Grouping Tabs */}
      <div className="tab-switcher" style={{ display: "flex", background: "rgba(0,0,0,0.2)", borderRadius: "6px", padding: "2px" }}>
        <button
          className={`tab-btn ${groupBy === "org" ? "active" : ""}`}
          onClick={() => setGroupBy("org")}
          style={{ flex: 1, border: "none", background: "transparent", color: groupBy === "org" ? "#fff" : "var(--text-secondary)", fontSize: "0.75rem", padding: "6px 0", cursor: "pointer", borderRadius: "4px", fontWeight: "600", transition: "all 0.2s" }}
        >
          按组织
        </button>
        <button
          className={`tab-btn ${groupBy === "user" ? "active" : ""}`}
          onClick={() => setGroupBy("user")}
          style={{ flex: 1, border: "none", background: "transparent", color: groupBy === "user" ? "#fff" : "var(--text-secondary)", fontSize: "0.75rem", padding: "6px 0", cursor: "pointer", borderRadius: "4px", fontWeight: "600", transition: "all 0.2s" }}
        >
          按用户
        </button>
        <button
          className={`tab-btn ${groupBy === "group" ? "active" : ""}`}
          onClick={() => setGroupBy("group")}
          style={{ flex: 1, border: "none", background: "transparent", color: groupBy === "group" ? "#fff" : "var(--text-secondary)", fontSize: "0.75rem", padding: "6px 0", cursor: "pointer", borderRadius: "4px", fontWeight: "600", transition: "all 0.2s" }}
        >
          自定义组
        </button>
      </div>

      {/* Repositories Tree List */}
      <div className="repos-tree-wrapper" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px", maxHeight: "380px" }}>
        {Object.keys(grouped).length === 0 ? (
          <div className="empty-placeholder" style={{ padding: "30px 10px" }}>
            暂无托管的 Git 仓库
            <br />
            请点击右上角【+ 托管】添加
          </div>
        ) : (
          Object.entries(grouped).map(([groupName, items]) => {
            const isExpanded = expandedGroups[groupName] !== false;
            return (
              <div key={groupName} className="tree-group-box" style={{ display: "flex", flexDirection: "column" }}>
                {/* Collapsible Heading */}
                <div
                  className="tree-group-header"
                  onClick={() => toggleGroup(groupName)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "6px 8px",
                    background: "rgba(255,255,255,0.02)",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "0.75rem",
                    fontWeight: "600",
                    color: "var(--text-secondary)",
                    userSelect: "none",
                    borderLeft: "2px solid var(--color-primary)"
                  }}
                >
                  <span>{groupName} ({items.length})</span>
                  <span style={{ fontSize: "0.65rem" }}>{isExpanded ? "▲" : "▼"}</span>
                </div>

                {/* Repository Items under group */}
                {isExpanded && (
                  <div className="tree-group-items" style={{ display: "flex", flexDirection: "column", gap: "4px", paddingLeft: "6px", marginTop: "4px" }}>
                    {items.map((repo) => {
                      const isActive = activePath === repo.path;
                      return (
                        <div
                          key={repo.path}
                          onClick={() => onSwitchRepo(repo.path)}
                          className={`profile-item repo-tree-item ${isActive ? "active" : ""}`}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "8px 10px",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontSize: "0.8rem",
                            transition: "all 0.2s"
                          }}
                        >
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px", maxWidth: "80%" }}>
                            <span style={{ fontWeight: "600", color: isActive ? "var(--color-primary-hover)" : "var(--text-primary)" }}>{repo.name}</span>
                            <span className="profile-item-email" style={{ fontSize: "0.65rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={repo.path}>
                              {repo.path}
                            </span>
                          </div>
                          
                          {/* Remove button */}
                          <button
                            className="btn-delete"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`确认取消托管仓库 '${repo.name}' 吗？（本地文件不会受影响）`)) {
                                onRemoveRepo(repo.path);
                              }
                            }}
                            title="取消托管"
                            style={{
                              border: "none",
                              background: "transparent",
                              color: "var(--text-muted)",
                              cursor: "pointer",
                              padding: "4px"
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add Repository Modal Sheet */}
      {isAddOpen && (
        <div className="modal-overlay" style={{ background: "rgba(0,0,0,0.8)" }}>
          <div className="modal-card" style={{ width: "400px" }}>
            <div className="modal-header">
              <h3>托管本地仓库</h3>
              <button className="close-btn" onClick={() => setIsAddOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleFormSubmit} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div className="form-group">
                  <label htmlFor="repo-name">仓库显示别名:</label>
                  <input
                    type="text"
                    id="repo-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="例如: HaruhikageGit"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="repo-path">本地绝对路径:</label>
                  <input
                    type="text"
                    id="repo-path"
                    value={path}
                    onChange={(e) => setPath(e.target.value)}
                    placeholder="例如: E:\NewDevelop\git-fast"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="repo-org">组织归属 (Organization/Host):</label>
                  <input
                    type="text"
                    id="repo-org"
                    value={org}
                    onChange={(e) => setOrg(e.target.value)}
                    placeholder="例如: ProjectEio"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="repo-user">用户归属 (Owner/User):</label>
                  <input
                    type="text"
                    id="repo-user"
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                    placeholder="例如: nanaeo"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="repo-group">自定义编组 (Group Tag):</label>
                  <input
                    type="text"
                    id="repo-group"
                    value={group}
                    onChange={(e) => setGroup(e.target.value)}
                    placeholder="例如: Work / Personal / Research"
                  />
                </div>
                <div className="modal-actions" style={{ marginTop: "10px" }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setIsAddOpen(false)}>取消</button>
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
