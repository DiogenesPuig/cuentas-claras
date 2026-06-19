# PRD — Cuentas Claras (App de Gestión de Gastos e Ingresos Compartidos)

**Nombre:** Cuentas Claras
**Versión del documento:** 1.3 (borrador)
**Fecha:** 2026-06-19
**Autor:** Dioge + equipo (PM / UX / Arquitectura)
**Estado:** En definición — pendiente de validación final antes de implementar

---

## 1. Resumen ejecutivo

Aplicación para que una o varias personas registren sus **ingresos y gastos mensuales** de forma simple. El dato puede entrar de tres maneras: cargando un **monto + motivo**, subiendo un **comprobante de pago**, o subiendo un **resumen de tarjeta**. La app organiza esa información respondiendo siempre a: **quién gastó, qué, con qué medio (tarjeta/efectivo), cuándo y cuánto**, y la presenta en tablas y reportes por persona, por tarjeta y por categoría.

El producto soporta **uso individual** y **uso en grupo** (hogar, pareja, amigos, equipo). Una persona puede pertenecer a uno o varios grupos. Es **multi-moneda** desde el inicio. Una funcionalidad **secundaria/posterior** es calcular "quién le debe a quién".

En una fase posterior se incorpora un **bot de WhatsApp** que lee mensajes de un grupo (con un formato/comando concreto) para registrar gastos automáticamente.

### Decisiones ya tomadas (input del usuario)

| Tema | Decisión |
|------|----------|
| Plataforma MVP | **Web app primero**; WhatsApp en fase posterior |
| Moneda | **Multi-moneda** desde el inicio |
| Estructura de usuarios | Flexible: **individual o grupos**; un usuario puede estar en 1 o varios grupos |
| Tipos de ingesta | Resúmenes de tarjeta, comprobantes de pago, y monto+motivo |
| Foco principal | **Registro de datos** (quién/qué/con qué/cuándo/cuánto) |
| "Quién le debe a quién" | Funcionalidad **secundaria**, no MVP |
| Backend | A definir — opciones con pros/contras en §9 |
| WhatsApp | **Chat 1:1 con el bot** (no leer grupos). Antes de confirmar, el usuario elige a qué workspace va el movimiento. Sirve para texto, comprobantes y resúmenes. |
| Fuente de tipo de cambio | **dolarapi.com** (principal) + **BCRA** (oficial). El usuario elige qué cotización aplicar. |
| Ciclo mensual | **Configurable** por tarjeta (para alinear con la fecha de cierre). |
| Bancos para parseo (Fase 2) | **Banco Nación** y **Banco Patagonia** (Visa/Mastercard). |
| Alta de tarjeta desde el resumen (Fase 2) | Al parsear un resumen, si la tarjeta/medio detectado **no existe**, la app **lo detecta y ofrece crearlo** en la misma pantalla de revisión. Muchos usuarios subirán solo el resumen sin cargar medios a mano (ver **FR-16b**). |
| Modelo de negocio | **Free** ahora; freemium a futuro (más workspaces + sin publicidad). |

---

## 2. Objetivos y métricas de éxito

### Objetivos de producto
- Que registrar un gasto tome **menos de 10 segundos** en el caso simple (monto + motivo).
- Centralizar gastos de **múltiples personas y tarjetas** en una vista clara.
- Dar visibilidad mensual: cuánto se gastó, en qué, con qué tarjeta y quién.
- Soportar múltiples monedas sin fricción.

### Métricas de éxito (KPIs)
- **Activación:** % de usuarios que registran ≥3 gastos en su primera semana.
- **Retención:** % de usuarios activos mes a mes (MAU).
- **Tiempo de carga de un gasto** (mediana) < 10 s manual.
- **Tasa de adopción del grupo:** % de grupos con ≥2 miembros activos.
- (Fase OCR) **Precisión de extracción** de monto/fecha/comercio ≥ 90%.

### No-objetivos (fuera de alcance, al menos por ahora)
- No es un home-banking ni se conecta a APIs bancarias para traer movimientos automáticamente.
- No es una herramienta contable/fiscal (no emite facturas ni declara impuestos).
- No ejecuta pagos ni transferencias.
- No es una app de inversión.

---

## 3. Usuarios y roles

### Perfiles (personas)
- **Persona individual:** quiere ordenar sus propios gastos e ingresos del mes.
- **Pareja / hogar:** comparten gastos y quieren ver el total y el desglose por persona.
- **Grupo de amigos / viaje:** gastos compartidos puntuales, eventualmente "quién debe a quién".
- **Administrador del grupo:** crea el espacio, invita gente, configura tarjetas y categorías.

### Roles dentro de un grupo (workspace)
| Rol | Permisos |
|-----|----------|
| **Owner** | Todo: gestionar miembros, eliminar el grupo, editar cualquier dato. |
| **Admin** | Gestionar miembros, tarjetas, categorías; editar/borrar movimientos. |
| **Member** | Cargar y editar sus propios movimientos; ver los del grupo. |
| **Viewer** (opcional) | Solo lectura de reportes. |

> Nota: el "uso individual" es simplemente un grupo de un solo miembro (owner). Esto simplifica el modelo: **todo es un workspace**, con 1 o N miembros.

---

## 4. Conceptos del dominio (glosario)

- **Workspace (Espacio/Grupo):** contenedor de datos compartido. Un usuario puede pertenecer a varios.
- **Member (Miembro):** vínculo entre un usuario y un workspace, con un rol.
- **Account / Tarjeta / Medio de pago:** tarjeta de crédito/débito, efectivo, cuenta bancaria o billetera. Tiene dueño (un miembro), banco, moneda y tipo.
- **Titular / Extensión:** **cada tarjeta es su propio medio**, incluidas las extensiones. Una extensión (ej. la de Pepito sobre la tarjeta de Juan) se carga como una cuenta más, marcada como extensión y, opcionalmente, apuntando a su tarjeta titular. Cada medio tiene un **holder** (quién la usa: un miembro de la app o solo un nombre), un **banco** y una **red** (Visa/Mastercard/…). La persona de un movimiento **se deduce del medio**, no se elige en cada alta. La distinción titular/extensión importa sobre todo al **importar resúmenes** (Fase 2).
- **Transaction (Movimiento):** un ingreso o un gasto. Es la entidad central.
- **Category (Categoría):** clasificación del gasto/ingreso (Supermercado, Alquiler, Sueldo, etc.).
- **Attachment (Adjunto):** archivo subido (comprobante o resumen) asociado a uno o varios movimientos.
- **Statement Import (Importación de resumen):** proceso de subir un resumen de tarjeta del que se extraen varios movimientos.
- **Settlement (Saldo) [fase posterior]:** cálculo de deudas entre miembros por gastos compartidos.

---

## 5. Requisitos funcionales (FR)

### 5.1 Cuentas y autenticación
- **FR-1** Registro e inicio de sesión (email + contraseña, y/o OAuth Google).
- **FR-2** Un usuario puede crear workspaces y ser invitado a otros.
- **FR-3** Invitar miembros por email o link de invitación; asignar rol.
- **FR-4** Cambiar de workspace activo desde la UI.

### 5.2 Tarjetas / medios de pago
- **FR-5** Crear, editar y archivar tarjetas/medios con: nombre, banco, tipo (crédito/débito/efectivo/billetera/cuenta), moneda, últimos 4 dígitos (opcional), dueño (miembro).
- **FR-6** Ver el total gastado por tarjeta en un período.
- **FR-6b** **Ciclo de facturación configurable** por tarjeta (día de cierre). El "mes" de los reportes puede seguir el calendario o el ciclo de cierre de cada tarjeta, según configuración.
- **FR-6c** Cada medio (incluida cada **extensión**) se crea como una tarjeta/cuenta propia, con su **banco**, **red** (Visa/Mastercard/…), **holder** (miembro o nombre suelto) y, si es extensión, un enlace opcional a su tarjeta **titular**.
- **FR-6d** En la lista de tarjetas/medios, las extensiones aparecen como filas propias (no anidadas), indicando que son extensión y de qué banco.

### 5.3 Registro de movimientos (núcleo)
- **FR-7** Crear un movimiento manual con: tipo (ingreso/gasto), monto, moneda, fecha, descripción/motivo, categoría, tarjeta/medio, miembro que gastó (paid_by).
- **FR-8** Editar y eliminar movimientos (según permisos).
- **FR-9** Soporte multi-moneda: cada movimiento guarda **monto y moneda original**; opcionalmente monto convertido a la **moneda base del workspace** usando un tipo de cambio (manual o automático vía API).
- **FR-9b** En reportes, mostrar totales **por moneda** y un **total consolidado** en la moneda base: `Total base = Σ(montos en base) + Σ(montos en otra moneda × tipo de cambio)`. El usuario elige qué cotización usar (oficial / blue / MEP, según fuente).
- **FR-10** Adjuntar un archivo (comprobante) a un movimiento.
- **FR-11** Filtrar/buscar movimientos por mes, persona, tarjeta, categoría, moneda y texto.
- **FR-12** Marcar movimiento como compartido y asignar participantes (base para "quién debe a quién").

### 5.4 Ingesta de archivos
- **FR-13** Subir un **comprobante** (imagen/PDF) y guardarlo asociado a un movimiento.
- **FR-14 (Fase 2 — OCR):** al subir un comprobante, extraer automáticamente monto, fecha y comercio y precargar el formulario para que el usuario confirme.
- **FR-15** Subir un **resumen de tarjeta** (PDF) como adjunto.
- **FR-16 (Fase 2/3 — Parseo):** extraer los movimientos del resumen y crear movimientos en bloque, con revisión/confirmación del usuario (pantalla de "staging" antes de guardar).
- **FR-16b (Fase 2 — Alta de medio desde el resumen):** al parsear un resumen, identificar la **tarjeta/medio** al que pertenece (banco, red, últimos 4 dígitos, titular). Si **coincide** con un medio existente (FR-5/FR-6c), asociar los movimientos a ese medio; si **no existe**, **ofrecer crearlo** desde la misma pantalla de staging precargando los datos detectados, para que el usuario confirme/ajuste y siga sin tener que cargarlo a mano por separado. _Motivación: es probable que muchos usuarios usen la app solo subiendo el resumen y no den de alta sus medios manualmente._
- **FR-17** Detección de duplicados al importar (mismo monto+fecha+comercio).

### 5.5 Categorización
- **FR-18** Categorías por defecto + categorías propias del workspace.
- **FR-19 (Fase 2):** sugerencia automática de categoría según descripción/comercio.

### 5.6 Reportes y visualización
- **FR-20** Tabla de movimientos del mes con totales.
- **FR-21** Resumen mensual: total ingresos, total gastos, balance, por moneda.
- **FR-22** Desglose por **categoría**, **tarjeta/medio**, **persona**, **banco** y **red** (Visa/Mastercard), además del total. Al ver por persona (ej. Pepito), se listan sus extensiones y las tarjetas titulares de las que cuelgan.
- **FR-23** Exportar a CSV/Excel.
- **FR-24** Comparativa mes a mes.

### 5.7 "Quién le debe a quién" (secundario / fase posterior)
- **FR-25** Para gastos compartidos, calcular el balance neto entre miembros.
- **FR-26** Sugerir el conjunto mínimo de pagos para saldar.
- **FR-27** Registrar pagos/saldos entre miembros.

### 5.8 Bot de WhatsApp (fase posterior)

> **Modelo confirmado:** chat **1:1** entre cada usuario y el número del bot (no se leen grupos de WhatsApp). Cada usuario vincula su número a su cuenta; al registrar un movimiento, **antes de confirmar elige a qué workspace** lo agrega (resuelve el caso de pertenecer a varios grupos).

- **FR-28** Vincular el número de teléfono de un usuario a su cuenta (verificación por código).
- **FR-29** Detectar gastos por mensajes con un **prefijo/comando** (ej: `gasto 5000 super visa` o `/g 5000 super`).
- **FR-30** Enviar una **foto de comprobante** por WhatsApp → OCR → crear movimiento (con confirmación).
- **FR-30b** Enviar un **PDF de resumen de tarjeta** por WhatsApp → parseo → lista de movimientos detectados que el usuario confirma desde el chat o desde un link a la web.
- **FR-31** Antes de guardar, el bot pregunta **a qué workspace** va el movimiento (si el usuario pertenece a más de uno) y pide confirmación.
- **FR-32** Confirmación/feedback del bot ("✅ Registrado: $5000 Super, Visa de Dioge en *Hogar*").
- **FR-33** **Notificación a los miembros del workspace** cuando se agrega un movimiento/balance: como la Cloud API no envía a grupos de WhatsApp, la notificación se envía **1:1 a cada miembro** (y/o por email según preferencia). Configurable por usuario.

### 5.9 Notificaciones
- **FR-34** Canal **principal: WhatsApp**; canal **alternativo: email**. Configurable por usuario.
- **FR-35** **Eventos que notifican (por defecto):**
  - **Ingreso de dinero** (cualquier movimiento de tipo `income`: sueldo, transferencia recibida, etc.).
  - **Cierre de tarjeta / fin de ciclo.**
- **FR-36** **No** notificar gastos individuales chicos del día a día (evitar ruido). El usuario puede activar otros eventos si quiere.
- **FR-37** En el **cierre de tarjeta/ciclo**, la notificación incluye un **resumen del total gastado en ese período**, abarcando **todos los medios** (tarjetas, transferencias, efectivo, etc.), no solo la tarjeta que cierra. Es un "consolidado de cierre".
- **FR-38** Las notificaciones proactivas por WhatsApp usan **plantillas aprobadas** por Meta (ver §12).

---

## 6. Requisitos no funcionales (NFR)

- **NFR-1 Usabilidad:** flujo de carga manual en ≤3 toques/campos esenciales; UI en español; responsive (mobile-first).
- **NFR-2 Rendimiento:** vistas principales cargan en < 1.5 s con datos de un mes; carga de movimiento responde en < 500 ms.
- **NFR-3 Seguridad:** contraseñas hasheadas (bcrypt/argon2), datos cifrados en tránsito (HTTPS) y en reposo; aislamiento estricto entre workspaces (un usuario solo ve datos de sus workspaces).
- **NFR-4 Privacidad:** datos financieros sensibles; cumplir buenas prácticas (minimización de datos, borrado de cuenta/datos a pedido).
- **NFR-5 Escalabilidad:** arquitectura que soporte crecer de 1 a miles de workspaces sin rediseño mayor.
- **NFR-6 Disponibilidad:** objetivo 99.5% para el MVP.
- **NFR-7 Mantenibilidad:** código tipado (TypeScript), Clean Code, tests en lógica de negocio (cálculos de totales/conversión/saldos).
- **NFR-8 Observabilidad:** logging de errores y métricas básicas.
- **NFR-9 Internacionalización:** formato de moneda/fecha por locale; base preparada para i18n.
- **NFR-10 Accesibilidad:** contraste y navegación por teclado (WCAG AA como meta).

---

## 7. Casos de uso

**UC-1 — Registrar gasto rápido (manual)**
Actor: Miembro. Precondición: logueado, workspace activo.
1. Toca "+ Gasto". 2. Ingresa monto, motivo, elige tarjeta y categoría (fecha = hoy por defecto). 3. Guarda.
Resultado: movimiento creado y visible en la tabla del mes.

**UC-2 — Subir comprobante**
Actor: Miembro.
1. Toca "Subir comprobante". 2. Selecciona foto/PDF. 3. (Fase 2) la app extrae datos y precarga el formulario. 4. Confirma/corrige. 5. Guarda.
Resultado: movimiento + adjunto.

**UC-3 — Importar resumen de tarjeta**
Actor: Admin/Member.
1. Sube el PDF del resumen. 2. (Fase 2/3) la app lista los movimientos detectados en una pantalla de revisión. 3. La app identifica la tarjeta/medio del resumen; si no existe, **ofrece crearlo** con los datos detectados (FR-16b). 4. El usuario descarta/ajusta/categoriza. 5. Confirma importación.
Resultado: N movimientos creados, con detección de duplicados.

**UC-4 — Ver reporte mensual**
Actor: Cualquier rol.
1. Abre "Reportes". 2. Elige mes y filtros. 3. Ve totales, gráficos por categoría/tarjeta/persona y balance por moneda.

**UC-5 — Gestionar grupo**
Actor: Owner/Admin.
1. Crea workspace. 2. Invita miembros. 3. Configura tarjetas y categorías.

**UC-6 — Registrar gasto desde WhatsApp (fase posterior)**
Actor: Miembro en el grupo de WhatsApp.
1. Escribe `gasto 5000 super visa`. 2. El bot parsea y crea el movimiento. 3. El bot confirma.

**UC-7 — Saldar cuentas (fase posterior)**
Actor: Miembro.
1. Abre "Saldos". 2. Ve quién debe a quién. 3. Registra un pago. 4. Los balances se actualizan.

---

## 8. Historias de usuario (con criterios de aceptación)

**US-1** — *Como usuario quiero registrar un gasto con solo monto y motivo para anotarlo en segundos.*
- Dado que estoy logueado, cuando ingreso monto y motivo y guardo, entonces el gasto aparece en la lista del mes con fecha de hoy y moneda por defecto.

**US-2** — *Como usuario quiero elegir con qué tarjeta pagué para saber cuánto gasté con cada una.*
- El selector de tarjeta muestra las tarjetas del workspace; el reporte por tarjeta refleja el movimiento.

**US-3** — *Como usuario multi-moneda quiero registrar gastos en distintas monedas y verlos consolidados.*
- Puedo elegir la moneda del movimiento; el resumen muestra totales por moneda y un total consolidado en la moneda base (con tipo de cambio).

**US-4** — *Como miembro de un grupo quiero ver quién gastó qué para tener transparencia.*
- La tabla muestra el campo "miembro" y puedo filtrar por persona.

**US-5** — *Como usuario quiero subir el resumen de mi tarjeta para no cargar todo a mano.* (Fase 2/3)
- Al subir el PDF, veo una lista editable de movimientos detectados antes de confirmar; los duplicados se marcan.

**US-6** — *Como usuario quiero exportar mis datos para usarlos en Excel.*
- Puedo descargar CSV/XLSX del período filtrado.

**US-7** — *Como admin quiero invitar gente a mi grupo para compartir el registro.*
- Genero un link/invitación por email; al aceptar, el usuario entra con rol Member.

**US-8** — *Como usuario de WhatsApp quiero anotar un gasto sin abrir la app.* (Fase posterior)
- Enviando un mensaje con el formato definido, el bot crea el movimiento y confirma.

---

## 9. Arquitectura

### 9.1 Visión general

```
┌──────────────┐      HTTPS/REST       ┌──────────────────┐
│  Web App     │  ───────────────────► │   API Backend    │
│ React + TS   │  ◄─────────────────── │  (Auth, lógica)  │
│ (SPA, PWA)   │                        └────────┬─────────┘
└──────────────┘                                 │
                                                  ▼
                          ┌───────────────────────────────────────┐
                          │ Base de datos (PostgreSQL)             │
                          │ Storage de archivos (comprobantes/PDF) │
                          └───────────────────────────────────────┘
                                                  ▲
        (Fase posterior)                          │
┌──────────────┐   Webhook    ┌───────────────────┴─────┐
│  WhatsApp     │ ──────────► │  Servicio de ingesta     │
│  Cloud API    │ ◄────────── │  (parser comandos + OCR  │
│  (chat 1:1)   │  notif 1:1  │   + parseo de resúmenes) │
└──────────────┘              └──────────────────────────┘

        ┌─────────────────────────────────────────┐
        │ API de tipo de cambio (dolarapi / BCRA)  │ ◄── consulta FX
        └─────────────────────────────────────────┘
```

Principios: separar **frontend (React + TS)** de un **API backend**; la base de datos en **PostgreSQL** (relacional, ideal para datos financieros y reportes); un **storage de objetos** para archivos; servicios de OCR/parseo desacoplados para sumarlos por fases.

### 9.2 Opciones de backend (pros y contras)

#### Opción A — BaaS gestionado (Supabase) ⭐ recomendado para el MVP
Postgres + Auth + Storage + APIs autogeneradas + Row Level Security, todo gestionado.

**Pros**
- Velocidad de desarrollo altísima: auth, base de datos, storage y permisos listos.
- **Row Level Security** encaja perfecto con el aislamiento por workspace (NFR-3).
- Postgres real por debajo: si más adelante querés tu propio backend, migrás los datos sin dolor.
- Tier gratuito generoso para validar la idea.

**Contras**
- Lógica compleja (parseo de resúmenes, OCR, saldos) conviene moverla a *edge functions* o un servicio aparte.
- Cierto acoplamiento al proveedor (mitigable porque es Postgres estándar).

#### Opción B — Backend propio Node + TypeScript (NestJS/Express) + PostgreSQL
**Pros**
- Mismo lenguaje (TS) en todo el stack → menos cambio de contexto, tipos compartidos.
- Control total de la lógica de negocio, ideal para saldos, importaciones y reglas.
- NestJS aporta estructura, modularidad y testabilidad (encaja con Clean Code).

**Contras**
- Hay que construir auth, permisos, migraciones y deploy desde cero → más tiempo al MVP.
- Más superficie de mantenimiento/infra propia.

#### Opción C — Backend Python (FastAPI/Django) + PostgreSQL
**Pros**
- Ecosistema fuerte para **OCR/IA y parseo de PDFs** (pdfplumber, pytesseract, pandas).
- FastAPI es rápido y tipado; Django trae admin y baterías incluidas.

**Contras**
- Dos lenguajes en el stack (TS en front, Python en back) → más fricción para un equipo chico.
- Si el corazón del MVP es CRUD + reportes (no IA pesada todavía), el plus de Python no se aprovecha aún.

#### Recomendación
**Empezar con Opción A (Supabase)** para llegar rápido a un MVP usable y con seguridad por workspace resuelta. **Extraer la ingesta pesada** (OCR de comprobantes y parseo de resúmenes) a un **microservicio Python (Opción C)** cuando se aborde la Fase 2, ya que ahí Python brilla. Si el producto crece y necesita lógica de negocio muy custom, migrar el core a un **backend Node/NestJS (Opción B)** es directo porque la base ya es Postgres.

> Resumen: **A para arrancar → +C para ingesta IA → eventualmente B para el core.** Esto evita sobre-ingeniería hoy sin cerrar puertas mañana.

### 9.3 Stack frontend
- React + TypeScript, Vite.
- Routing: React Router. Estado servidor/caché: TanStack Query. Estado UI: Zustand o Context (evitar Redux salvo necesidad).
- UI: Tailwind + componentes accesibles (shadcn/ui) — rápido y consistente.
- Gráficos: Recharts.
- PWA (instalable, base para mobile sin app nativa aún).

### 9.4 Conversión de moneda (multi-moneda)
- **Fuente principal:** [dolarapi.com](https://dolarapi.com/docs/) — gratuita, sin API key, expone oficial, blue, MEP, CCL, mayorista. Permite que el usuario elija qué cotización aplicar (relevante en Argentina por la brecha cambiaria).
- **Fuente de referencia oficial:** [API de Estadísticas Cambiarias del BCRA](https://estadisticas-cambiarias.bcra.apidocs.ar/) — cotización oficial por fecha e histórico.
- **Estrategia:** un *job* diario cachea las cotizaciones históricas. Al consolidar, se usa la cotización **a la fecha en que el movimiento se cobra/imputa** (no necesariamente la fecha de compra). Para compras con tarjeta en moneda extranjera, esa fecha es la del **cierre/imputación de la tarjeta**; para el resto, la fecha del movimiento. Si la API falla o falta el dato histórico, se permite **rate manual** (FR-9).
- **Campo de fecha de cobro:** el movimiento guarda `charged_on` (fecha de cobro/imputación) además de `occurred_on` (fecha en que ocurrió); el FX se aplica sobre `charged_on`.
- **Guardado:** el movimiento siempre conserva monto y moneda original; el consolidado es un cálculo, nunca pisa el dato original.

---

## 10. Modelo de datos (PostgreSQL)

> Convención: `id` UUID, timestamps `created_at`/`updated_at`. Multi-moneda: el movimiento guarda monto y moneda **original** + opcional monto convertido a moneda base.

```
users
  id, email (unique), password_hash (o auth provider), name, avatar_url,
  phone_number (nullable, único, verificado — para WhatsApp),
  notify_prefs (jsonb: email|push|whatsapp por tipo de evento),
  created_at

workspaces
  id, name, base_currency (ej "ARS"), owner_id → users, created_at

workspace_members
  id, workspace_id → workspaces, user_id → users,
  role (owner|admin|member|viewer), joined_at
  UNIQUE(workspace_id, user_id)

accounts            -- tarjetas / medios de pago (cada extensión = una cuenta propia)
  id, workspace_id → workspaces,
  name, bank,
  network (visa|mastercard|amex|cabal|other, nullable),
  type (credit|debit|cash|wallet|bank_account),
  currency, last4 (nullable),
  owner_member_id → workspace_members (nullable),  -- holder si usa la app
  holder_name,                                     -- nombre del que la usa (ej. "Pepito")
  is_extension (bool),                             -- true = extensión
  parent_account_id → accounts (nullable),         -- titular del que cuelga la extensión
  billing_close_day (nullable, 1-31 — día de cierre para el ciclo configurable),
  is_archived, created_at

categories
  id, workspace_id → workspaces (null = global/default),
  name, kind (expense|income), icon, color, parent_id (nullable)

transactions        -- INGRESOS y GASTOS (entidad central)
  id, workspace_id → workspaces,
  type (income|expense),
  amount (numeric), currency,                 -- monto y moneda ORIGINAL
  amount_base (numeric, nullable),            -- convertido a base_currency
  fx_rate (numeric, nullable), fx_date,       -- tipo de cambio aplicado
  occurred_on (date),                         -- cuándo ocurrió la compra/movimiento
  charged_on (date, nullable),                 -- cuándo se cobra/imputa (base del FX y del ciclo)
  description,
  category_id → categories (nullable),
  account_id → accounts (nullable),           -- medio usado; la persona se deduce de su holder
  created_by_user_id → users,
  source (manual|whatsapp|ocr|statement_import),
  is_shared (bool),                           -- para "quién debe a quién"
  attachment_id → attachments (nullable),
  statement_import_id → statement_imports (nullable),
  external_hash (nullable),                   -- para detección de duplicados
  created_at, updated_at

transaction_splits  -- (fase posterior) reparto de un gasto compartido
  id, transaction_id → transactions,
  member_id → workspace_members,
  share_amount (numeric)                      -- cuánto le toca a cada uno

attachments
  id, workspace_id, uploaded_by_user_id → users,
  file_url, file_type (image|pdf), kind (receipt|statement),
  status (uploaded|processed|failed), created_at

statement_imports   -- importación de un resumen de tarjeta
  id, workspace_id, account_id → accounts, attachment_id → attachments,
  status (pending|reviewing|confirmed|failed),
  detected_count, imported_count, created_at

settlements         -- (fase posterior) pagos entre miembros para saldar
  id, workspace_id, from_member_id, to_member_id,
  amount, currency, settled_on, note
```

**Notas de diseño**
- "Uso individual" = workspace con un solo `workspace_member` (rol owner). Un único modelo para todos los casos.
- **Privacidad de teléfono:** el `phone_number` vive en `users` y **nunca se expone a otros miembros**. En el workspace, cada persona se identifica solo por **nombre** (y avatar). El número se usa internamente para WhatsApp.
- **Extensiones de tarjeta:** cada extensión es una cuenta propia (`is_extension = true`, con `parent_account_id` apuntando a la titular). La **persona** del movimiento se deduce del `account` usado (su `owner_member_id` o, si no usa la app, su `holder_name`). El reporte "por persona" agrupa por ese holder. Así un gasto en la extensión de Pepito se imputa a Pepito, aunque la titular sea de Juan.
- Multi-moneda: se reporta por moneda y, si hay `fx_rate`, también un consolidado en `base_currency`.
- `external_hash` (monto+fecha+comercio) habilita detección de duplicados al importar.
- Aislamiento: toda query filtra por `workspace_id` (con Supabase, vía Row Level Security).

---

## 11. Diseño de API (REST)

Base: `/api/v1`. Auth con JWT (Bearer). Todas las rutas de datos validan pertenencia al workspace.

```
# Auth
POST   /auth/register
POST   /auth/login
POST   /auth/logout
GET    /auth/me

# Workspaces
GET    /workspaces                      # mis workspaces
POST   /workspaces
GET    /workspaces/:id
PATCH  /workspaces/:id
DELETE /workspaces/:id
POST   /workspaces/:id/invitations      # invitar miembro
POST   /invitations/:token/accept

# Miembros
GET    /workspaces/:id/members
PATCH  /workspaces/:id/members/:memberId   # cambiar rol
DELETE /workspaces/:id/members/:memberId

# Tarjetas / medios
GET    /workspaces/:id/accounts
POST   /workspaces/:id/accounts
PATCH  /accounts/:accountId
DELETE /accounts/:accountId             # archivar

# Categorías
GET    /workspaces/:id/categories
POST   /workspaces/:id/categories
PATCH  /categories/:categoryId

# Movimientos
GET    /workspaces/:id/transactions     # filtros: ?month=&member=&account=&category=&currency=&q=
POST   /workspaces/:id/transactions
GET    /transactions/:txId
PATCH  /transactions/:txId
DELETE /transactions/:txId

# Adjuntos e importaciones
POST   /workspaces/:id/attachments      # subir comprobante/resumen (multipart)
POST   /workspaces/:id/attachments/:attId/ocr        # (fase 2) procesar comprobante
POST   /workspaces/:id/statement-imports             # crear importación desde un resumen
GET    /statement-imports/:importId                  # ver movimientos detectados
POST   /statement-imports/:importId/confirm          # confirmar e insertar

# Reportes
GET    /workspaces/:id/reports/summary?month=         # totales, balance, por moneda
GET    /workspaces/:id/reports/by-category?month=
GET    /workspaces/:id/reports/by-account?month=
GET    /workspaces/:id/reports/by-member?month=
GET    /workspaces/:id/export?month=&format=csv|xlsx

# Saldos (fase posterior)
GET    /workspaces/:id/balances
POST   /workspaces/:id/settlements

# WhatsApp (fase posterior)
POST   /webhooks/whatsapp               # recibe mensajes del Cloud API
```

---

## 12. Bot de WhatsApp (consideraciones, fase posterior)

- **API oficial:** WhatsApp **Cloud API** (Meta). Evitar librerías no oficiales (riesgo de baneo del número y violación de términos).
- **Modelo elegido — chat 1:1 (no grupos):** cada usuario conversa directamente con el número del bot. Esto **esquiva las restricciones de lectura de grupos** de la Cloud API, que era el principal riesgo técnico. Decisión validada con el usuario.
- **Vinculación de identidad:** el usuario registra su número desde la web; se verifica con un código. El `phone_number` se mapea a un `user` (que puede pertenecer a varios workspaces).
- **Selección de workspace:** si el usuario está en más de un workspace, el bot pregunta a cuál agregar el movimiento antes de confirmar (botones de respuesta rápida de WhatsApp).
- **Formas de captura:**
  - Texto con comando: `gasto <monto> <motivo> [tarjeta]` → `gasto 5000 super visa`, o `/g 5000 super`, o `+5000 super`.
  - **Foto de comprobante:** imagen → OCR → confirmación.
  - **PDF de resumen:** documento → parseo → lista de movimientos detectados → confirmación.
- **Confirmación:** el bot responde con un resumen y un link para editar/ver en la web.
- **Notificaciones de balance al "grupo":** ⚠️ la Cloud API **no envía mensajes a grupos de WhatsApp**, solo conversaciones 1:1. Por eso, "avisar al grupo" se implementa **notificando 1:1 a cada miembro** del workspace (mensaje individual del bot a cada número vinculado). Para los miembros sin WhatsApp vinculado, se usa email/push. Es funcionalmente equivalente al objetivo del usuario, solo cambia el mecanismo.
- **Plantillas de mensajes:** Meta exige *message templates* preaprobadas para iniciar conversaciones fuera de la ventana de 24 h; las notificaciones proactivas (ej: "se agregó un gasto al grupo") deben usar plantillas aprobadas.
- **Privacidad:** al ser 1:1, el bot solo procesa lo que el usuario le envía directamente; no lee conversaciones ajenas.
- **Spike previo:** antes de comprometer la fase, validar plantillas, verificación de número y límites de la Cloud API en una prueba acotada.

---

## 13. UX / Flujos principales

- **Onboarding:** registro → crear primer workspace (o aceptar invitación) → elegir moneda base → tutorial corto.
- **Home / Dashboard:** selector de mes, totales (ingresos/gastos/balance) por moneda, botón flotante "+", lista de últimos movimientos.
- **Alta rápida de gasto:** modal con monto (foco automático), motivo, tarjeta, categoría; fecha = hoy por defecto. Mobile-first.
- **Subida de archivos:** zona de drag&drop; para resúmenes, pantalla de revisión tipo "staging".
- **Reportes:** filtros + gráficos (torta por categoría, barras por tarjeta/persona, línea mes a mes).
- **Gestión de grupo:** miembros, tarjetas, categorías.
- **Principios UX:** mobile-first, mínima fricción en la carga, español claro, formato de moneda por locale, estados vacíos guiados.

---

## 14. Roadmap por fases

### Fase 0 — Setup (semana 1)
Repo, CI básico, esquema de base de datos, auth, estructura de proyecto (React+TS), elección de backend (Supabase).
**Incluir keep-alive de Supabase:** dado el uso esporádico, prever un cron (GitHub Actions) que toque la DB cada ~3 días para evitar la pausa por inactividad del plan Free (ver §15). Idealmente reutilizar el *job* diario de tipo de cambio (§9.4), que ya escribe en la DB a diario y mantiene el proyecto activo por sí solo.

### Fase 1 — MVP (semanas 2–6) — *núcleo de registro*
- Workspaces, miembros e invitaciones.
- Tarjetas/medios y categorías.
- Alta/edición/borrado manual de movimientos (multi-moneda).
- Adjuntar comprobante (sin OCR todavía — solo guardar archivo).
- Tabla mensual + filtros.
- Reporte mensual + gráficos por categoría/tarjeta/persona.
- Export CSV/XLSX.
- **Criterio de salida:** un grupo puede registrar y visualizar gastos/ingresos del mes en varias monedas.

### Fase 2 — Ingesta inteligente (semanas 7–11)
- Microservicio Python para OCR de comprobantes (precarga del formulario).
- Sugerencia automática de categoría.
- Parseo de resúmenes de tarjeta empezando por **Banco Nación** y **Banco Patagonia** (Visa/Mastercard), con pantalla de revisión y detección de duplicados.
- Conversión multi-moneda con API de tipo de cambio (dolarapi/BCRA) + opción de rate manual.

### Fase 3 — Colaboración avanzada (semanas 12–15)
- Gastos compartidos + "quién le debe a quién" (balances y settlements).
- Roles/permisos finos, notificaciones.

### Fase 4 — Bot de WhatsApp (semanas 16–19)
- Spike de viabilidad con Cloud API (plantillas, verificación de número, límites).
- Vinculación y verificación del número del usuario.
- Captura por comando de texto + selección de workspace + confirmación.
- Comprobantes por foto y **resúmenes en PDF** vía WhatsApp (reutiliza el motor de Fase 2).
- Notificaciones 1:1 a los miembros del workspace (con plantillas aprobadas).

> Las semanas son estimaciones para dimensionar; se ajustan según dedicación real.

---

## 15. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|--------|---------|-----------|
| Parseo de resúmenes varía mucho por banco | Alto | Empezar con pocos bancos; pantalla de revisión humana; no prometer 100% automático |
| Restricciones de WhatsApp Cloud API en grupos | Mitigado | **Resuelto por diseño:** chat 1:1 con el bot (no se leen grupos). Notificaciones 1:1 a miembros con plantillas aprobadas |
| Plantillas de mensajes proactivos (Meta) requieren aprobación | Medio | Definir y enviar plantillas a aprobación temprano; usar la ventana de 24 h cuando aplique |
| Brecha cambiaria / qué cotización usar | Medio | Dejar que el workspace elija la cotización; guardar siempre monto original |
| Precisión de OCR | Medio | Siempre confirmación del usuario antes de guardar |
| Multi-moneda y tipos de cambio | Medio | Guardar monto original siempre; conversión opcional con fuente clara de FX |
| Privacidad de datos financieros | Alto | Cifrado, RLS por workspace, borrado de datos a pedido |
| Sobre-ingeniería temprana | Medio | Empezar con BaaS; sumar complejidad por fases |
| **Pausa de Supabase Free por inactividad** (a los 7 días sin actividad en la DB) | Medio | Los datos **no se borran** (solo se pausa hasta reactivar). Mitigación: keep-alive con cron cada ~3 días, reutilizando el job diario de FX (§9.4) que ya escribe en la DB. Alternativa: Neon (Postgres que se autodespierta) si se descarta Supabase |

---

## 16. Decisiones resueltas y preguntas abiertas

### Resueltas
1. **Tipo de cambio:** API automática con **dolarapi.com** (principal, permite elegir oficial/blue/MEP) + **BCRA** (oficial). Fallback a rate manual. ✔️
2. **Mes contable:** **configurable** por tarjeta (día de cierre). ✔️
3. **Bancos para parseo (Fase 2):** **Banco Nación** y **Banco Patagonia** (Visa/Mastercard). ✔️
4. **Notificaciones:** canal principal **WhatsApp** + opción **email**. Eventos: **ingreso de dinero** y **cierre de tarjeta/ciclo** (con resumen del total del período, incluyendo todos los medios: tarjetas, transferencias, efectivo). **No** se notifican gastos chicos individuales. ✔️
5. **WhatsApp:** **chat 1:1** con el bot; selección de workspace antes de confirmar; notificación 1:1 a miembros (no a grupos de WhatsApp). ✔️
6. **Nombre:** **Cuentas Claras**. ✔️
7. **Modelo de negocio:** **free** ahora; freemium a futuro (más workspaces + sin publicidad). ✔️
8. **Cotización:** se usa el FX **a la fecha en que el movimiento se cobra/imputa** (`charged_on`), no la fecha de compra. ✔️
9. **Privacidad de teléfono:** los miembros **no ven** los números entre sí; solo el **nombre**. ✔️

### Pendientes
- Definir las **plantillas de WhatsApp** exactas (texto) para los dos eventos notificables y enviarlas a aprobación de Meta.
- Confirmar cómo se determina `charged_on` automáticamente para compras con tarjeta (regla según `billing_close_day`).

---

*Fin del PRD v1.0 (borrador). Próximo paso sugerido: validar §16, congelar el alcance de Fase 1 y pasar a wireframes + esquema de base de datos ejecutable.*
