const { Router } = require('express');
const providerController = require('../controllers/provider.controller');

const router = Router();

/**
 * @swagger
 * /api/proveedores:
 *   get:
 *     summary: Lista todos los proveedores activos
 *     tags: [Proveedores]
 *     responses:
 *       200:
 *         description: Lista de proveedores
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Proveedor'
 */
router.get('/', providerController.getProviders);

/**
 * @swagger
 * /api/proveedores/{id}:
 *   get:
 *     summary: Obtiene un proveedor por id
 *     tags: [Proveedores]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Proveedor encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Proveedor'
 *       404:
 *         description: Proveedor no encontrado
 */
router.get('/:id', providerController.getProviderById);

/**
 * @swagger
 * /api/proveedores:
 *   post:
 *     summary: Crea un proveedor
 *     tags: [Proveedores]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProveedorInput'
 *     responses:
 *       201:
 *         description: Proveedor creado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Proveedor'
 *       400:
 *         description: nombre_empresa es obligatorio
 */
router.post('/', providerController.createProvider);

/**
 * @swagger
 * /api/proveedores/{id}:
 *   put:
 *     summary: Actualiza un proveedor
 *     tags: [Proveedores]
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
 *             $ref: '#/components/schemas/ProveedorInput'
 *     responses:
 *       200:
 *         description: Proveedor actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Proveedor'
 *       404:
 *         description: Proveedor no encontrado
 */
router.put('/:id', providerController.updateProvider);

/**
 * @swagger
 * /api/proveedores/{id}:
 *   delete:
 *     summary: Desactiva (soft-delete) un proveedor
 *     tags: [Proveedores]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204:
 *         description: Proveedor desactivado
 *       404:
 *         description: Proveedor no encontrado
 */
router.delete('/:id', providerController.deleteProvider);

module.exports = router;
