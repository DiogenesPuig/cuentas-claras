import { cn } from '@/lib/utils';

function App() {
  return (
    <main
      className={cn(
        'flex min-h-screen flex-col items-center justify-center gap-2 bg-background text-foreground',
      )}
    >
      <h1 className="text-3xl font-bold">Cuentas Claras</h1>
      <p className="text-muted-foreground">Registro de ingresos y gastos.</p>
    </main>
  );
}

export default App;
