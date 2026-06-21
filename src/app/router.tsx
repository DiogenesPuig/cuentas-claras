import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { LoginPage, RegisterPage, RequireAuth } from '@/features/auth';
import { RequireWorkspace } from '@/features/workspaces';
import { AppLayout } from './layout/AppLayout';
import { AccountsPage } from './AccountsPage';
import { CategoriesPage } from './CategoriesPage';
import { DashboardPage } from './DashboardPage';
import { GroupPage } from './GroupPage';
import { InviteAcceptPage } from './InviteAcceptPage';
import { ReportsPage } from './ReportsPage';
import { TransactionsPage } from './TransactionsPage';
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
    path: '/invite/:token',
    element: (
      <RequireAuth>
        <InviteAcceptPage />
      </RequireAuth>
    ),
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <RequireWorkspace>
          <AppLayout />
        </RequireWorkspace>
      </RequireAuth>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'categorias', element: <CategoriesPage /> },
      { path: 'medios', element: <AccountsPage /> },
      { path: 'movimientos', element: <TransactionsPage /> },
      { path: 'reportes', element: <ReportsPage /> },
      { path: 'grupo', element: <GroupPage /> },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
