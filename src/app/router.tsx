import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import App from '@/App';
import { LoginPage, RegisterPage, RequireAuth } from '@/features/auth';
import { RequireWorkspace } from '@/features/workspaces';
import { OnboardingPage } from './OnboardingPage';

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  {
    path: '/onboarding',
    element: (
      <RequireAuth>
        <OnboardingPage />
      </RequireAuth>
    ),
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <RequireWorkspace>
          <App />
        </RequireWorkspace>
      </RequireAuth>
    ),
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
