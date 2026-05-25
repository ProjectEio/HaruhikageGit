import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface FilePreviewPanelProps {
  filePath: string;
  onClose: () => void;
}

export const FilePreviewPanel: React.FC<FilePreviewPanelProps> = ({ filePath, onClose }) => {
  const [diff, setDiff] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    setLoading(true);
    invoke<string>("get_file_diff", { path: filePath })
      .then((res) => {
        setDiff(res);
        setLoading(false);
      })
      .catch((err) => {
        setDiff("获取差异失败: " + err);
        setLoading(false);
      });
  }, [filePath]);

  // Diff lines parser
  const renderDiffLines = () => {
    const lines = diff.split("\n");
    return lines.map((line, idx) => {
      let bg = "transparent";
      let color = "var(--text-primary)";
      let borderLeft = "none";
      
      if (line.startsWith("+") && !line.startsWith("+++")) {
        bg = "rgba(16, 185, 129, 0.08)";
        color = "#059669";
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        bg = "rgba(239, 68, 68, 0.06)";
        color = "#dc2626";
      } else if (line.startsWith("@@")) {
        bg = "rgba(236, 72, 153, 0.04)";
        color = "var(--color-primary)";
        borderLeft = "2px solid var(--color-primary)";
      }

      return (
        <div
          key={idx}
          style={{
            background: bg,
            color: color,
            borderLeft: borderLeft,
            padding: "2px 8px",
            fontFamily: "var(--font-mono)",
            fontSize: "0.75rem",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            minHeight: "18px",
            textAlign: "left"
          }}
        >
          {line}
        </div>
      );
    });
  };

  return (
    <div
      className="section-card file-preview-panel"
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        height: "100%",
        maxHeight: "100%",
        overflow: "hidden",
        animation: "modalIn 0.2s ease"
      }}
    >
      <div className="section-header" style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px", maxWidth: "85%", textAlign: "left" }}>
          <span className="section-title" style={{ fontSize: "0.9rem" }}>文件差异预览</span>
          <span className="profile-item-email" style={{ fontSize: "0.65rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={filePath}>
            {filePath}
          </span>
        </div>
        <button
          onClick={onClose}
          title="关闭预览"
          style={{
            border: "none",
            background: "transparent",
            color: "var(--text-secondary)",
            cursor: "pointer",
            fontSize: "1.2rem",
            padding: "4px"
          }}
        >
          ✕
        </button>
      </div>

      <div
        className="preview-body"
        style={{
          flex: 1,
          overflowY: "auto",
          background: "#fafafa",
          border: "1px solid var(--border-color)",
          borderRadius: "var(--radius-sm)",
          padding: "6px 0"
        }}
      >
        {loading ? (
          <div className="loading-spinner">正在拉取差异详情...</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {renderDiffLines()}
          </div>
        )}
      </div>
    </div>
  );
};
