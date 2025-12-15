"use client";

import { useState, useEffect } from "react";
import type { Customer } from "../types";

// Datos de ejemplo
const MOCK_CUSTOMERS: Customer[] = [
  {
    id: "1",
    tenantId: "tenant-001",
    customerName: "Acme Corporation",
    createdAt: "2024-01-15T10:30:00Z",
    updatedAt: "2024-12-01T14:20:00Z",
    status: "active",
    environmentsCount: 3,
    connectionsCount: 5,
  },
  {
    id: "2",
    tenantId: "tenant-002",
    customerName: "TechStart Solutions",
    createdAt: "2024-02-20T09:15:00Z",
    updatedAt: "2024-12-10T11:45:00Z",
    status: "active",
    environmentsCount: 2,
    connectionsCount: 3,
  },
  {
    id: "3",
    tenantId: "tenant-003",
    customerName: "Global Industries",
    createdAt: "2024-03-10T16:00:00Z",
    updatedAt: "2024-11-25T09:30:00Z",
    status: "inactive",
    environmentsCount: 1,
    connectionsCount: 2,
  },
  {
    id: "4",
    tenantId: "tenant-004",
    customerName: "Innovation Labs",
    createdAt: "2024-04-05T13:45:00Z",
    updatedAt: "2024-12-12T16:10:00Z",
    status: "active",
    environmentsCount: 4,
    connectionsCount: 7,
  },
  {
    id: "5",
    tenantId: "tenant-005",
    customerName: "Digital Dynamics",
    createdAt: "2024-05-18T11:20:00Z",
    updatedAt: "2024-12-08T10:05:00Z",
    status: "pending",
    environmentsCount: 1,
    connectionsCount: 1,
  },
  {
    id: "6",
    tenantId: "tenant-006",
    customerName: "CloudFirst Systems",
    createdAt: "2024-06-22T08:30:00Z",
    updatedAt: "2024-12-14T15:30:00Z",
    status: "active",
    environmentsCount: 5,
    connectionsCount: 9,
  },
  {
    id: "7",
    tenantId: "tenant-007",
    customerName: "Enterprise Solutions Inc",
    createdAt: "2024-07-08T14:55:00Z",
    updatedAt: "2024-11-30T12:20:00Z",
    status: "active",
    environmentsCount: 3,
    connectionsCount: 4,
  },
  {
    id: "8",
    tenantId: "tenant-008",
    customerName: "StartUp Ventures",
    createdAt: "2024-08-12T10:10:00Z",
    updatedAt: "2024-12-05T08:45:00Z",
    status: "inactive",
    environmentsCount: 1,
    connectionsCount: 1,
  },
  {
    id: "9",
    tenantId: "tenant-009",
    customerName: "MegaCorp International",
    createdAt: "2024-09-01T12:00:00Z",
    updatedAt: "2024-12-13T17:00:00Z",
    status: "active",
    environmentsCount: 6,
    connectionsCount: 12,
  },
  {
    id: "10",
    tenantId: "tenant-010",
    customerName: "SmartTech Partners",
    createdAt: "2024-10-15T09:40:00Z",
    updatedAt: "2024-12-11T14:15:00Z",
    status: "pending",
    environmentsCount: 2,
    connectionsCount: 2,
  },
  {
    id: "11",
    tenantId: "tenant-011",
    customerName: "Future Systems Ltd",
    createdAt: "2024-11-01T15:25:00Z",
    updatedAt: "2024-12-14T11:50:00Z",
    status: "active",
    environmentsCount: 2,
    connectionsCount: 3,
  },
  {
    id: "12",
    tenantId: "tenant-012",
    customerName: "NextGen Technologies",
    createdAt: "2024-11-20T13:15:00Z",
    updatedAt: "2024-12-10T09:25:00Z",
    status: "active",
    environmentsCount: 3,
    connectionsCount: 6,
  },
];

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomers = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Simular llamada a API
      await new Promise((resolve) => setTimeout(resolve, 800));
      
      // En producción, esto sería una llamada real a la API:
      // const response = await fetch('/api/customers');
      // const data = await response.json();
      // setCustomers(data);
      
      setCustomers(MOCK_CUSTOMERS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar clientes");
      console.error("Error fetching customers:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  return {
    customers,
    isLoading,
    error,
    fetchCustomers,
  };
}
