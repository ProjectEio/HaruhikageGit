import React, { useState, useEffect } from "react";
import { StatusInfo } from "../types";

interface CommitFormProps {
  commitMsg: string;
  setCommitMsg: (val: string) => void;
  commitStageAll: boolean;
  setCommitStageAll: (val: boolean) => void;
  onGitCommit: () => void;
  status: StatusInfo | null;
  onSwitchProfile: (alias: string, global: boolean) => Promise<void>;
  currentBranch: string;
  stagedCount: number;
}

export const CommitForm: React.FC<CommitFormProps> = ({
  commitMsg,
  setCommitMsg,
  commitStageAll,
  setCommitStageAll,
  onGitCommit,
  status,
  onSwitchProfile,
  currentBranch,
  stagedCount,
}) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");

  // Sync internal state with external commitMsg (if cleared externally)
  useEffect(() => {
    if (!commitMsg) {
      setSummary("");
      setDescription("");
    }
  }, [commitMsg]);

  // Update external commitMsg when internal fields change
  useEffect(() => {
    if (summary || description) {
      const msg = description ? `${summary}\n\n${description}` : summary;
      if (msg !== commitMsg) {
        setCommitMsg(msg);
      }
    }
  }, [summary, description]);

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
    <div className="commit-form" style={{ padding: "10px", background: "#f8fafc", borderTop: "1px solid var(--border-color)", position: "relative" }}>
      <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
        {/* Avatar */}
        <div style={{ position: "relative" }}>
          <div
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            title={`当前 Git 身份: ${activeIdentityName} <${activeIdentityEmail}> \n点击快速切换身份`}
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              background: getAvatarGradient(activeIdentityName),
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.75rem",
              fontWeight: "700",
              cursor: "pointer",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              border: "1px solid rgba(0,0,0,0.1)",
              transition: "transform 0.15s, box-shadow 0.15s",
              flexShrink: 0,
              userSelect: "none"
            }}
          >
            {getAvatarInitials(activeIdentityName)}
          </div>

          {/* Profile quick selection dropdown menu */}
          {showProfileMenu && (
            <div
              className="profile-quick-menu"
              style={{
                position: "absolute",
                bottom: "34px",
                left: "0",
                background: "#ffffff",
                border: "1px solid var(--border-color)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                padding: "4px",
                zIndex: 1000,
                width: "180px",
                display: "flex",
                flexDirection: "column",
                gap: "2px",
                animation: "modalIn 0.15s ease"
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
                          padding: "4px 6px",
                          cursor: "pointer",
                          fontSize: "0.75rem",
                          display: "flex",
                          flexDirection: "column",
                          background: isActive ? "rgba(236, 72, 153, 0.05)" : "transparent",
                          color: isActive ? "var(--color-primary)" : "var(--text-primary)",
                          fontWeight: isActive ? "600" : "500",
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
                          {p.name}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Inputs */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
          <input
            type="text"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Summary (required)"
            style={{ 
              width: "100%", 
              padding: "6px 8px", 
              border: "1px solid var(--border-color)", 
              borderRadius: "4px",
              fontSize: "0.8rem",
              outline: "none"
            }}
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            rows={3}
            style={{ 
              width: "100%", 
              padding: "6px 8px", 
              border: "1px solid var(--border-color)", 
              borderRadius: "4px",
              fontSize: "0.8rem",
              outline: "none",
              resize: "none"
            }}
          />
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "38px" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ cursor: "pointer" }} title="Add Co-authors">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="8.5" cy="7" r="4"></circle>
            <line x1="20" y1="8" x2="20" y2="14"></line>
            <line x1="23" y1="11" x2="17" y2="11"></line>
          </svg>
        </div>
        <div className="checkbox-wrapper" style={{ paddingTop: "0" }}>
          <input
            type="checkbox"
            id="stage-all-checkbox"
            checked={commitStageAll}
            onChange={(e) => setCommitStageAll(e.target.checked)}
            style={{ width: "12px", height: "12px", margin: 0 }}
          />
          <label htmlFor="stage-all-checkbox" title="相当于 git commit -a" style={{ fontSize: "0.75rem", margin: 0, paddingLeft: "4px" }}>
            Commit -a
          </label>
        </div>
      </div>

      <div style={{ marginTop: "10px" }}>
        <button 
          className="btn btn-primary" 
          onClick={onGitCommit} 
          disabled={!summary.trim() || (!commitStageAll && stagedCount === 0)}
          style={{ width: "100%", padding: "8px 0", fontSize: "0.85rem", fontWeight: "600", borderRadius: "4px" }}
        >
          {commitStageAll || stagedCount === 0 
            ? `Commit to ${currentBranch === "unknown" ? "branch" : currentBranch}`
            : `Commit ${stagedCount} file${stagedCount > 1 ? "s" : ""} to ${currentBranch === "unknown" ? "branch" : currentBranch}`}
        </button>
      </div>
    </div>
  );
};
