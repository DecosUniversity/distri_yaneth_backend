const { Router } = require('express');
const routeController = require('../controllers/route.controller');

const router = Router();

/**
 * @swagger
 * /api/rutas/pilotos-disponibles:
 *   get:
 *     summary: Lista los pilotos disponibles para asignar a una ruta
 *     tags: [Rutas]
 *     responses:
 *       200:
 *         description: Lista de pilotos disponibles
 */
router.get('/pilotos-disponibles', routeController.getPilotosDisponibles);

/**
 * @swagger
 * /api/rutas:
 *   get:
 *     summary: Lista las rutas/manifiestos de entrega
 *     tags: [Rutas]
 *     responses:
 *       200:
 *         description: Lista de rutas
 */
router.get('/', routeController.getRutas);

/**
 * @swagger
 * /api/rutas/reportes/indicadores:
 *   get:
 *     summary: Indicadores de logistica de las rutas cerradas (combustible, costo, duracion, puntualidad)
 *     description: |
 *       Calcula, en total, por mes y por vehiculo, el consumo de combustible (a partir de los niveles
 *       de tanque y las facturas), km por galon, costo, duracion de las rutas, puntualidad de las
 *       entregas y porcentaje de pedidos sin devolucion. Solo Administrador o Logistica.
 *     tags: [Rutas]
 *     parameters:
 *       - in: query
 *         name: desde
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: hasta
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: id_vehiculo
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Indicadores (resumen, por_mes, por_vehiculo y rutas)
 *       400:
 *         description: Filtros invalidos
 *       403:
 *         description: Solo Administrador o Logistica
 */
router.get('/reportes/indicadores', routeController.getIndicadores);

/**
 * @swagger
 * /api/rutas/{id}:
 *   get:
 *     summary: Obtiene una ruta por id
 *     tags: [Rutas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Ruta encontrada
 *       404:
 *         description: No encontrada
 */
router.get('/:id', routeController.getRutaById);

/**
 * @swagger
 * /api/rutas:
 *   post:
 *     summary: Crea una ruta de entrega (manifiesto), asignando vehiculo y piloto
 *     description: Solo Administrador o Logistica pueden crear rutas.
 *     tags: [Rutas]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id_vehiculo, id_piloto, id_pedidos]
 *             properties:
 *               id_vehiculo: { type: integer }
 *               id_piloto: { type: integer }
 *               id_pedidos:
 *                 type: array
 *                 items: { type: integer }
 *     responses:
 *       201:
 *         description: Ruta creada
 *       400:
 *         description: Datos invalidos
 *       403:
 *         description: Solo Administrador o Logistica pueden crear rutas
 */
router.post('/', routeController.createRuta);

/**
 * @swagger
 * /api/rutas/{id}/salida:
 *   put:
 *     summary: Registra la salida de una ruta (km inicial y nivel del tanque)
 *     description: Devuelve en alertas_combustible los avisos si el nivel no coincide con la llegada anterior del vehiculo.
 *     tags: [Rutas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [km_salida, nivel_tanque_salida]
 *             properties:
 *               km_salida: { type: number }
 *               nivel_tanque_salida: { type: integer, minimum: 0, maximum: 8, description: 'Octavos de tanque (0 vacio, 8 lleno)' }
 *     responses:
 *       200:
 *         description: Salida registrada
 *       400:
 *         description: Datos invalidos
 *       404:
 *         description: Ruta no encontrada
 */
router.put('/:id/salida', routeController.registrarSalida);

/**
 * @swagger
 * /api/rutas/{id}/entregas:
 *   put:
 *     summary: Confirma las entregas (cantidad entregada por linea de pedido) de una ruta en curso
 *     tags: [Rutas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [entregas]
 *             properties:
 *               entregas:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [id_detalle, cantidad_entregada]
 *                   properties:
 *                     id_detalle: { type: integer }
 *                     cantidad_entregada: { type: number, minimum: 0 }
 *     responses:
 *       200:
 *         description: Entregas confirmadas
 *       400:
 *         description: Datos invalidos
 *       403:
 *         description: No tienes permisos sobre esta ruta
 */
router.put('/:id/entregas', routeController.confirmarEntregas);

/**
 * @swagger
 * /api/rutas/{id}/cerrar:
 *   put:
 *     summary: Cierra una ruta (km de llegada, nivel del tanque y facturas de combustible)
 *     description: Calcula el consumo de la ruta y devuelve en alertas_combustible los avisos si el combustible no cuadra.
 *     tags: [Rutas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [km_llegada, nivel_tanque_llegada]
 *             properties:
 *               km_llegada: { type: number }
 *               nivel_tanque_llegada: { type: integer, minimum: 0, maximum: 8, description: 'Octavos de tanque (0 vacio, 8 lleno)' }
 *               cargas:
 *                 type: array
 *                 description: Facturas de combustible cargado durante la ruta (opcional)
 *                 items:
 *                   type: object
 *                   required: [numero_factura, galones, monto]
 *                   properties:
 *                     numero_factura: { type: string, maxLength: 40 }
 *                     galones: { type: number, exclusiveMinimum: 0 }
 *                     monto: { type: number, exclusiveMinimum: 0 }
 *     responses:
 *       200:
 *         description: Ruta cerrada
 *       400:
 *         description: Datos invalidos
 *       404:
 *         description: Ruta no encontrada
 */
router.put('/:id/cerrar', routeController.cerrarRuta);

module.exports = router;
