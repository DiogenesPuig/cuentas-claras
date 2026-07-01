import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom';

/** Pantalla de error/404 propia. Usada como `errorElement` en el router y como catch-all `*`. */
export function ErrorPage() {
  const error = useRouteError();

  const is404 =
    isRouteErrorResponse(error) && error.status === 404;

  const title = is404 ? 'Página no encontrada' : 'Algo salió mal';
  const description = is404
    ? 'La dirección que ingresaste no existe.'
    : 'Ocurrió un error inesperado. Intentá de nuevo o volvé al inicio.';

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="flex max-w-sm flex-col items-center gap-4 rounded-xl border bg-card p-8 text-center shadow-sm">
        <span className="text-4xl font-bold text-muted-foreground">
          {is404 ? '404' : '¡Ups!'}
        </span>
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
        <Link
          to="/"
          className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
