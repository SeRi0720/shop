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
import { CartPage } from "@/pages/cart-page"
import { CheckoutPage } from "@/pages/checkout-page"
import { OrderDetailPage } from "@/pages/order-detail-page"
import { AdminOrdersPage } from "./pages/admin/orders-page"
import { OrdersPage } from "./pages/orders-page"
import { AdminOrderDetailPage } from "./pages/admin/order-detail-page"
import { ChatPage } from "./pages/chat-page"

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <RegisterPage /> },

      // Khu vực khách xem hàng: dùng chung header cửa hàng
      {
        element: <StoreLayout />,
        children: [
          { path: "/", element: <HomePage /> },
          { path: "/products", element: <ProductsPage /> },
          { path: "/products/:id", element: <ProductDetailPage /> },
          {
            element: <ProtectedRoute />,
            children: [
              { path: "/cart", element: <CartPage /> },
              { path: "/checkout", element: <CheckoutPage /> },
              { path: "/orders/:id", element: <OrderDetailPage /> },
              { path: "/orders", element: <OrdersPage /> },
              { path: "/chat", element: <ChatPage /> },
            ],
          },
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
              { path: "orders", element: <AdminOrdersPage /> },
              { path: "orders/:id", element: <AdminOrderDetailPage /> },
            ],
          },
        ],
      },
    ],
  },
])
