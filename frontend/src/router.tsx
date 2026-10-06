import { createBrowserRouter } from "react-router"
import { AdminLayout } from "@/components/admin/admin-layout"
import { AdminRoute, ProtectedRoute } from "@/components/auth/route-guards"
import { RootLayout } from "@/components/root-layout"
import { StoreLayout } from "@/components/store/store-layout"
import { AccountPage } from "@/pages/account-page"
import { AdminCatalogPage } from "@/pages/admin/catalog-page"
import { AdminDashboardPage } from "@/pages/admin/dashboard-page"
import { AdminProductEditPage } from "@/pages/admin/product-edit-page"
import { AdminProductNewPage } from "@/pages/admin/product-new-page"
import { AdminProductsPage } from "@/pages/admin/products-page"
import { HomePage } from "@/pages/home-page"
import { LoginPage } from "@/pages/login-page"
import { ProductDetailPage } from "@/pages/product-detail-page"
import { ProductsPage } from "@/pages/products-page"
import { RegisterPage } from "@/pages/register-page"

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <RegisterPage /> },

      // Khu vực khách xem hàng: dùng chung header cửa hàng
      {
        element: <StoreLayout />,
        children: [
          { path: "/products", element: <ProductsPage /> },
          { path: "/products/:id", element: <ProductDetailPage /> },
        ],
      },

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
              { path: "products/new", element: <AdminProductNewPage /> },
              { path: "products/:id", element: <AdminProductEditPage /> },
              { path: "catalog", element: <AdminCatalogPage /> },
            ],
          },
        ],
      },
    ],
  },
])
