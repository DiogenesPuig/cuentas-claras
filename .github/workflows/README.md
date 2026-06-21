# .github/workflows

Workflows de GitHub Actions del proyecto.

- `ci.yml` — CI (D17): en cada PR a `main` y push a `main` corre `npm ci` y luego
  `typecheck`, `lint`, `test` y `build` en Node 22. Falla el check si alguno falla.
