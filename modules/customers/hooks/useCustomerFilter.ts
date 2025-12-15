"use client";

import { useState, useMemo } from "react";
import type { Customer } from "../types";

type SortOption = "updated" | "name" | "tenant";

export function useCustomerFilter(customers: Customer[]) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("updated");

  const filteredCustomers = useMemo(() => {
    let result = [...customers];

    // Filtrado por búsqueda
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (customer) =>
          customer.customerName.toLowerCase().includes(query) ||
          customer.tenantId.toLowerCase().includes(query)
      );
    }

    // Ordenamiento
    result.sort((a, b) => {
      switch (sortBy) {
        case "updated":
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case "name":
          return a.customerName.localeCompare(b.customerName);
        case "tenant":
          return a.tenantId.localeCompare(b.tenantId);
        default:
          return 0;
      }
    });

    return result;
  }, [customers, searchQuery, sortBy]);

  return {
    filteredCustomers,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
  };
}
