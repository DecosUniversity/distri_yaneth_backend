const { Router } = require('express');
const vehicleServiceController = require('../controllers/vehicle_service.controller');

const router = Router();

/**
 * @swagger
 * /api/servicios-vehiculo:
 *   get:
 *     summary: Lista los servicios/mantenimientos de vehiculo registrados
 *     tags: [Servicios de Vehiculo]
 *     responses:
 *       200:
 *         description: Lista de servicios de vehiculo
 */
router.get('/', vehicleServiceController.getVehicleServices);

/**
 * @swagger
 * /api/servicios-vehiculo/{id}:
 *   get:
 *     summary: Obtiene un servicio de vehiculo por id
 *     tags: [Servicios de Vehiculo]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Servicio encontrado
 *       404:
 *         description: No encontrado
 */
router.get('/:id', vehicleServiceController.getVehicleServiceById);

/**
 * @swagger
 * /api/servicios-vehiculo:
 *   post:
 *     summary: Registra un servicio/mantenimiento de vehiculo
 *     tags: [Servicios de Vehiculo]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id_vehiculo, id_tipo_servicio, fecha_servicio, km_en_servicio]
 *             properties:
 *               id_vehiculo: { type: integer }
 *               id_tipo_servicio: { type: integer }
 *               fecha_servicio: { type: string, format: date, example: '2026-10-03' }
 *               km_en_servicio: { type: number }
 *               costo_servicio: { type: number }
 *               observaciones: { type: string }
 *     responses:
 *       201:
 *         description: Servicio registrado
 *       400:
 *         description: Datos invalidos
 */
router.post('/', vehicleServiceController.createVehicleService);

/**
 * @swagger
 * /api/servicios-vehiculo/{id}:
 *   put:
 *     summary: Actualiza un servicio de vehiculo
 *     tags: [Servicios de Vehiculo]
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
 *             properties:
 *               id_vehiculo: { type: integer }
 *               id_tipo_servicio: { type: integer }
 *               fecha_servicio: { type: string, format: date }
 *               km_en_servicio: { type: number }
 *               costo_servicio: { type: number }
 *               observaciones: { type: string }
 *     responses:
 *       200:
 *         description: Servicio actualizado
 *       404:
 *         description: No encontrado
 */
router.put('/:id', vehicleServiceController.updateVehicleService);

/**
 * @swagger
 * /api/servicios-vehiculo/{id}:
 *   delete:
 *     summary: Elimina (soft-delete) un servicio de vehiculo
 *     tags: [Servicios de Vehiculo]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204:
 *         description: Eliminado
 *       404:
 *         description: No encontrado
 */
router.delete('/:id', vehicleServiceController.deleteVehicleService);

module.exports = router;
