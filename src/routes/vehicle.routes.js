const { Router } = require('express');
const vehicleController = require('../controllers/vehicle.controller');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth.middleware');

const router = Router();

/**
 * @swagger
 * /api/vehiculos:
 *   get:
 *     summary: Lista los vehiculos activos
 *     tags: [Vehiculos]
 *     responses:
 *       200:
 *         description: Lista de vehiculos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Vehiculo'
 */
router.get(
	'/',
	authenticateToken,
	authorizeRoles('Administrador', 'Logistica', 'Piloto'),
	vehicleController.getVehicles
);

/**
 * @swagger
 * /api/vehiculos/{id}:
 *   get:
 *     summary: Obtiene un vehiculo por id
 *     tags: [Vehiculos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Vehiculo encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Vehiculo'
 *       404:
 *         description: No encontrado
 */
router.get(
	'/:id',
	authenticateToken,
	authorizeRoles('Administrador', 'Logistica', 'Piloto'),
	vehicleController.getVehicleById
);

/**
 * @swagger
 * /api/vehiculos:
 *   post:
 *     summary: Crea un vehiculo
 *     tags: [Vehiculos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VehiculoInput'
 *     responses:
 *       201:
 *         description: Vehiculo creado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Vehiculo'
 */
router.post(
	'/',
	authenticateToken,
	authorizeRoles('Administrador', 'Logistica'),
	vehicleController.createVehicle
);

/**
 * @swagger
 * /api/vehiculos/{id}:
 *   put:
 *     summary: Actualiza un vehiculo
 *     tags: [Vehiculos]
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
 *             $ref: '#/components/schemas/VehiculoInput'
 *     responses:
 *       200:
 *         description: Vehiculo actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Vehiculo'
 *       404:
 *         description: No encontrado
 */
router.put(
	'/:id',
	authenticateToken,
	authorizeRoles('Administrador', 'Logistica', 'Piloto'),
	vehicleController.updateVehicle
);

/**
 * @swagger
 * /api/vehiculos/{id}:
 *   delete:
 *     summary: Desactiva (soft-delete) un vehiculo
 *     tags: [Vehiculos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204:
 *         description: Desactivado
 *       404:
 *         description: No encontrado
 */
router.delete(
	'/:id',
	authenticateToken,
	authorizeRoles('Administrador', 'Logistica'),
	vehicleController.deleteVehicle
);

module.exports = router;
