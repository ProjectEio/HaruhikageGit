import React from "react";
import { StatusInfo } from "../types";

interface IdentityPanelProps {
  status: StatusInfo | null;
}

export const IdentityPanel: React.FC<IdentityPanelProps> = ({ status }) => {
  return (
    <div className="section-card identity-panel">
      <h3 className="section-title">👤 当前身份</h3>
      <div className="identity-group">
        <div className="identity-subcard global">
          <span className="scope-tag global-tag">全局 Global</span>
          <div className="info">
            {status?.global_name || status?.global_email ? (
              <>
                <div className="user-name">{status.global_name || "(未配置姓名)"}</div>
                <div className="user-email">{status.global_email || "(无邮箱)"}</div>
              </>
            ) : (
              <div className="user-email text-muted">(未配置全局身份)</div>
            )}
          </div>
        </div>

        {status?.is_repo && (
          <div className="identity-subcard local">
            <span className="scope-tag local-tag">本仓库 Local</span>
            <div className="info">
              {status?.local_name || status?.local_email ? (
                <>
                  <div className="user-name">{status.local_name || "(未配置姓名)"}</div>
                  <div className="user-email">{status.local_email || "(无邮箱)"}</div>
                </>
              ) : (
                <div className="user-email text-muted">(未配置本地身份，使用全局)</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
