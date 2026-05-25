export interface Profile {
  name: string;
  email: string;
  signing_key?: string;
  token?: string;
  github_user?: string;
}

export interface StatusInfo {
  global_name: string | null;
  global_email: string | null;
  local_name: string | null;
  local_email: string | null;
  is_repo: boolean;
  profiles: [string, Profile][];
  config_path: string;
}

export interface GitFileStatus {
  path: string;
  status: string; // "modified", "added", "deleted", "untracked", "staged"
}

export interface CommitInfo {
  hash: string;
  author: string;
  email: string;
  date: string;
  message: string;
  is_remote: boolean;
}

export interface SyncStatus {
  ahead: number;
  behind: number;
  has_upstream: boolean;
}

export interface DeviceCode {
  device_code: string;
  user_code: string;
  verification_uri: string;
  interval: number;
}

export interface ProxySettings {
  auto_detect: boolean;
  url: string | null;
}

export interface Notification {
  id: number;
  message: string;
  type: "success" | "danger" | "info";
}

export interface ManagedRepository {
  name: string;
  path: string;
  organization: string;
  user: string;
  custom_group: string;
}
