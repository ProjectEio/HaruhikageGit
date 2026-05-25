import React, { useState, useMemo, useRef, useEffect } from "react";
import { GitFileStatus } from "../types";

interface FileStagingProps {
  gitStatus: GitFileStatus[];
  onStageFiles: (paths: string[], stage: boolean) => void;

  onUndoAll: () => void;
  onSelectFileForPreview: (path: string) => void;
}

export const FileStaging: React.FC<FileStagingProps> = ({
  gitStatus,
  onStageFiles,
  onStageAll,
  onUndoAll,
  onSelectFileForPreview,
}) => {
  const [filter, setFilter] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Group files by path to handle files that are both staged and modified
  const uniqueFiles = useMemo(() => {
    const map = new Map<string, { isStaged: boolean; status: string }>();
    gitStatus.forEach((f) => {
      const existing = map.get(f.path);
      if (!existing) {
        map.set(f.path, { isStaged: f.status === "staged", status: f.status });
      } else {
        if (f.status === "staged") {
          existing.isStaged = true;
        } else {
          existing.status = f.status;
        }
      }
    });
    return Array.from(map.entries())
      .map(([path, data]) => ({ path, ...data }))
      .sort((a, b) => a.path.localeCompare(b.path));
  }, [gitStatus]);

  const filteredFiles = useMemo(() => {
    if (!filter) return uniqueFiles;
    return uniqueFiles.filter((f) => f.path.toLowerCase().includes(filter.toLowerCase()));
  }, [uniqueFiles, filter]);

  const hasChanges = uniqueFiles.length > 0;

  
  const allFilteredStaged = filteredFiles.length > 0 && filteredFiles.every(f => f.isStaged);
  const someFilteredStaged = filteredFiles.some(f => f.isStaged);

  const handleMasterCheckboxChange = () => {
    const paths = filteredFiles.map(f => f.path);
    if (allFilteredStaged) {
      onStageFiles(paths, false);
    } else {
      onStageFiles(paths, true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "a") {
      e.preventDefault();
      // If any is unstaged, stage all. If all staged, unstage all.
      handleMasterCheckboxChange();
    }
  };

  if (!hasChanges) {
    return (
      <div className="empty-placeholder" style={{ padding: "50px 20px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", background: "#f8fafc", flex: 1 }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
        <span style={{ fontWeight: "600", fontSize: "0.95rem", color: "var(--text-primary)" }}>0 changed files</span>
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", maxWidth: "80%", textAlign: "center" }}>工作区干净，没有任何未暂存或未提交的变更。</span>
      </div>
    );
  }

  return (
    <div 
      className="file-staging-container" 
      style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", outline: "none" }}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      ref={containerRef}
    >
      {/* Header / Filter Row */}
      <div style={{ display: "flex", flexDirection: "column", borderBottom: "1px solid var(--border-color)", background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", padding: "6px 12px", borderBottom: "1px solid #f1f5f9" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "6px" }}>
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            placeholder="Filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ border: "none", outline: "none", fontSize: "0.8rem", width: "100%", background: "transparent" }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", padding: "6px 12px", gap: "8px", background: "#f8fafc" }}>
          <input
            type="checkbox"
            checked={allFilteredStaged}
            ref={(input) => {
              if (input) input.indeterminate = !allFilteredStaged && someFilteredStaged;
            }}
            onChange={handleMasterCheckboxChange}
            style={{ cursor: "pointer", width: "14px", height: "14px", margin: 0 }}
          />
          <span style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--text-primary)" }}>
            {filteredFiles.length} changed files
          </span>
        </div>
      </div>

      {/* File List */}
      <div className="files-list" style={{ flex: 1, overflowY: "auto", background: "#fff", paddingTop: "4px" }}>
        {filteredFiles.map((f) => {
          return (
            <div 
              key={f.path} 
              style={{ display: "flex", alignItems: "center", padding: "4px 12px", gap: "8px" }}
              className="file-item-row hover-bg"
            >
              <input
                type="checkbox"
                checked={f.isStaged}
                onChange={(e) => onStageFiles([f.path], e.target.checked)}
                style={{ cursor: "pointer", width: "14px", height: "14px", margin: 0, flexShrink: 0 }}
              />
              <span
                className="file-path"
                title="点击查看详细变更差异"
                onClick={() => { console.log("[FileStaging] click path:", JSON.stringify(f.path), "charCodes:", Array.from(f.path).map(c => c.charCodeAt(0))); onSelectFileForPreview(f.path); }}
                style={{ cursor: "pointer", color: "var(--text-primary)", fontSize: "0.8rem", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >

                {f.path}
              </span>
              <span 
                style={{ 
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "14px",
                  height: "14px",
                  marginRight: "4px"
                }}
                title={f.status}
              >
                {f.status === "added" || f.status === "untracked" ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect width="14" height="14" rx="2" fill="#22c55e" fillOpacity="0.1" stroke="#22c55e" strokeWidth="1"/>
                    <path d="M7 3v8M3 7h8" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                ) : f.status === "deleted" ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect width="14" height="14" rx="2" fill="#ef4444" fillOpacity="0.1" stroke="#ef4444" strokeWidth="1"/>
                    <path d="M3 7h8" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect width="14" height="14" rx="2" fill="#f59e0b" fillOpacity="0.1" stroke="#f59e0b" strokeWidth="1"/>
                    <rect x="4.5" y="4.5" width="5" height="5" rx="1" fill="#f59e0b"/>
                  </svg>
                )}
              </span>
            </div>
          );
        })}
      </div>
      
      {/* Footer Undo Option (Optional, but kept for utility) */}
      <div style={{ padding: "8px 12px", borderTop: "1px solid var(--border-color)", background: "#f8fafc", display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={onUndoAll}
          title="放弃当前所有未提交的变动并还原代码"
          style={{
            background: "transparent",
            color: "var(--color-danger)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            fontSize: "0.75rem",
            padding: "4px 8px",
            borderRadius: "4px",
            cursor: "pointer"
          }}
        >
          Undo All
        </button>
      </div>
    </div>
  );
};
