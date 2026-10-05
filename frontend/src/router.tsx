import { createBrowserRouter } from "react-router"
import { AdminLayout } from "@/components/admin/admin-layout"
import { AdminRoute, ProtectedRoute } from "@/components/auth/route-guards"
import { RootLayout } from "@/components/root-layout"
import { AccountPage } from "@/pages/account-page"
import { AdminCatalogPage } from "@/pages/admin/catalog-page"
import { AdminDashboardPage } from "@/pages/admin/dashboard-page"
import { AdminProductsPage } from "@/pages/admin/products-page"
import { HomePage } from "@/pages/home-page"
import { LoginPage } from "@/pages/login-page"
import { RegisterPage } from "@/pages/register-page"

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <RegisterPage /> },

      // Cần đăng nhập
      {
        element: <ProtectedRoute />,
        children: [{ path: "/account", element: <AccountPage /> }],
      },

      // Chỉ ADMIN: guard -> layout admin -> trang con
      {
        path: "/admin",
        element: <AdminRoute />,
        children: [
          {
            element: <AdminLayout />,
            children: [
              { index: true, element: <AdminDashboardPage /> },
              { path: "products", element: <AdminProductsPage /> },
              { path: "catalog", element: <AdminCatalogPage /> },
            ],
          },
        ],
      },
    ],
  },
])
