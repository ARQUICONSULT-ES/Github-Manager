"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { CustomerCard } from "./CustomerCard";
import type { CustomerListProps, CustomerListHandle } from "../types";

export const CustomerList = forwardRef<CustomerListHandle, CustomerListProps>(
  function CustomerList({ customers }, ref) {
    const [isRefreshing, setIsRefreshing] = useState(false);

    const refreshCustomers = async () => {
      setIsRefreshing(true);
      try {
        // Simular actualización
        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log("Clientes actualizados");
      } catch (error) {
        console.error("Error al actualizar clientes:", error);
      } finally {
        setIsRefreshing(false);
      }
    };

    useImperativeHandle(ref, () => ({
      refreshCustomers,
      isRefreshing,
    }));

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {customers.map((customer) => (
          <CustomerCard key={customer.id} customer={customer} />
        ))}
      </div>
    );
  }
);
