// ==================== CUSTOMER TYPES ====================

export interface Customer {
  id: string;
  tenantId: string;
  customerName: string;
  createdAt: string;
  updatedAt: string;
  status: "active" | "inactive" | "pending";
  environmentsCount: number;
  connectionsCount: number;
}

// ==================== CUSTOMER CARD TYPES ====================

export interface CustomerCardProps {
  customer: Customer;
}

// ==================== CUSTOMER LIST TYPES ====================

export interface CustomerListProps {
  customers: Customer[];
}

export interface CustomerListHandle {
  refreshCustomers: () => Promise<void>;
  isRefreshing: boolean;
}

// ==================== STATUS COLORS ====================

export const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  inactive: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
};

export const statusLabels: Record<string, string> = {
  active: "Activo",
  inactive: "Inactivo",
  pending: "Pendiente",
};
