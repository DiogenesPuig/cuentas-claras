import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import App from '@/App';
import { LoginPage, RegisterPage, RequireAuth } from '@/features/auth';
import { RequireWorkspace } from '@/features/workspaces';
import { AppLayout } from './layout/AppLayout';
import { CategoriesPage } from './CategoriesPage';
import { OnboardingPage } from './OnboardingPage';

/** Placeholder para pantallas cuyo contenido llega en tickets posteriores (B/C). */
function Placeholder({ title, ticket }: { title: string; ticket: string }) {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-muted-foreground">Disponible en el ticket {ticket}.</p>
    </div>
  );
}

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
          <AppLayout />
        </RequireWorkspace>
      </RequireAuth>
    ),
    children: [
      { index: true, element: <App /> },
      { path: 'categorias', element: <CategoriesPage /> },
      { path: 'movimientos', element: <Placeholder title="Movimientos" ticket="B10" /> },
      { path: 'reportes', element: <Placeholder title="Reportes" ticket="C13" /> },
      { path: 'ajustes', element: <Placeholder title="Ajustes" ticket="C15" /> },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
