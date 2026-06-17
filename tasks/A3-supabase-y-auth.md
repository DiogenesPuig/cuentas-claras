# A3 Cliente Supabase + Autenticación

**Sprint:** A · **Modelo sugerido:** Sonnet · **Depende de:** A2

## Objetivo
Configurar el cliente Supabase tipado y el flujo de auth (email/contraseña + Google), con protección de rutas privadas.

## Contexto
- `PLAN_TECNICO_FASE1.md` §3 (cliente), §7 (auth y rutas).
- `wireframes/wireframes_fase1.html` pantalla 1.
- Requisitos FR-1 (PRD §5.1).

## Archivos a crear/editar
- `src/lib/supabase.ts` (si no se hizo en A2).
- `src/features/auth/` → `AuthProvider`, `useAuth`, `LoginPage`, `RegisterPage`, `OAuthButton`.
- `src/app/router.tsx` → rutas `/login`, `/register` y `<RequireAuth>` para el resto.
- `src/app/providers.tsx` → montar `QueryClientProvider` + `AuthProvider`.

## Pasos
1. Crear el cliente `createClient<Database>(...)` con las env vars.
2. `AuthProvider` que escucha `supabase.auth.onAuthStateChange` y expone `session`/`user`/`signOut`.
3. Páginas de login y registro (email+pass) y botón "Continuar con Google" (OAuth).
4. `<RequireAuth>`: si no hay sesión, redirige a `/login`.
5. Manejo de estados de carga y error de auth.

## Criterios de aceptación
- [ ] Un usuario puede registrarse, cerrar sesión y volver a entrar.
- [ ] Las rutas privadas redirigen a `/login` sin sesión.
- [ ] OAuth de Google configurado (al menos el flujo en el front; las credenciales se cargan en Supabase).
- [ ] `typecheck` y `lint` ok.

## Fuera de alcance
- Creación del perfil y del primer workspace (ticket A4).

## Tests
- Smoke test del formulario de login (validación de campos requeridos).

## Por qué este modelo
Sonnet: flujo estándar de auth con Supabase, sin decisiones de arquitectura nuevas; buen encaje costo/calidad.
