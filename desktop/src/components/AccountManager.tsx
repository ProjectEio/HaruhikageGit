import React from "react";
import { StatusInfo } from "../types";

interface AccountManagerProps {
  status: StatusInfo | null;
  onAddProfile: () => void;
  onGithubLogin: () => void;
  onSwitchProfile: (alias: string, global: boolean) => Promise<void>;
  onDeleteProfile: (alias: string) => void;
  onOpenProxy: () => void;
}

const identityText = (name?: string | null, email?: string | null) => {
  if (!name && !email) return "未配置";
  return `${name || "未配置姓名"} <${email || "未配置邮箱"}>`;
};

export const AccountManager: React.FC<AccountManagerProps> = ({
  status,
  onAddProfile,
  onGithubLogin,
  onSwitchProfile,
  onDeleteProfile,
  onOpenProxy,
}) => {
  const profiles = status?.profiles ?? [];

  return (
    <main style={{ flex: 1, overflow: "auto", background: "#f8fafc", padding: "24px" }}>
      <div style={{ maxWidth: "960px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "18px" }}>
        <section style={{ background: "#fff", border: "1px solid var(--border-color)", borderRadius: "14px", padding: "22px", boxShadow: "0 10px 30px rgba(15,23,42,0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
            <div>
              <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Git Account Manager</div>
              <h1 style={{ margin: "6px 0 8px", fontSize: "1.6rem", color: "var(--text-primary)" }}>账号管理</h1>
              <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.92rem" }}>
                仅保留 Git 身份切换、Profile 管理与 GitHub 登录，提交、分支和文件变更界面已隐藏。
              </p>
            </div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={onOpenProxy}>代理设置</button>
              <button className="btn btn-github" onClick={onGithubLogin}>GitHub 登录</button>
              <button className="btn btn-primary" onClick={onAddProfile}>添加 Profile</button>
            </div>
          </div>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "14px" }}>
          <div style={{ background: "#fff", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "18px" }}>
            <div style={{ color: "var(--text-muted)", fontSize: "0.76rem", fontWeight: 700 }}>全局 Git 身份</div>
            <div style={{ marginTop: "10px", fontWeight: 700, color: "var(--text-primary)" }}>{status?.global_name || "未配置姓名"}</div>
            <div style={{ marginTop: "4px", color: "var(--text-secondary)", fontSize: "0.86rem" }}>{status?.global_email || "未配置邮箱"}</div>
          </div>
          <div style={{ background: "#fff", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "18px" }}>
            <div style={{ color: "var(--text-muted)", fontSize: "0.76rem", fontWeight: 700 }}>当前仓库 Git 身份</div>
            <div style={{ marginTop: "10px", fontWeight: 700, color: "var(--text-primary)" }}>
              {status?.is_repo ? status.local_name || "使用全局或未配置" : "未在 Git 仓库中"}
            </div>
            <div style={{ marginTop: "4px", color: "var(--text-secondary)", fontSize: "0.86rem" }}>
              {status?.is_repo ? status.local_email || identityText(status.global_name, status.global_email) : "请选择或进入一个 Git 仓库"}
            </div>
          </div>
        </section>

        <section style={{ background: "#fff", border: "1px solid var(--border-color)", borderRadius: "14px", overflow: "hidden" }}>
          <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "1rem" }}>已保存 Profiles</h2>
              <div style={{ marginTop: "4px", fontSize: "0.78rem", color: "var(--text-muted)" }}>配置文件：{status?.config_path || "加载中..."}</div>
            </div>
            <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)", fontWeight: 700 }}>{profiles.length} 个账号</span>
          </div>

          {profiles.length === 0 ? (
            <div style={{ padding: "42px", textAlign: "center", color: "var(--text-secondary)" }}>
              暂无 Profile，请添加账号或使用 GitHub 登录导入。
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {profiles.map(([alias, p]) => {
                const activeGlobal = status?.global_name === p.name && status?.global_email === p.email;
                const activeLocal = status?.local_name === p.name && status?.local_email === p.email;
                return (
                  <div key={alias} style={{ padding: "16px 18px", display: "grid", gridTemplateColumns: "1fr auto", gap: "16px", borderBottom: "1px solid var(--border-color)", alignItems: "center" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <strong style={{ color: "var(--color-primary)", fontSize: "0.98rem" }}>{alias}</strong>
                        {activeGlobal && <span style={{ fontSize: "0.68rem", padding: "2px 7px", borderRadius: "999px", background: "#eef2ff", color: "#4f46e5", fontWeight: 700 }}>全局使用中</span>}
                        {activeLocal && <span style={{ fontSize: "0.68rem", padding: "2px 7px", borderRadius: "999px", background: "#fdf2f8", color: "#db2777", fontWeight: 700 }}>本仓库使用中</span>}
                        {p.github_user && <span style={{ fontSize: "0.68rem", padding: "2px 7px", borderRadius: "999px", background: "#f1f5f9", color: "#334155", fontWeight: 700 }}>GitHub: {p.github_user}</span>}
                      </div>
                      <div style={{ marginTop: "6px", color: "var(--text-primary)", fontWeight: 600 }}>{p.name}</div>
                      <div style={{ marginTop: "2px", color: "var(--text-secondary)", fontSize: "0.84rem" }}>{p.email}</div>
                      {p.signing_key && <div style={{ marginTop: "4px", color: "var(--text-muted)", fontSize: "0.75rem" }}>GPG: {p.signing_key}</div>}
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => onSwitchProfile(alias, true)}>设为全局</button>
                      <button className="btn btn-sm btn-primary" disabled={!status?.is_repo} onClick={() => onSwitchProfile(alias, false)}>应用到仓库</button>
                      <button className="btn btn-sm btn-secondary" onClick={() => onDeleteProfile(alias)}>删除</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
};
