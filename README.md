# API REST (Node.js + Express + MySQL + BullMQ)

## Requisitos

- Node.js 18+
- MySQL activo
- Redis activo (para BullMQ)

## Configuracion

1. Copia `.env.example` a `.env`.
2. Ajusta las variables de conexion de MySQL y Redis en `.env`.

## Cola de consultas (BullMQ)

- La API usa BullMQ como servidor de colas para operaciones de base de datos.
- Todas las consultas de los modelos (`users`, `proveedores`, `clientes`, `productos`, `vehiculos`) se encolan primero.
- Un worker procesa los jobs y ejecuta las consultas contra MySQL.

## Scripts

- `npm run dev`: inicia en desarrollo con nodemon.
- `npm start`: inicia en modo normal.

## Endpoints

- `GET /health`
- `GET /api/users`
- `GET /api/users/:id`
- `POST /api/users/login`
- `POST /api/users`
- `PUT /api/users/:id`
- `DELETE /api/users/:id`
- `GET /api/proveedores`
- `GET /api/proveedores/:id`
- `POST /api/proveedores`
- `PUT /api/proveedores/:id`
- `DELETE /api/proveedores/:id`
- `GET /api/clientes`
- `GET /api/clientes/:id`
- `POST /api/clientes`
- `PUT /api/clientes/:id`
- `DELETE /api/clientes/:id`
- `GET /api/productos`
- `GET /api/productos/:id`
- `POST /api/productos`
- `PUT /api/productos/:id`
- `DELETE /api/productos/:id`
- `GET /api/vehiculos`
- `GET /api/vehiculos/:id`
- `POST /api/vehiculos`
- `PUT /api/vehiculos/:id`
- `DELETE /api/vehiculos/:id`
- `GET /api/reporte-kilometraje-vehiculo`

### Body ejemplo login

```json
{
  "username": "admin",
  "password": "123456"
}
```

### Body ejemplo usuarios

```json
{
  "nombre_completo": "Juan Perez",
  "username": "juan",
  "password_hash": "123456",
  "rol": "admin"
}
```

### Body ejemplo proveedores

```json
{
  "nombre_empresa": "Proveedor ABC",
  "nit": "1234-5",
  "contacto_nombre": "Ana Gomez",
  "telefono": "5555-1234"
}
```

### Body ejemplo clientes

```json
{
  "nombre_comercial": "Cliente XYZ",
  "direccion_entrega": "Zona 10",
  "telefono": "4444-9876",
  "nit_facturacion": "CF"
}
```

### Body ejemplo productos

```json
{
  "nombre": "Azucar Refinada",
  "descripcion": "Presentacion bolsa 1kg",
  "unidad_medida": "kg",
  "tipo_producto": "Materia Prima",
  "stock_minimo": 10,
  "precio_venta_sugerido": 25.5
}
```

### Body ejemplo vehiculos

```json
{
  "placa": "P123ABC",
  "modelo": "NPR 2022",
  "estado": "Disponible",
  "kilometraje_actual": 12000.5
}
```
