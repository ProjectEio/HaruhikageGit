import React, { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ManagedRepository } from "../types";
import { RepoSidebar } from "./RepoSidebar";

interface TopNavBarProps {
  repos: ManagedRepository[];
  activeRepoPath: string | null;
  onSelectRepo: (path: string) => void;
  onAddRepo: (name: string, path: string, org: string, user: string, group: string) => void;
  onRemoveRepo: (path: string) => void;
  onCreateRepo: () => void;
  currentBranch: string;
  branches: string[];
  onSwitchBranch: (branch: string) => void;
}

export const TopNavBar: React.FC<TopNavBarProps> = ({
  repos,
  activeRepoPath,
  onSelectRepo,
  onAddRepo,
  onRemoveRepo,
  onCreateRepo,
  currentBranch,
  branches,
  onSwitchBranch,
}) => {
  const [repoMenuOpen, setRepoMenuOpen] = useState(false);
  const [branchMenuOpen, setBranchMenuOpen] = useState(false);
  const repoMenuRef = useRef<HTMLDivElement>(null);
  const branchMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (repoMenuRef.current && !repoMenuRef.current.contains(e.target as Node)) {
        setRepoMenuOpen(false);
      }
      if (branchMenuRef.current && !branchMenuRef.current.contains(e.target as Node)) {
        setBranchMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const normalizePath = (p: string | null) => {
    if (!p) return "";
    return p.replace(/\\/g, "/").toLowerCase();
  };

  const activeRepo = repos.find((r) => normalizePath(r.path) === normalizePath(activeRepoPath));
  
  let activeRepoName = "未关联本地仓库";
  if (activeRepo) {
    activeRepoName = activeRepo.name;
  } else if (activeRepoPath) {
    const parts = activeRepoPath.replace(/\\/g, "/").split("/");
    activeRepoName = parts[parts.length - 1] || activeRepoPath;
  }

  const handleSync = async () => {
    try {
      await invoke("git_push", { remote: "origin", branch: currentBranch });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      width: "100%",
      height: "48px",
      background: "rgba(255, 255, 255, 0.85)",
      backdropFilter: "blur(12px)",
      borderBottom: "1px solid rgba(0, 0, 0, 0.05)",
      WebkitAppRegion: "drag",
      userSelect: "none",
      position: "relative",
      zIndex: 1000
    }} className="top-nav-bar">
      
      {/* 1. Repository Switcher */}
      <div 
        ref={repoMenuRef}
        style={{ 
          height: "100%", 
          display: "flex", 
          alignItems: "center", 
          padding: "0 16px",
          borderRight: "1px solid rgba(0, 0, 0, 0.05)",
          cursor: "pointer",
          WebkitAppRegion: "no-drag",
          position: "relative"
        }}
        className="hover-bg"
        onClick={() => setRepoMenuOpen(!repoMenuOpen)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "10px" }}>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
        </svg>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: "500", lineHeight: "1" }}>Current repository</span>
          <span style={{ fontSize: "0.9rem", color: "var(--text-primary)", fontWeight: "600", lineHeight: "1.2" }}>{activeRepoName}</span>
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "8px", opacity: 0.7 }}>
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>

        {repoMenuOpen && (
          <div 
            style={{ 
              position: "absolute", 
              top: "100%", 
              left: 0, 
              width: "380px", 
              height: "400px", 
              background: "#fff", 
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
              zIndex: 1000,
              borderRadius: "0 0 8px 8px",
              display: "flex",
              border: "1px solid var(--border-color)",
              borderTop: "none"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <RepoSidebar
              repos={repos}
              activePath={activeRepoPath}
              onSwitchRepo={(p) => { onSelectRepo(p); setRepoMenuOpen(false); }}
              onAddRepo={onAddRepo}
              onRemoveRepo={onRemoveRepo || (() => {})}
              forceExpanded={true}
            />
          </div>
        )}
      </div>

      {/* 2. Branch Switcher */}
      <div 
        ref={branchMenuRef}
        style={{ 
          height: "100%", 
          display: "flex", 
          alignItems: "center", 
          padding: "0 16px",
          borderRight: "1px solid rgba(0, 0, 0, 0.05)",
          cursor: "pointer",
          WebkitAppRegion: "no-drag",
          position: "relative"
        }}
        className="hover-bg"
        onClick={() => setBranchMenuOpen(!branchMenuOpen)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "10px" }}>
          <line x1="6" y1="3" x2="6" y2="15"></line>
          <circle cx="18" cy="6" r="3"></circle>
          <circle cx="6" cy="18" r="3"></circle>
          <path d="M18 9a9 9 0 0 1-9 9"></path>
        </svg>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: "500", lineHeight: "1" }}>Current branch</span>
          <span style={{ fontSize: "0.9rem", color: "var(--text-primary)", fontWeight: "600", lineHeight: "1.2" }}>{currentBranch}</span>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "10px" }}>
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>

        {branchMenuOpen && (
          <div style={{
            position: "absolute",
            top: "100%",
            left: 0,
            width: "250px",
            background: "#fff",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            borderRadius: "0 0 6px 6px",
            border: "1px solid var(--border-color)",
            padding: "8px 0",
            maxHeight: "300px",
            overflowY: "auto",
            zIndex: 1001
          }}>
            <div style={{ padding: "4px 12px", fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: "600", borderBottom: "1px solid var(--border-color)", marginBottom: "4px" }}>
              Branches
            </div>
            {branches.map(b => (
              <div 
                key={b}
                className="hover-bg"
                style={{
                  padding: "8px 16px",
                  fontSize: "0.85rem",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between"
                }}
                onClick={() => {
                  onSwitchBranch(b);
                  setBranchMenuOpen(false);
                }}
              >
                <span>{b}</span>
                {b === currentBranch && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Sync Actions */}
      <div 
        style={{ 
          height: "100%", 
          display: "flex", 
          alignItems: "center", 
          padding: "0 16px",
          cursor: "pointer",
          WebkitAppRegion: "no-drag"
        }}
        className="hover-bg"
        onClick={handleSync}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "10px" }}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: "500", lineHeight: "1" }}>Sync branch</span>
          <span style={{ fontSize: "0.85rem", color: "var(--text-primary)", fontWeight: "500", lineHeight: "1.2" }}>Push / Pull commits</span>
        </div>
      </div>
      
      <style>{`
        .hover-bg:hover {
          background: rgba(0,0,0,0.03);
        }
      `}</style>
    </div>
  );
};
