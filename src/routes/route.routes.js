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
 *     summary: Registra la salida de una ruta (km inicial, combustible)
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
 *             required: [km_salida]
 *             properties:
 *               km_salida: { type: number }
 *               galones_combustible: { type: number, nullable: true }
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
 *     summary: Cierra una ruta (km de llegada)
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
 *             required: [km_llegada]
 *             properties:
 *               km_llegada: { type: number }
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
