const { Router } = require('express');
const productionController = require('../controllers/production.controller');
const mermaTypeController = require('../controllers/merma_type.controller');
const stageTypeController = require('../controllers/stage_type.controller');
const productionOrderController = require('../controllers/production_order.controller');
const productStageRequirementController = require('../controllers/product_stage_requirement.controller');

const router = Router();

/**
 * @swagger
 * /api/produccion/tipos-merma:
 *   get:
 *     summary: Lista los tipos de merma activos
 *     tags: [Produccion]
 *     responses:
 *       200:
 *         description: Lista de tipos de merma
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TipoMerma'
 */
router.get('/tipos-merma', mermaTypeController.getMermaTypes);

/**
 * @swagger
 * /api/produccion/tipos-merma/{id}:
 *   get:
 *     summary: Obtiene un tipo de merma por id
 *     tags: [Produccion]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Tipo de merma encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TipoMerma'
 *       404:
 *         description: No encontrado
 */
router.get('/tipos-merma/:id', mermaTypeController.getMermaTypeById);

/**
 * @swagger
 * /api/produccion/tipos-merma:
 *   post:
 *     summary: Crea un tipo de merma
 *     tags: [Produccion]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nombre_merma]
 *             properties:
 *               nombre_merma: { type: string }
 *               descripcion: { type: string }
 *     responses:
 *       201:
 *         description: Tipo de merma creado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TipoMerma'
 */
router.post('/tipos-merma', mermaTypeController.createMermaType);

/**
 * @swagger
 * /api/produccion/tipos-merma/{id}:
 *   put:
 *     summary: Actualiza un tipo de merma
 *     tags: [Produccion]
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
 *               nombre_merma: { type: string }
 *               descripcion: { type: string }
 *     responses:
 *       200:
 *         description: Tipo de merma actualizado
 *       404:
 *         description: No encontrado
 */
router.put('/tipos-merma/:id', mermaTypeController.updateMermaType);

/**
 * @swagger
 * /api/produccion/tipos-merma/{id}:
 *   delete:
 *     summary: Desactiva (soft-delete) un tipo de merma
 *     tags: [Produccion]
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
router.delete('/tipos-merma/:id', mermaTypeController.deleteMermaType);

/**
 * @swagger
 * /api/produccion/tipos-etapa:
 *   get:
 *     summary: Lista los tipos de etapa activos (catalogo)
 *     tags: [Produccion]
 *     responses:
 *       200:
 *         description: Lista de tipos de etapa
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TipoEtapa'
 */
router.get('/tipos-etapa', stageTypeController.getStageTypes);

/**
 * @swagger
 * /api/produccion/tipos-etapa/{id}:
 *   get:
 *     summary: Obtiene un tipo de etapa por id
 *     tags: [Produccion]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Tipo de etapa encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TipoEtapa'
 *       404:
 *         description: No encontrado
 */
router.get('/tipos-etapa/:id', stageTypeController.getStageTypeById);

/**
 * @swagger
 * /api/produccion/tipos-etapa:
 *   post:
 *     summary: Crea un tipo de etapa
 *     tags: [Produccion]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nombre_etapa]
 *             properties:
 *               nombre_etapa: { type: string }
 *               descripcion: { type: string }
 *     responses:
 *       201:
 *         description: Tipo de etapa creado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TipoEtapa'
 */
router.post('/tipos-etapa', stageTypeController.createStageType);

/**
 * @swagger
 * /api/produccion/tipos-etapa/{id}:
 *   put:
 *     summary: Actualiza un tipo de etapa
 *     tags: [Produccion]
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
 *               nombre_etapa: { type: string }
 *               descripcion: { type: string }
 *     responses:
 *       200:
 *         description: Tipo de etapa actualizado
 *       404:
 *         description: No encontrado
 */
router.put('/tipos-etapa/:id', stageTypeController.updateStageType);

/**
 * @swagger
 * /api/produccion/tipos-etapa/{id}:
 *   delete:
 *     summary: Desactiva (soft-delete) un tipo de etapa
 *     tags: [Produccion]
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
router.delete('/tipos-etapa/:id', stageTypeController.deleteStageType);

/**
 * @swagger
 * /api/produccion/ordenes:
 *   get:
 *     summary: Lista las ordenes de produccion
 *     tags: [Produccion]
 *     responses:
 *       200:
 *         description: Lista de ordenes de produccion
 */
router.get('/ordenes', productionOrderController.getProductionOrders);

/**
 * @swagger
 * /api/produccion/ordenes/{id}:
 *   get:
 *     summary: Obtiene una orden de produccion por id
 *     tags: [Produccion]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Orden de produccion encontrada
 *       404:
 *         description: No encontrada
 */
router.get('/ordenes/:id', productionOrderController.getProductionOrderById);

/**
 * @swagger
 * /api/produccion/ordenes:
 *   post:
 *     summary: Crea una orden de produccion (guia a producir)
 *     tags: [Produccion]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id_producto, cantidad_solicitada_kg]
 *             properties:
 *               id_producto: { type: integer }
 *               cantidad_solicitada_kg: { type: number }
 *               fecha_solicitada: { type: string, format: date }
 *               observaciones: { type: string }
 *     responses:
 *       201:
 *         description: Orden de produccion creada
 */
router.post('/ordenes', productionOrderController.createProductionOrder);

/**
 * @swagger
 * /api/produccion/ordenes/{id}/cancelar:
 *   put:
 *     summary: Cancela una orden de produccion Pendiente
 *     tags: [Produccion]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Orden cancelada
 *       400:
 *         description: La orden ya no esta Pendiente (En Proceso/Completada/Cancelada)
 *       404:
 *         description: No encontrada
 */
router.put('/ordenes/:id/cancelar', productionOrderController.cancelProductionOrder);

/**
 * @swagger
 * /api/produccion/etapas-requeridas/{id_producto}:
 *   get:
 *     summary: Obtiene el plan de etapas (receta) de un producto terminado
 *     tags: [Produccion]
 *     parameters:
 *       - in: path
 *         name: id_producto
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Plan de etapas, ordenado
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ProductoEtapaRequerida'
 *       404:
 *         description: Producto no encontrado
 */
router.get('/etapas-requeridas/:id_producto', productStageRequirementController.getRequirements);

/**
 * @swagger
 * /api/produccion/etapas-requeridas/{id_producto}:
 *   put:
 *     summary: Reemplaza el plan de etapas completo de un producto terminado
 *     description: >
 *       Reemplaza toda la secuencia de una sola vez (no es un CRUD incremental). Solo aplica a
 *       productos de tipo "Producto Terminado".
 *     tags: [Produccion]
 *     parameters:
 *       - in: path
 *         name: id_producto
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [etapas]
 *             properties:
 *               etapas:
 *                 type: array
 *                 description: ids de cat_tipos_etapa en el orden en que deben cumplirse.
 *                 items: { type: integer }
 *     responses:
 *       200:
 *         description: Plan de etapas actualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ProductoEtapaRequerida'
 *       400:
 *         description: Datos invalidos, o el producto no es de tipo Producto Terminado
 *       404:
 *         description: Producto o algun id_tipo_etapa no encontrado
 */
router.put('/etapas-requeridas/:id_producto', productStageRequirementController.replaceRequirements);

/**
 * @swagger
 * /api/produccion/reportes/mermas-por-categoria:
 *   get:
 *     summary: Reporte de mermas totales agrupadas por categoria
 *     tags: [Produccion]
 *     responses:
 *       200:
 *         description: Totales de merma por categoria
 */
router.get('/reportes/mermas-por-categoria', productionController.getReporteMermasPorCategoria);

/**
 * @swagger
 * /api/produccion/reportes/produccion-por-producto:
 *   get:
 *     summary: Reporte de kg producidos totales por producto (procesos finalizados)
 *     tags: [Produccion]
 *     responses:
 *       200:
 *         description: Totales producidos por producto
 */
router.get('/reportes/produccion-por-producto', productionController.getReporteProduccionPorProducto);

/**
 * @swagger
 * /api/produccion/reportes/productividad:
 *   get:
 *     summary: Reporte de productividad agrupado por periodo
 *     tags: [Produccion]
 *     parameters:
 *       - in: query
 *         name: agrupacion
 *         required: false
 *         schema: { type: string, enum: [diaria, semanal, mensual], default: mensual }
 *     responses:
 *       200:
 *         description: Reporte de productividad
 *       400:
 *         description: agrupacion invalida
 */
router.get('/reportes/productividad', productionController.getReporteProductividad);

/**
 * @swagger
 * /api/produccion/procesos:
 *   get:
 *     summary: Lista los procesos de produccion
 *     tags: [Produccion]
 *     responses:
 *       200:
 *         description: Lista de procesos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ProcesoProduccion'
 */
router.get('/procesos', productionController.getProcesos);

/**
 * @swagger
 * /api/produccion/procesos/{id}:
 *   get:
 *     summary: Obtiene el detalle de un proceso de produccion (etapas, mermas, insumos)
 *     tags: [Produccion]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Proceso encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProcesoProduccion'
 *       404:
 *         description: No encontrado
 */
router.get('/procesos/:id', productionController.getProcesoById);

/**
 * @swagger
 * /api/produccion/procesos:
 *   post:
 *     summary: Inicia un proceso de produccion a partir de un sub-lote
 *     description: >
 *       El sub-lote debe estar "Listo para produccion", o "Activo" con estado_maduracion "Verde"
 *       (empaque en red de fruta verde). El producto resultado debe ser de tipo Producto Terminado.
 *     tags: [Produccion]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProcesoProduccionInput'
 *     responses:
 *       201:
 *         description: Proceso iniciado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProcesoProduccion'
 *       400:
 *         description: Sub-lote no valido, o cantidad_ingresada_kg supera el peso disponible
 *       404:
 *         description: Sub-lote o producto no encontrado
 */
router.post('/procesos', productionController.createProceso);

/**
 * @swagger
 * /api/produccion/procesos/{id}/etapas:
 *   post:
 *     summary: Registra una etapa dentro de un proceso
 *     description: >
 *       Si el producto resultado tiene un plan de etapas definido, id_tipo_etapa debe pertenecer
 *       a ese plan (bloqueo duro); si no tiene plan (producto legado), se acepta cualquier etapa
 *       del catalogo.
 *     tags: [Produccion]
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
 *             $ref: '#/components/schemas/EtapaProduccionInput'
 *     responses:
 *       201:
 *         description: Etapa registrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EtapaProduccion'
 *       400:
 *         description: Datos invalidos, o la etapa no pertenece al plan del producto
 *       404:
 *         description: Proceso no encontrado o ya finalizado
 */
router.post('/procesos/:id/etapas', productionController.addEtapa);

/**
 * @swagger
 * /api/produccion/procesos/{id}/etapas/{id_etapa}:
 *   put:
 *     summary: Actualiza/finaliza una etapa de un proceso
 *     tags: [Produccion]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: id_etapa
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EtapaProduccionInput'
 *     responses:
 *       200:
 *         description: Etapa actualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EtapaProduccion'
 *       400:
 *         description: Datos invalidos, o la etapa no pertenece al plan del producto
 *       404:
 *         description: Etapa no encontrada
 */
router.put('/procesos/:id/etapas/:id_etapa', productionController.updateEtapa);

/**
 * @swagger
 * /api/produccion/procesos/{id}/mermas:
 *   post:
 *     summary: Registra una merma categorizada dentro de un proceso
 *     tags: [Produccion]
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
 *             required: [id_tipo_merma, cantidad_kg]
 *             properties:
 *               id_tipo_merma: { type: integer }
 *               id_etapa: { type: integer, nullable: true }
 *               cantidad_kg: { type: number }
 *               observaciones: { type: string }
 *     responses:
 *       201:
 *         description: Merma registrada
 *       400:
 *         description: Datos invalidos
 *       404:
 *         description: Proceso no encontrado o ya finalizado
 */
router.post('/procesos/:id/mermas', productionController.addMerma);

/**
 * @swagger
 * /api/produccion/procesos/{id}/insumos:
 *   post:
 *     summary: Registra el consumo de un insumo dentro de un proceso
 *     description: Descuenta del inventario disponible del producto tipo Insumo indicado.
 *     tags: [Produccion]
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
 *             required: [id_producto, cantidad, unidad_medida]
 *             properties:
 *               id_producto: { type: integer }
 *               id_etapa: { type: integer, nullable: true }
 *               cantidad: { type: number }
 *               unidad_medida: { type: string }
 *               observaciones: { type: string }
 *     responses:
 *       201:
 *         description: Insumo consumido/registrado
 *       400:
 *         description: Datos invalidos, o no hay suficiente inventario disponible
 *       404:
 *         description: Proceso no encontrado o ya finalizado
 */
router.post('/procesos/:id/insumos', productionController.addInsumo);

/**
 * @swagger
 * /api/produccion/procesos/{id}/cuarto-frio:
 *   post:
 *     summary: Registra un ingreso a cuarto frio dentro de un proceso
 *     tags: [Produccion]
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
 *             required: [fecha_ingreso]
 *             properties:
 *               fecha_ingreso: { type: string, format: date-time }
 *               ubicacion_cuarto: { type: string }
 *               cantidad_kg: { type: number }
 *               observaciones: { type: string }
 *     responses:
 *       201:
 *         description: Ingreso a cuarto frio registrado
 *       400:
 *         description: Datos invalidos
 *       404:
 *         description: Proceso no encontrado
 */
router.post('/procesos/:id/cuarto-frio', productionController.addColdRoomEntry);

/**
 * @swagger
 * /api/produccion/procesos/{id}/finalizar:
 *   post:
 *     summary: Finaliza un proceso de produccion
 *     description: >
 *       Valida el balance de masa (ingresado - mermas = producido, con tolerancia) y, si el
 *       producto tiene un plan de etapas, que todas esten registradas y en el orden correcto.
 *       Al finalizar, crea/actualiza la existencia de inventario del producto resultado.
 *     tags: [Produccion]
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
 *             $ref: '#/components/schemas/FinalizarProcesoInput'
 *     responses:
 *       200:
 *         description: Proceso finalizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProcesoProduccion'
 *       400:
 *         description: >
 *           El proceso ya fue finalizado, el peso no cuadra sin justificacion, o faltan
 *           etapas requeridas / estan fuera de orden
 *       404:
 *         description: Proceso no encontrado
 */
router.post('/procesos/:id/finalizar', productionController.finalizeProceso);

/**
 * @swagger
 * /api/produccion/procesos/{id}/revertir:
 *   put:
 *     summary: Revierte un proceso de produccion no finalizado
 *     description: Restaura el peso del sub-lote de origen. Requiere justificacion si ya tiene trabajo registrado.
 *     tags: [Produccion]
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
 *               peso_a_revertir: { type: number }
 *               justificacion_reversion: { type: string }
 *     responses:
 *       200:
 *         description: Proceso revertido
 *       400:
 *         description: >
 *           El proceso ya fue finalizado, o falta declarar peso/justificacion cuando ya tiene
 *           trabajo registrado
 *       404:
 *         description: Proceso no encontrado
 */
router.put('/procesos/:id/revertir', productionController.revertProceso);

/**
 * @swagger
 * /api/produccion/procesos/{id}:
 *   delete:
 *     summary: Elimina (soft-delete) un proceso de produccion
 *     tags: [Produccion]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204:
 *         description: Proceso eliminado
 *       404:
 *         description: No encontrado
 */
router.delete('/procesos/:id', productionController.deleteProceso);

module.exports = router;
