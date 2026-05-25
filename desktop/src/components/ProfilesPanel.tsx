import React from "react";
import { StatusInfo } from "../types";

interface ProfilesPanelProps {
  status: StatusInfo | null;
  onSwitchProfile: (alias: string, global: boolean) => void;
  onDeleteProfile: (alias: string) => void;
  onOpenAddModal: () => void;
  onOpenGithubModal: () => void;
}

export const ProfilesPanel: React.FC<ProfilesPanelProps> = ({
  status,
  onSwitchProfile,
  onDeleteProfile,
  onOpenAddModal,
  onOpenGithubModal,
}) => {
  return (
    <div className="section-card profiles-panel">
      <div className="section-header">
        <h3 className="section-title">Profiles 别名</h3>
        <div className="header-btns">
          <button className="btn btn-sm btn-primary" onClick={onOpenAddModal} title="添加新 Profile">
            + 添加
          </button>
          <button className="btn btn-sm btn-github" onClick={onOpenGithubModal} title="一键 GitHub OAuth 登录">
            GH 登录
          </button>
        </div>
      </div>

      <div className="profiles-list">
        {!status || status.profiles.length === 0 ? (
          <div className="empty-placeholder">
            暂无 Profiles 别名
            <br />
            请点击右上角【＋添加】
          </div>
        ) : (
          status.profiles.map(([alias, p]) => {
            const isCurrentLocal = status.is_repo && status.local_name === p.name && status.local_email === p.email;
            const isCurrentGlobal = !isCurrentLocal && status.global_name === p.name && status.global_email === p.email;
            const isActive = isCurrentLocal || (!status.is_repo && isCurrentGlobal);

            return (
              <div
                key={alias}
                className={`profile-item ${isActive ? "active" : ""}`}
                onDoubleClick={() => onSwitchProfile(alias, !status.is_repo)}
              >
                <div className="profile-item-details">
                  <div className="profile-alias-row">
                    <span className="profile-item-alias">{alias}</span>
                    {p.signing_key && <span className="profile-item-gpg">GPG</span>}
                    {p.github_user && (
                      <span
                        className="profile-item-gpg"
                        style={{ background: "rgba(16,185,129,0.1)", color: "var(--color-success-hover)" }}
                      >
                        GH: {p.github_user}
                      </span>
                    )}
                  </div>
                  <span className="profile-item-name">{p.name}</span>
                  <span className="profile-item-email">{p.email}</span>
                </div>
                <div className="profile-item-actions">
                  <button onClick={() => onSwitchProfile(alias, false)} title="应用到当前仓库">
                    本地
                  </button>
                  <button onClick={() => onSwitchProfile(alias, true)} title="应用到全局 config">
                    全局
                  </button>
                  <button
                    className="btn-delete"
                    onClick={() => onDeleteProfile(alias)}
                    title="删除 Profile"
                  >
                    删除
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
