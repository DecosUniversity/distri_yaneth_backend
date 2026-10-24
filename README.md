# Backend — Sistema Integral de Producción y Distribución (Distribuidora Yaneth)

API REST en Node.js + Express 5. Las operaciones de base de datos pasan por una cola BullMQ (Redis)
y las ejecuta un worker contra MySQL. El worker corre **dentro del mismo proceso** que la API.

- Frontend: [distri_yaneth_frontend](https://github.com/DecosUniversity/distri_yaneth_frontend)
- Manual técnico completo (arquitectura, instalación, operación, respaldos): [docs/A_Manual_Tecnico/](docs/A_Manual_Tecnico/)
- Documentación de endpoints: `GET /api-docs` (Swagger UI) y `GET /api-docs.json`

## Requisitos

| Componente | Versión |
|---|---|
| Node.js | 22 LTS (mínimo 20.19) |
| MySQL | 8.0 (o MariaDB 10.6+) |
| Redis | 7.x (mínimo 6.2) |

## Desarrollo local

```bash
npm install
cp .env.example .env          # ajustar DB_USER, DB_PASSWORD, DB_NAME=proyecto_graduacion, JWT_SECRET

mysql -u root -p -e "CREATE DATABASE proyecto_graduacion CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;"
mysql -u root -p proyecto_graduacion < sql/schema.sql      # crea las 34 tablas (hace DROP TABLE IF EXISTS)

docker run -d --name backend-redis -p 6379:6379 redis:7    # o un redis-server local

npm run dev                   # http://localhost:3000/health
```

El esquema no trae usuarios: crear el primer Administrador con un hash bcrypt
(`node -e "console.log(require('bcryptjs').hashSync('<clave>', 10))"`) e insertarlo en `usuarios`.

### Scripts

- `npm run dev`: API con nodemon (reinicia al guardar).
- `npm start`: API en modo normal.
- `npm test`: pruebas con Vitest.

## Producción (resumen)

Servidores Ubuntu Server 24.04. **Nginx** entrega el frontend compilado y reenvía `/api` a la API
(PM2, puerto 3000 solo local). MySQL y Redis pueden estar **en el mismo servidor** (variante A) o
**en servidores propios** dentro de la red privada (variante B):

```
Navegador ──HTTPS──> Nginx ──> API + worker (PM2, :3000) ──> MySQL  (127.0.0.1 o IP-DB)
                                                        └──> Redis  (127.0.0.1 o IP-REDIS)
```

| Variante | `DB_HOST` | `REDIS_HOST` | Notas |
|---|---|---|---|
| A. Todo en uno | `127.0.0.1` | `127.0.0.1` | MySQL y Redis escuchan solo en local |
| B. Separados | IP privada de MySQL | IP privada de Redis | Usuario MySQL `'app_yaneth'@'<IP-APP>'`, `requirepass` en Redis, firewall que solo acepta a IP-APP |

Las conexiones hacia MySQL y Redis no van cifradas: en la variante B deben ir por red privada y
los puertos 3306/6379 nunca se publican en Internet.

```bash
cd /opt/yaneth-sistema/Backend
npm ci --omit=dev
cp .env.example .env && chmod 600 .env      # credenciales reales, JWT_SECRET propio
pm2 start src/server.js --name yaneth-api --exp-backoff-restart-delay=2000
pm2 save && pm2 startup systemd
```

El procedimiento completo (3 jornadas, configuración de Nginx + Certbot, firewall por servidor,
respaldos y checklist de aceptación) está en el capítulo 5 del
[Manual Técnico](docs/A_Manual_Tecnico/Manual_Tecnico.pdf).

## Variables de entorno

Ver [.env.example](.env.example). Las principales:

| Variable | Descripción |
|---|---|
| `PORT` | Puerto de la API (3000) |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Conexión a MySQL |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB` | Conexión a Redis |
| `DB_QUEUE_NAME`, `DB_QUEUE_CONCURRENCY` | Cola BullMQ |
| `MATURATION_BRIX_THRESHOLD` | Grados Brix para "Listo para producción" (22) |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Firma y vigencia de la sesión. `JWT_SECRET` es obligatoria (mínimo 32 caracteres, distinta del ejemplo): sin ella el servidor no arranca. Generarla con `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |

## Base de datos

- `sql/schema.sql`: esquema consolidado para instalaciones nuevas.
- `sql/migrations/`: cambios fechados para actualizar bases existentes (se aplican en orden).
- Diagrama ER y descripción: [docs/C_Esquema_BD/](docs/C_Esquema_BD/).
