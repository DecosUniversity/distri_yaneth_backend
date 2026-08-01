const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const userRoutes = require('./routes/user.routes');
const providerRoutes = require('./routes/provider.routes');
const clientRoutes = require('./routes/client.routes');
const entradasMercanciaRoutes = require('./routes/entradas_mercancia.routes');
const maturationRoutes = require('./routes/maturation.routes');
const productRoutes = require('./routes/product.routes');
const inventoryRoutes = require('./routes/inventory.routes');
const serviceTypeRoutes = require('./routes/service_type.routes');
const vehicleRoutes = require('./routes/vehicle.routes');
const vehicleServiceRoutes = require('./routes/vehicle_service.routes');
const vehicleMileageReportRoutes = require('./routes/vehicle_mileage_report.routes');
const { authenticateToken, authorizeRoles } = require('./middlewares/auth.middleware');

const app = express();

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true, message: 'API funcionando' });
});

app.use('/api/users', userRoutes);
app.use(
  '/api/proveedores',
  authenticateToken,
  authorizeRoles('Administrador', 'Logistica'),
  providerRoutes
);
app.use(
  '/api/clientes',
  authenticateToken,
  authorizeRoles('Administrador', 'Logistica'),
  clientRoutes
);
app.use(
  '/api/entradas-mercancia',
  authenticateToken,
  authorizeRoles('Administrador', 'Logistica'),
  entradasMercanciaRoutes
);
app.use(
  '/api/maduracion',
  authenticateToken,
  authorizeRoles('Administrador', 'Produccion', 'Logistica'),
  maturationRoutes
);
app.use(
  '/api/productos',
  authenticateToken,
  authorizeRoles('Administrador', 'Produccion', 'Logistica'),
  productRoutes
);
app.use(
  '/api/inventario',
  authenticateToken,
  authorizeRoles('Administrador', 'Produccion', 'Logistica'),
  inventoryRoutes
);
app.use(
  '/api/tipos-servicio',
  authenticateToken,
  authorizeRoles('Administrador', 'Logistica'),
  serviceTypeRoutes
);
app.use(
  '/api/vehiculos',
  vehicleRoutes
);
app.use(
  '/api/servicios-vehiculo',
  authenticateToken,
  authorizeRoles('Administrador', 'Logistica'),
  vehicleServiceRoutes
);
app.use(
  '/api/reporte-kilometraje-vehiculo',
  authenticateToken,
  authorizeRoles('Administrador', 'Logistica', 'Piloto'),
  vehicleMileageReportRoutes
);

app.use((req, res) => {
  res.status(404).json({ message: 'Ruta no encontrada' });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: 'Error interno del servidor' });
});

module.exports = app;
