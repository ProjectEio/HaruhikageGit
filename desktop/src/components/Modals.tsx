import React from "react";
import { DeviceCode } from "../types";

// ==========================================
// 1. Add Profile Modal
// ==========================================
interface AddProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  newAlias: string;
  setNewAlias: (val: string) => void;
  newName: string;
  setNewName: (val: string) => void;
  newEmail: string;
  setNewEmail: (val: string) => void;
  newGpg: string;
  setNewGpg: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const AddProfileModal: React.FC<AddProfileModalProps> = ({
  isOpen,
  onClose,
  newAlias,
  setNewAlias,
  newName,
  setNewName,
  newEmail,
  setNewEmail,
  newGpg,
  setNewGpg,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <h3>📂 添加新 Profile</h3>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <form onSubmit={onSubmit}>
            <div className="form-group">
              <label htmlFor="prof-alias-input">别名 (Alias, 例如 work / home):</label>
              <input
                type="text"
                id="prof-alias-input"
                value={newAlias}
                onChange={(e) => setNewAlias(e.target.value)}
                required
                placeholder="请输入别名"
              />
            </div>
            <div className="form-group">
              <label htmlFor="prof-name-input">Git user.name:</label>
              <input
                type="text"
                id="prof-name-input"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                placeholder="请输入姓名"
              />
            </div>
            <div className="form-group">
              <label htmlFor="prof-email-input">Git user.email:</label>
              <input
                type="email"
                id="prof-email-input"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                placeholder="请输入邮箱"
              />
            </div>
            <div className="form-group">
              <label htmlFor="prof-gpg-input">GPG Key (可选):</label>
              <input
                type="text"
                id="prof-gpg-input"
                value={newGpg}
                onChange={(e) => setNewGpg(e.target.value)}
                placeholder="例如 ABC123DEF"
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                取消
              </button>
              <button type="submit" className="btn btn-primary">
                确认保存
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 2. GitHub Login Modal
// ==========================================
interface GithubLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  githubAlias: string;
  setGithubAlias: (val: string) => void;
  githubPat: string;
  setGithubPat: (val: string) => void;
  githubDevice: DeviceCode | null;
  githubPollingMsg: string;
  onRequestCode: () => void;
  onPatSubmit: () => void;
}

export const GithubLoginModal: React.FC<GithubLoginModalProps> = ({
  isOpen,
  onClose,
  githubAlias,
  setGithubAlias,
  githubPat,
  setGithubPat,
  githubDevice,
  githubPollingMsg,
  onRequestCode,
  onPatSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <h3>🌸 GitHub OAuth 一键授权登录</h3>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body text-center">
          {!githubDevice ? (
            <div style={{ textAlign: "left" }}>
              <div className="form-group">
                <label htmlFor="gh-alias-input">要保存的 Profile 别名:</label>
                <input
                  type="text"
                  id="gh-alias-input"
                  value={githubAlias}
                  onChange={(e) => setGithubAlias(e.target.value)}
                  required
                />
              </div>
              <button
                className="btn btn-github btn-large"
                onClick={onRequestCode}
                style={{ width: "100%", marginTop: "14px" }}
              >
                🚀 开始请求验证码
              </button>

              <div className="divider">或者使用 Personal Access Token (PAT) 登录</div>

              <div className="form-group">
                <label htmlFor="gh-pat-input">GitHub PAT (需具备 repo 和 user:email 权限):</label>
                <input
                  type="password"
                  id="gh-pat-input"
                  value={githubPat}
                  onChange={(e) => setGithubPat(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxx"
                />
              </div>
              <button
                className="btn btn-primary"
                onClick={onPatSubmit}
                style={{ width: "100%", marginTop: "14px" }}
              >
                🔑 用 PAT 登录
              </button>
            </div>
          ) : (
            <div>
              <p className="auth-instruction">请使用浏览器访问以下授权地址：</p>
              <div className="auth-uri-box" style={{ margin: "14px 0" }}>
                <a href={githubDevice.verification_uri} target="_blank" rel="noreferrer">
                  点击打开 GitHub 授权页面 🔗
                </a>
              </div>
              <p className="auth-instruction">并在页面中输入验证码：</p>
              <div className="auth-code-box" style={{ margin: "14px auto" }}>
                {githubDevice.user_code}
              </div>

              <div className="auth-polling-status">
                <span className="pulse-indicator"></span>
                <span>{githubPollingMsg}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 3. Proxy Config Modal
// ==========================================
interface ProxyModalProps {
  isOpen: boolean;
  onClose: () => void;
  proxyAuto: boolean;
  setProxyAuto: (val: boolean) => void;
  proxyUrl: string;
  setProxyUrl: (val: string) => void;
  effectiveProxy: string | null;
  onSubmit: (e: React.FormEvent) => void;
}

export const ProxyModal: React.FC<ProxyModalProps> = ({
  isOpen,
  onClose,
  proxyAuto,
  setProxyAuto,
  proxyUrl,
  setProxyUrl,
  effectiveProxy,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <h3>🌐 网络代理配置</h3>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <form onSubmit={onSubmit}>
            <div className="form-group checkbox-row">
              <input
                type="checkbox"
                id="px-auto-cb"
                checked={proxyAuto}
                onChange={(e) => setProxyAuto(e.target.checked)}
              />
              <label htmlFor="px-auto-cb">开启自动检测系统代理 (优先读取环境变量/注册表)</label>
            </div>
            <div className="form-group">
              <label htmlFor="px-url-input">手动指定代理 URL (例如 http://127.0.0.1:7890):</label>
              <input
                type="text"
                id="px-url-input"
                value={proxyUrl}
                onChange={(e) => setProxyUrl(e.target.value)}
                placeholder="不设置则直连"
              />
            </div>
            <div className="proxy-effective-status">
              <span>当前生效的实际代理:</span>
              <strong>{effectiveProxy ? effectiveProxy : "直连 (DIRECT)"}</strong>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                关闭
              </button>
              <button type="submit" className="btn btn-primary">
                保存设置
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
