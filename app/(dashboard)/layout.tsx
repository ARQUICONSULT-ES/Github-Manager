import Link from "next/link";
import { UserMenu } from "@/components/UserMenu";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-8">
              <Link
                href="/"
                className="flex items-center text-xl font-bold text-gray-900 dark:text-white"
              >
                <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg mr-2">
                  <span className="text-sm font-bold text-white">CEM</span>
                </div>
                <span>Customer Environment Manager</span>
              </Link>
              
              <nav className="hidden md:flex items-center gap-6">
                <Link
                  href="/repos"
                  className="text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                >
                  Repositorios
                </Link>
                <Link
                  href="/customers"
                  className="text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                >
                  Clientes
                </Link>
                <Link
                  href="/environments"
                  className="text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                >
                  Entornos
                </Link>
                <Link
                  href="/applications"
                  className="text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                >
                  Aplicaciones
                </Link>
              </nav>
            </div>

            <div className="flex items-center gap-4">
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
