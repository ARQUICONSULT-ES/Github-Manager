export interface SyncProgressLog {
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  timestamp: Date;
}

export interface SyncStats {
  total: number;
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}

export interface SyncProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  isSyncing: boolean;
  logs: SyncProgressLog[];
  stats: SyncStats;
}
