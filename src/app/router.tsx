import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { LoginPage, RegisterPage, RequireAuth } from '@/features/auth';
import { RequireWorkspace } from '@/features/workspaces';
import { AppLayout } from './layout/AppLayout';
import { AccountsPage } from './pages/AccountsPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { ErrorPage } from './gates/ErrorPage';
import { GroupPage } from './pages/GroupPage';
import { HomeGate } from './gates/HomeGate';
import { InviteAcceptPage } from './pages/InviteAcceptPage';
import { ReportsPage } from './pages/ReportsPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { ProfilePage } from './pages/ProfilePage';

const router = createBrowserRouter([
  {
    errorElement: <ErrorPage />,
    children: [
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
      // Inicio: 1 grupo → Reportes; >1 → landing de grupos. Sin la barra de secciones.
      {
        path: '/',
        element: (
          <RequireAuth>
            <RequireWorkspace>
              <HomeGate />
            </RequireWorkspace>
          </RequireAuth>
        ),
      },
      // Dentro de un grupo: secciones con `AppLayout` (Header + barra de secciones).
      {
        element: (
          <RequireAuth>
            <RequireWorkspace>
              <AppLayout />
            </RequireWorkspace>
          </RequireAuth>
        ),
        children: [
          { path: 'categorias', element: <CategoriesPage /> },
          { path: 'medios', element: <AccountsPage /> },
          { path: 'movimientos', element: <TransactionsPage /> },
          { path: 'reportes', element: <ReportsPage /> },
          { path: 'grupo', element: <GroupPage /> },
          { path: 'perfil', element: <ProfilePage /> },
        ],
      },
      // Catch-all: muestra ErrorPage para cualquier URL sin match.
      { path: '*', element: <ErrorPage /> },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
