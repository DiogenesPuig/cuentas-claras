import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import App from '@/App';
import { LoginPage, RegisterPage, RequireAuth } from '@/features/auth';

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <App />
      </RequireAuth>
    ),
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
