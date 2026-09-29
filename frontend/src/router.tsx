import { createBrowserRouter } from "react-router"
import { RootLayout } from "@/components/root-layout"
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
    ],
  },
])
