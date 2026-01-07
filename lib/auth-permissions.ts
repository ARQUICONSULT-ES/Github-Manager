import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export async function getUserPermissions() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return {
      isAuthenticated: false,
      isAdmin: false,
      allowedCustomerIds: [],
    };
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      role: true,
      allowedCustomers: {
        select: {
          customerId: true,
        },
      },
    },
  });

  if (!user) {
    return {
      isAuthenticated: false,
      isAdmin: false,
      allowedCustomerIds: [],
    };
  }

  const isAdmin = user.role === "ADMIN";

  return {
    isAuthenticated: true,
    isAdmin,
    userId: user.id,
    allowedCustomerIds: isAdmin 
      ? [] // Admin ve todo, array vacío significa "sin restricciones"
      : user.allowedCustomers.map((ac) => ac.customerId),
  };
}
