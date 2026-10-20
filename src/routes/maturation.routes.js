const { Router } = require('express');
const maturationController = require('../controllers/maturation.controller');

const router = Router();

/**
 * @swagger
 * /api/maduracion/lotes:
 *   get:
 *     summary: Lista los lotes de materia prima
 *     tags: [Maduracion]
 *     responses:
 *       200:
 *         description: Lista de lotes
 */
router.get('/lotes', maturationController.getLotes);

/**
 * @swagger
 * /api/maduracion/lotes/{id}:
 *   get:
 *     summary: Obtiene un lote de materia prima por id
 *     tags: [Maduracion]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Lote encontrado
 *       404:
 *         description: No encontrado
 */
router.get('/lotes/:id', maturationController.getLoteById);

/**
 * @swagger
 * /api/maduracion/lotes:
 *   post:
 *     summary: Crea un lote de materia prima (manual, sin pasar por una entrada)
 *     tags: [Maduracion]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id_producto, id_proveedor, peso_inicial_kg]
 *             properties:
 *               id_producto: { type: integer }
 *               id_proveedor: { type: integer }
 *               id_entrada_origen: { type: integer, nullable: true }
 *               peso_inicial_kg: { type: number }
 *               cantidad_unidades: { type: integer, nullable: true }
 *               estado_maduracion: { type: string, enum: [Verde, Sarazo, Maduro, 'Sobre maduro'] }
 *     responses:
 *       201:
 *         description: Lote creado
 *       400:
 *         description: Datos invalidos
 *       404:
 *         description: La entrada de origen no existe
 */
router.post('/lotes', maturationController.createLote);

/**
 * @swagger
 * /api/maduracion/lotes/{id}:
 *   put:
 *     summary: Actualiza un lote de materia prima
 *     tags: [Maduracion]
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
 *               id_producto: { type: integer }
 *               id_proveedor: { type: integer }
 *               peso_inicial_kg: { type: number }
 *               cantidad_unidades: { type: integer }
 *               estado_maduracion: { type: string, enum: [Verde, Sarazo, Maduro, 'Sobre maduro'] }
 *     responses:
 *       200:
 *         description: Lote actualizado
 *       404:
 *         description: No encontrado
 */
router.put('/lotes/:id', maturationController.updateLote);

/**
 * @swagger
 * /api/maduracion/lotes/{id}:
 *   delete:
 *     summary: Elimina (soft-delete) un lote de materia prima
 *     tags: [Maduracion]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204:
 *         description: Lote eliminado
 *       404:
 *         description: No encontrado
 */
router.delete('/lotes/:id', maturationController.deleteLote);

/**
 * @swagger
 * /api/maduracion/lotes/{id}/aceptar:
 *   post:
 *     summary: Acepta un lote y crea su sub-lote inicial
 *     description: >
 *       Si estado_maduracion es "Maduro", el sub-lote resultante queda "Listo para produccion".
 *       En otro caso (Verde/Sarazo/Sobre maduro) queda "Activo" (sigue en Maduracion, o puede
 *       empacarse directo como red si es Verde).
 *     tags: [Maduracion]
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
 *             required: [estado_maduracion]
 *             properties:
 *               estado_maduracion: { type: string, enum: [Verde, Sarazo, Maduro, 'Sobre maduro'] }
 *     responses:
 *       201:
 *         description: Lote aceptado, sub-lote creado
 *       404:
 *         description: Lote no encontrado
 */
router.post('/lotes/:id/aceptar', maturationController.acceptLote);

/**
 * @swagger
 * /api/maduracion/sublotes:
 *   get:
 *     summary: Lista los sub-lotes de maduracion
 *     tags: [Maduracion]
 *     responses:
 *       200:
 *         description: Lista de sub-lotes
 */
router.get('/sublotes', maturationController.getSublotes);

/**
 * @swagger
 * /api/maduracion/sublotes/listos-para-produccion:
 *   get:
 *     summary: Lista los sub-lotes en estado "Listo para produccion"
 *     tags: [Maduracion]
 *     responses:
 *       200:
 *         description: Lista de sub-lotes listos
 */
router.get('/sublotes/listos-para-produccion', maturationController.getSublotesListosParaProduccion);

/**
 * @swagger
 * /api/maduracion/sublotes/lote/{id_lote_mp}:
 *   get:
 *     summary: Lista los sub-lotes de un lote de materia prima
 *     tags: [Maduracion]
 *     parameters:
 *       - in: path
 *         name: id_lote_mp
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Lista de sub-lotes del lote
 */
router.get('/sublotes/lote/:id_lote_mp', maturationController.getSublotesByLote);

/**
 * @swagger
 * /api/maduracion/sublotes/{id}:
 *   get:
 *     summary: Obtiene un sub-lote por id
 *     tags: [Maduracion]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Sub-lote encontrado
 *       404:
 *         description: No encontrado
 */
router.get('/sublotes/:id', maturationController.getSubloteById);

/**
 * @swagger
 * /api/maduracion/sublotes/{id}/fraccionar:
 *   post:
 *     summary: Fracciona un sub-lote en dos (divide el peso)
 *     tags: [Maduracion]
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
 *             required: [peso_kg]
 *             properties:
 *               peso_kg: { type: number, description: Peso a separar en el nuevo sub-lote. }
 *               observaciones: { type: string }
 *     responses:
 *       201:
 *         description: Sub-lote fraccionado (devuelve el original actualizado y el nuevo)
 *       400:
 *         description: peso_kg invalido o mayor al disponible
 *       404:
 *         description: Sub-lote no encontrado
 */
router.post('/sublotes/:id/fraccionar', maturationController.splitSublote);

/**
 * @swagger
 * /api/maduracion/sublotes/{id}/cerrar:
 *   post:
 *     summary: Cierra la maduracion de un sub-lote (queda Listo para produccion)
 *     tags: [Maduracion]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               peso_medido_kg: { type: number, nullable: true }
 *     responses:
 *       200:
 *         description: Sub-lote cerrado
 *       404:
 *         description: Sub-lote no encontrado
 */
router.post('/sublotes/:id/cerrar', maturationController.closeSublote);

/**
 * @swagger
 * /api/maduracion/controles:
 *   get:
 *     summary: Lista los controles de maduracion (mediciones)
 *     tags: [Maduracion]
 *     responses:
 *       200:
 *         description: Lista de controles
 */
router.get('/controles', maturationController.getControles);

/**
 * @swagger
 * /api/maduracion/controles/sublote/{id_sublote}:
 *   get:
 *     summary: Lista los controles de un sub-lote
 *     tags: [Maduracion]
 *     parameters:
 *       - in: path
 *         name: id_sublote
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Lista de controles del sub-lote
 */
router.get('/controles/sublote/:id_sublote', maturationController.getControlesBySublote);

/**
 * @swagger
 * /api/maduracion/controles:
 *   post:
 *     summary: Registra una medicion de control de maduracion (grados brix, etc.)
 *     tags: [Maduracion]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id_sublote, grados_brix, temperatura_cuarto]
 *             properties:
 *               id_sublote: { type: integer }
 *               grados_brix: { type: number }
 *               peso_medido_kg: { type: number, nullable: true }
 *               porcentaje_materia_seca: { type: number, nullable: true }
 *               temperatura_cuarto: { type: number }
 *               id_cuarto_frio:
 *                 type: integer
 *                 nullable: true
 *                 description: Opcional. Cuarto frio del catalogo /api/produccion/cuartos-frio
 *               observaciones: { type: string }
 *     responses:
 *       201:
 *         description: Control registrado
 *       400:
 *         description: Datos invalidos (incluye temperatura faltante o cuarto frio inexistente/inactivo)
 *       404:
 *         description: Sub-lote no encontrado
 */
router.post('/controles', maturationController.createControl);

/**
 * @swagger
 * /api/maduracion/controles/{id}:
 *   delete:
 *     summary: Elimina un control de maduracion
 *     tags: [Maduracion]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204:
 *         description: Control eliminado
 *       404:
 *         description: No encontrado
 */
router.delete('/controles/:id', maturationController.deleteControl);

module.exports = router;
