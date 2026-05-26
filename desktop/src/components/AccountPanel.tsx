import React from "react";
import { StatusInfo } from "../types";

interface AccountPanelProps {
  status: StatusInfo | null;
  currentBranch: string;
  onAddProfile: () => void;
  onGithubLogin: () => void;
  onSwitchProfile: (alias: string, global: boolean) => Promise<void>;
  onDeleteProfile: (alias: string) => void;
  onOpenProxy: () => void;
}

export const AccountPanel: React.FC<AccountPanelProps> = ({
  status,
  currentBranch,
  onAddProfile,
  onGithubLogin,
  onSwitchProfile,
  onDeleteProfile,
  onOpenProxy,
}) => {
  const profiles = status?.profiles ?? [];

  return (
    <div className="account-panel">
      {/* Header row */}
      <div className="account-panel-header">
        <div>
          <div className="account-panel-label">Git Account Manager</div>
          <h1 className="account-panel-title">账号管理</h1>
        </div>
        <div className="account-header-actions">
          <button className="btn btn-secondary btn-sm" onClick={onOpenProxy}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" /><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M4.93 19.07l1.41-1.41M19.07 19.07l-1.41-1.41M12 2v2M12 20v2M2 12h2M20 12h2" />
            </svg>
            代理
          </button>
          <button className="btn btn-github btn-sm" onClick={onGithubLogin}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
            GitHub 登录
          </button>
          <button className="btn btn-primary btn-sm" onClick={onAddProfile}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            添加 Profile
          </button>
        </div>
      </div>

      {/* Current Identity Cards */}
      <div className="identity-grid">
        <div className="identity-card global">
          <div className="identity-card-scope">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            全局身份
          </div>
          <div className="identity-name">{status?.global_name || <span style={{ opacity: 0.4 }}>未配置</span>}</div>
          <div className="identity-email">{status?.global_email || <span style={{ opacity: 0.3 }}>—</span>}</div>
        </div>

        <div className="identity-card local">
          <div className="identity-card-scope">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            仓库身份
            {currentBranch && <span className="branch-pill">⎇ {currentBranch}</span>}
          </div>
          <div className="identity-name">
            {status?.is_repo
              ? (status.local_name || <span style={{ opacity: 0.4 }}>继承全局</span>)
              : <span style={{ opacity: 0.4 }}>未在 Git 仓库中</span>
            }
          </div>
          <div className="identity-email">
            {status?.is_repo
              ? (status.local_email || status?.global_email || <span style={{ opacity: 0.3 }}>—</span>)
              : <span style={{ opacity: 0.3 }}>—</span>
            }
          </div>
        </div>
      </div>

      {/* Profiles Section */}
      <div className="profiles-section">
        <div className="profiles-section-header">
          <div>
            <h2 className="profiles-section-title">已保存 Profiles</h2>
            <div className="profiles-config-path">{status?.config_path || "..."}</div>
          </div>
          <span className="count-badge">{profiles.length}</span>
        </div>

        {profiles.length === 0 ? (
          <div className="profiles-empty">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.2 }}>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
            <p>暂无 Profile</p>
            <p style={{ fontSize: "0.75rem", opacity: 0.5 }}>点击「添加 Profile」或「GitHub 登录」</p>
          </div>
        ) : (
          <div className="profiles-list">
            {profiles.map(([alias, p]) => {
              const isGlobal = status?.global_name === p.name && status?.global_email === p.email;
              const isLocal = status?.local_name === p.name && status?.local_email === p.email;
              return (
                <div key={alias} className="profile-card">
                  <div className="profile-card-left">
                    <div className="profile-card-alias-row">
                      <span className="profile-alias">{alias}</span>
                      {p.github_user && (
                        <span className="badge badge-github">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style={{ display: "inline", verticalAlign: "middle" }}>
                            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                          </svg>
                          {" "}{p.github_user}
                        </span>
                      )}
                      {isGlobal && <span className="badge badge-global">全局</span>}
                      {isLocal && <span className="badge badge-local">仓库</span>}
                    </div>
                    <div className="profile-name">{p.name}</div>
                    <div className="profile-email">{p.email}</div>
                    {p.signing_key && <div className="profile-gpg">GPG: {p.signing_key}</div>}
                  </div>
                  <div className="profile-card-actions">
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => onSwitchProfile(alias, true)}
                    >设为全局</button>
                    <button
                      className="btn btn-sm btn-primary"
                      disabled={!status?.is_repo}
                      onClick={() => onSwitchProfile(alias, false)}
                    >应用仓库</button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => onDeleteProfile(alias)}
                    >删除</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
