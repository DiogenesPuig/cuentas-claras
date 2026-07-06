# F2-14 Parser del resumen de Banco Nación (BNA) + banco no reconocido

**Sprint:** Ingesta (Fase 2, extensión) · **Modelo sugerido:** Sonnet (con el texto real anonimizado) · **Depende de:** F2-1, F2-3

## Objetivo
Reconocer el resumen de **Banco Nación (BNA)** que hoy no se parsea: extraer sus movimientos y,
sobre todo, **el banco**, para que el auto-cargado del medio (F2-5) no quede vacío.

## Contexto (causa encontrada)
- Reportado por el usuario (2026-07-06), subiendo un resumen `BNA_Master…` cifrado con contraseña.
- Existe `services/ingesta/app/parsing/nativa_nacion.py` (Nativa Internacional, Banco Nación,
  Mastercard), pero **el formato del resumen de BNA del usuario es otro** y no lo reconoce → no
  extrae el banco → sin banco el front no matchea el medio (`account-match` exige banco conocido para
  el auto-match de tarjeta) y queda "Sin medio".
- El síntoma "el medio quedó con red+últimos4 sin banco" se relaciona con **BUG-14** (el nombre
  congelado del medio), que es un fix aparte del front.

## Bloqueo
- **Necesita el texto real (anonimizado) del resumen.** Hay un helper para extraerlo:
  `samples/resumenes-privados/extract_text.py` (usa el venv de la ingesta; la carpeta está
  gitignoreada). El usuario corre la extracción, anonimiza y pega el texto.

## Pasos
1. Con el texto real anonimizado, ver si el formato BNA se puede sumar a `nativa_nacion.py` o
   necesita un parser propio (`app/parsing/bna.py`) + registro en el dispatcher `app/parsing/statements.py`.
2. Extraer banco (marcas de encabezado), red, titular/adicionales, y las filas de movimientos.
3. Tests en `services/ingesta/tests/` con el texto real **anonimizado** (fixtures sin datos sensibles).
4. Verificar que el front matchea/crea el medio con el banco ya seteado.

## Criterios de aceptación
- [ ] Un resumen de BNA se parsea: banco reconocido + movimientos extraídos.
- [ ] El auto-cargado del medio (F2-5) ya no queda sin banco para BNA.
- [ ] Tests con el caso real anonimizado en `services/ingesta/tests/`.

## Relación
- Se junta bien con **BUG-10** (también ingesta, espera samples reales). Y con **BUG-14** (display del
  banco editado) del lado del front.

## Por qué este modelo
Sonnet: parser acotado sobre texto ya extraído (módulo puro), con tests a partir del formato real.
