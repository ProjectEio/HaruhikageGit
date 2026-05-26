import React, { useState, useEffect, useRef } from "react";
import { ManagedRepository } from "../types";
import { RepoSidebar } from "./RepoSidebar";

interface TopNavBarProps {
  repos: ManagedRepository[];
  activeRepoPath: string | null;
  onSelectRepo: (path: string) => void;
  onAddRepo: (name: string, path: string, org: string, user: string, group: string) => void;
  onRemoveRepo: (path: string) => void;
  currentBranch: string;
}

export const TopNavBar: React.FC<TopNavBarProps> = ({
  repos,
  activeRepoPath,
  onSelectRepo,
  onAddRepo,
  onRemoveRepo,
  currentBranch,
}) => {
  const [repoMenuOpen, setRepoMenuOpen] = useState(false);
  const repoMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (repoMenuRef.current && !repoMenuRef.current.contains(e.target as Node)) {
        setRepoMenuOpen(false);
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
    } as any} className="top-nav-bar">
      
      {/* 1. Repository Switcher */}
      <div 
        ref={repoMenuRef}
        style={{ 
          height: "100%", 
          display: "flex", 
          alignItems: "center", 
          padding: "0 16px",
          cursor: "pointer",
          WebkitAppRegion: "no-drag",
          position: "relative"
        } as any}
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
              onRemoveRepo={onRemoveRepo}
              forceExpanded={true}
            />
          </div>
        )}
      </div>

      {/* 2. Current Branch (read-only indicator) */}
      {currentBranch && (
        <div 
          style={{ 
            height: "100%", 
            display: "flex", 
            alignItems: "center", 
            padding: "0 16px",
            WebkitAppRegion: "no-drag"
          } as any}
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
        </div>
      )}
      
      <style>{`
        .hover-bg:hover {
          background: rgba(0,0,0,0.03);
        }
      `}</style>
    </div>
  );
};
