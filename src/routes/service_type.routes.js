const { Router } = require('express');
const serviceTypeController = require('../controllers/service_type.controller');

const router = Router();

/**
 * @swagger
 * /api/tipos-servicio:
 *   get:
 *     summary: Lista los tipos de servicio de vehiculo (catalogo)
 *     tags: [Tipos de Servicio]
 *     responses:
 *       200:
 *         description: Lista de tipos de servicio
 */
router.get('/', serviceTypeController.getServiceTypes);

/**
 * @swagger
 * /api/tipos-servicio/{id}:
 *   get:
 *     summary: Obtiene un tipo de servicio por id
 *     tags: [Tipos de Servicio]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Tipo de servicio encontrado
 *       404:
 *         description: No encontrado
 */
router.get('/:id', serviceTypeController.getServiceTypeById);

/**
 * @swagger
 * /api/tipos-servicio:
 *   post:
 *     summary: Crea un tipo de servicio de vehiculo
 *     tags: [Tipos de Servicio]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nombre_servicio]
 *             properties:
 *               nombre_servicio: { type: string }
 *               descripcion: { type: string }
 *               km_frecuencia: { type: integer, nullable: true }
 *     responses:
 *       201:
 *         description: Tipo de servicio creado
 */
router.post('/', serviceTypeController.createServiceType);

/**
 * @swagger
 * /api/tipos-servicio/{id}:
 *   put:
 *     summary: Actualiza un tipo de servicio
 *     tags: [Tipos de Servicio]
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
 *               nombre_servicio: { type: string }
 *               descripcion: { type: string }
 *               km_frecuencia: { type: integer, nullable: true }
 *     responses:
 *       200:
 *         description: Tipo de servicio actualizado
 *       404:
 *         description: No encontrado
 */
router.put('/:id', serviceTypeController.updateServiceType);

/**
 * @swagger
 * /api/tipos-servicio/{id}:
 *   delete:
 *     summary: Desactiva (soft-delete) un tipo de servicio
 *     tags: [Tipos de Servicio]
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
router.delete('/:id', serviceTypeController.deleteServiceType);

module.exports = router;
