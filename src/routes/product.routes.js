const { Router } = require('express');
const productController = require('../controllers/product.controller');

const router = Router();

/**
 * @swagger
 * /api/productos:
 *   get:
 *     summary: Lista todos los productos activos
 *     tags: [Productos]
 *     responses:
 *       200:
 *         description: Lista de productos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Producto'
 */
router.get('/', productController.getProducts);

/**
 * @swagger
 * /api/productos/{id}:
 *   get:
 *     summary: Obtiene un producto por id
 *     tags: [Productos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Producto encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Producto'
 *       404:
 *         description: Producto no encontrado
 */
router.get('/:id', productController.getProductById);

/**
 * @swagger
 * /api/productos:
 *   post:
 *     summary: Crea un producto
 *     description: >
 *       Si tipo_producto es "Producto Terminado", el campo `etapas` es obligatorio y no puede
 *       estar vacio: el producto y su plan de etapas se crean atomicamente en una transaccion.
 *     tags: [Productos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProductoInput'
 *     responses:
 *       201:
 *         description: Producto creado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Producto'
 *       400:
 *         description: Datos invalidos (ej. falta el plan de etapas para un Producto Terminado)
 *       404:
 *         description: Algun id_tipo_etapa del plan no existe
 */
router.post('/', productController.createProduct);

/**
 * @swagger
 * /api/productos/{id}:
 *   put:
 *     summary: Actualiza un producto
 *     tags: [Productos]
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
 *             $ref: '#/components/schemas/ProductoInput'
 *     responses:
 *       200:
 *         description: Producto actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Producto'
 *       404:
 *         description: Producto no encontrado
 */
router.put('/:id', productController.updateProduct);

/**
 * @swagger
 * /api/productos/{id}:
 *   delete:
 *     summary: Desactiva (soft-delete) un producto
 *     tags: [Productos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204:
 *         description: Producto desactivado
 *       404:
 *         description: Producto no encontrado
 */
router.delete('/:id', productController.deleteProduct);

module.exports = router;
