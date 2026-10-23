const { pool } = require('../../config/db');
const {
  USERS_TABLE,
  PROVIDERS_TABLE,
  INVENTORY_TABLE,
  MOVEMENTS_TABLE,
  PRODUCTS_TABLE,
  RAW_MATERIAL_LOTS_TABLE,
  MATURATION_SUBLOT_TABLE,
  ACTIVE_STATE,
  COMPLETE_STATE,
} = require('../shared/constants');
const { AUDIT_ACTION_CREATE, recordAudit } = require('../shared/audit');

const STOCK_DELTA = `CASE WHEN m.tipo_movimiento = 'Entrada' THEN m.cantidad WHEN m.tipo_movimiento IN ('Salida', 'Ajuste', 'Desperdicio') THEN -m.cantidad ELSE 0 END`;
const EXPIRATION_WARNING_DAYS = 30;
const EXPIRATION_WRITE_OFF_REASON = 'Baja por vencimiento';
const DEFAULT_LOSS_MONTHS = 6;

// Saldo de cada existencia hoy, el que tenia al cerrar su dia de vencimiento y lo que salio
// despues para usarse. La perdida por caducidad es lo que llego a vencer sin despacharse y
// nunca se uso (saldo al vencer - salidas posteriores): una baja posterior por vencimiento
// (Desperdicio) no la borra, pero un lote de materia prima aceptado tarde a maduracion si.
// Las fechas salen como texto para no depender de la zona horaria del cliente.
const expirationBaseQuery = `SELECT ie.id_existencia, ie.codigo_trazabilidad, ie.id_producto, pr.nombre AS producto_nombre, pr.tipo_producto, pr.unidad_medida, DATE_FORMAT(ie.fecha_vencimiento, '%Y-%m-%d') AS fecha_vencimiento, DATEDIFF(ie.fecha_vencimiento, CURDATE()) AS dias_para_vencer, COALESCE(ie.costo_unitario, 0) AS costo_unitario, COALESCE(SUM(${STOCK_DELTA}), 0) AS cantidad_actual, COALESCE(SUM(CASE WHEN DATE(m.fecha_movimiento) <= ie.fecha_vencimiento THEN ${STOCK_DELTA} ELSE 0 END), 0) AS cantidad_al_vencer, COALESCE(SUM(CASE WHEN DATE(m.fecha_movimiento) > ie.fecha_vencimiento AND m.tipo_movimiento = 'Salida' THEN m.cantidad ELSE 0 END), 0) AS salidas_despues FROM ${INVENTORY_TABLE} ie LEFT JOIN ${PRODUCTS_TABLE} pr ON pr.id_producto = ie.id_producto LEFT JOIN ${MOVEMENTS_TABLE} m ON m.id_existencia = ie.id_existencia AND m.estado_registro = '${ACTIVE_STATE}' WHERE ie.estado_registro = '${ACTIVE_STATE}'`;

const expirationQueries = {
  findAll: `${expirationBaseQuery} GROUP BY ie.id_existencia ORDER BY ie.fecha_vencimiento ASC, ie.id_existencia ASC`,
  findForUpdate: `SELECT ie.id_existencia, (ie.fecha_vencimiento < CURDATE()) AS vencida, (SELECT COALESCE(SUM(${STOCK_DELTA}), 0) FROM ${MOVEMENTS_TABLE} m WHERE m.id_existencia = ie.id_existencia AND m.estado_registro = '${ACTIVE_STATE}') AS cantidad_actual FROM ${INVENTORY_TABLE} ie WHERE ie.id_existencia = ? AND ie.estado_registro = '${ACTIVE_STATE}' FOR UPDATE`,
  today: `SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS hoy`,
};

// Meses (AAAA-MM) desde hace `months - 1` meses hasta el mes de `today`, en orden.
const buildMonthKeys = (today, months) => {
  const [year, month] = today.split('-').map(Number);
  const keys = [];

  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(year, month - 1 - offset, 1));
    keys.push(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`);
  }

  return keys;
};

const roundMoney = (value) => Math.round(Number(value) * 100) / 100;

const inventoryQueries = {
  findAll: `SELECT base.id_existencia, base.id_producto, base.producto_nombre, base.tipo_producto, base.id_proveedor, base.nombre_empresa, base.id_proceso_origen, base.id_entrada_origen, base.fecha_entrada, base.fecha_vencimiento, base.cantidad_disponible, base.costo_unitario, base.estado_registro, base.fecha_modificacion, base.id_lote_mp, base.peso_inicial_kg, base.id_usuario_modificacion, um.nombre_completo AS usuario_modificacion_nombre FROM (SELECT ie.id_existencia, ie.id_producto, pr.nombre AS producto_nombre, pr.tipo_producto AS tipo_producto, ie.id_proveedor, p.nombre_empresa, ie.id_proceso_origen, ie.id_entrada_origen, ie.fecha_entrada, ie.fecha_vencimiento, COALESCE(stock.cantidad_disponible, ie.cantidad_disponible, 0) AS cantidad_disponible, ie.costo_unitario, ie.estado_registro, ie.fecha_modificacion, NULL AS id_lote_mp, NULL AS peso_inicial_kg, ie.id_usuario_modificacion FROM ${INVENTORY_TABLE} ie LEFT JOIN ${PRODUCTS_TABLE} pr ON pr.id_producto = ie.id_producto AND pr.estado_registro = '${ACTIVE_STATE}' LEFT JOIN ${PROVIDERS_TABLE} p ON p.id_proveedor = ie.id_proveedor AND p.estado_registro = '${ACTIVE_STATE}' LEFT JOIN (SELECT id_existencia, SUM(CASE WHEN tipo_movimiento = 'Entrada' THEN cantidad WHEN tipo_movimiento IN ('Salida', 'Ajuste', 'Desperdicio') THEN -cantidad ELSE 0 END) AS cantidad_disponible FROM ${MOVEMENTS_TABLE} WHERE estado_registro = '${ACTIVE_STATE}' GROUP BY id_existencia) stock ON stock.id_existencia = ie.id_existencia WHERE ie.estado_registro = '${ACTIVE_STATE}' UNION ALL SELECT NULL AS id_existencia, l.id_producto, pr.nombre AS producto_nombre, 'Fruta para produccion' AS tipo_producto, NULL AS id_proveedor, NULL AS nombre_empresa, NULL AS id_proceso_origen, l.id_entrada_origen, l.fecha_recepcion AS fecha_entrada, NULL AS fecha_vencimiento, COALESCE(sub.peso_disponible, 0) AS cantidad_disponible, NULL AS costo_unitario, '${COMPLETE_STATE}' AS estado_registro, sub.fecha_modificacion, l.id_lote_mp, l.peso_inicial_kg, l.id_usuario_modificacion FROM ${RAW_MATERIAL_LOTS_TABLE} l INNER JOIN (SELECT id_lote_mp, SUM(peso_kg) AS peso_disponible, MAX(fecha_modificacion) AS fecha_modificacion FROM ${MATURATION_SUBLOT_TABLE} GROUP BY id_lote_mp) sub ON sub.id_lote_mp = l.id_lote_mp LEFT JOIN ${PRODUCTS_TABLE} pr ON pr.id_producto = l.id_producto AND pr.estado_registro = '${ACTIVE_STATE}') base LEFT JOIN ${USERS_TABLE} um ON um.id_usuario = base.id_usuario_modificacion ORDER BY base.fecha_entrada DESC, base.id_existencia DESC, base.id_entrada_origen DESC`,
  // Lotes (existencias) de un producto con stock disponible, FIFO por vencimiento; usado
  // por el modulo de pedidos para sugerir/seleccionar de que lote se descuenta la venta.
  // Las existencias vencidas no se ofrecen: no deben despacharse.
  findByProduct: `SELECT ie.id_existencia, ie.fecha_vencimiento, ie.id_proveedor, prov.nombre_empresa, COALESCE(stock.cantidad_disponible, 0) AS cantidad_disponible FROM ${INVENTORY_TABLE} ie LEFT JOIN ${PROVIDERS_TABLE} prov ON prov.id_proveedor = ie.id_proveedor LEFT JOIN (SELECT id_existencia, SUM(CASE WHEN tipo_movimiento = 'Entrada' THEN cantidad WHEN tipo_movimiento IN ('Salida', 'Ajuste', 'Desperdicio') THEN -cantidad ELSE 0 END) AS cantidad_disponible FROM ${MOVEMENTS_TABLE} WHERE estado_registro = '${ACTIVE_STATE}' GROUP BY id_existencia) stock ON stock.id_existencia = ie.id_existencia WHERE ie.id_producto = ? AND ie.estado_registro = '${ACTIVE_STATE}' AND ie.fecha_vencimiento >= CURDATE() HAVING cantidad_disponible > 0 ORDER BY ie.fecha_vencimiento ASC, ie.id_existencia ASC`,
};

const handlers = {
  'inventory.findAll': async () => {
    const [rows] = await pool.query(inventoryQueries.findAll);
    return rows;
  },
  'inventory.findByProduct': async ({ id_producto }) => {
    const [rows] = await pool.query(inventoryQueries.findByProduct, [id_producto]);
    return rows;
  },
  'inventory.expirationReport': async ({ months = DEFAULT_LOSS_MONTHS } = {}) => {
    const [[{ hoy }]] = await pool.query(expirationQueries.today);
    const [rows] = await pool.query(expirationQueries.findAll);

    const existencias = rows.map((row) => ({
      ...row,
      dias_para_vencer: Number(row.dias_para_vencer),
      costo_unitario: Number(row.costo_unitario),
      cantidad_actual: Number(row.cantidad_actual),
      cantidad_perdida: Math.max(0, Number(row.cantidad_al_vencer) - Number(row.salidas_despues)),
    }));

    // En riesgo: lo que hoy tiene stock y ya vencio o vence en los proximos 30 dias.
    const enRiesgo = existencias
      .filter((row) => row.cantidad_actual > 0 && row.dias_para_vencer <= EXPIRATION_WARNING_DAYS)
      .map((row) => ({
        id_existencia: row.id_existencia,
        codigo_trazabilidad: row.codigo_trazabilidad,
        id_producto: row.id_producto,
        producto_nombre: row.producto_nombre,
        tipo_producto: row.tipo_producto,
        unidad_medida: row.unidad_medida,
        fecha_vencimiento: row.fecha_vencimiento,
        dias_para_vencer: row.dias_para_vencer,
        estado: row.dias_para_vencer < 0 ? 'Vencido' : 'Por vencer',
        cantidad: row.cantidad_actual,
        valor: roundMoney(row.cantidad_actual * row.costo_unitario),
      }));

    const summarize = (estado) => {
      const items = enRiesgo.filter((row) => row.estado === estado);
      return { existencias: items.length, valor: roundMoney(items.reduce((sum, row) => sum + row.valor, 0)) };
    };

    // Perdida por caducidad: existencias que vencieron (antes de hoy) dentro de la ventana y
    // quedaron sin usar, agrupadas por el mes de su vencimiento y por producto.
    const monthKeys = buildMonthKeys(hoy, months);
    const lossByMonth = new Map(monthKeys.map((key) => [key, { mes: key, existencias: 0, valor: 0 }]));
    const lossByProduct = new Map();

    existencias
      .filter((row) => row.dias_para_vencer < 0 && row.cantidad_perdida > 0 && lossByMonth.has(row.fecha_vencimiento.slice(0, 7)))
      .forEach((row) => {
        const valor = row.cantidad_perdida * row.costo_unitario;
        const month = lossByMonth.get(row.fecha_vencimiento.slice(0, 7));
        month.existencias += 1;
        month.valor += valor;

        const product = lossByProduct.get(row.id_producto) || {
          id_producto: row.id_producto,
          producto_nombre: row.producto_nombre,
          unidad_medida: row.unidad_medida,
          cantidad: 0,
          valor: 0,
        };
        product.cantidad += row.cantidad_perdida;
        product.valor += valor;
        lossByProduct.set(row.id_producto, product);
      });

    return {
      fecha_corte: hoy,
      dias_alerta: EXPIRATION_WARNING_DAYS,
      resumen: { vencido: summarize('Vencido'), por_vencer: summarize('Por vencer') },
      en_riesgo: enRiesgo,
      perdida_mensual: Array.from(lossByMonth.values()).map((row) => ({ ...row, valor: roundMoney(row.valor) })),
      perdida_por_producto: Array.from(lossByProduct.values())
        .map((row) => ({ ...row, cantidad: roundMoney(row.cantidad), valor: roundMoney(row.valor) }))
        .sort((left, right) => right.valor - left.valor),
    };
  },
  // Retira todo el saldo de una existencia vencida con un movimiento 'Desperdicio', para que
  // deje de contarse como disponible; queda registrado quien la dio de baja y cuando.
  'inventory.writeOffExpired': async ({ id_existencia, id_usuario }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [rows] = await connection.query(expirationQueries.findForUpdate, [id_existencia]);

      if (rows.length === 0) {
        await connection.rollback();
        return null;
      }

      if (!Number(rows[0].vencida)) {
        await connection.rollback();
        throw new Error('Solo se puede dar de baja una existencia vencida');
      }

      const cantidad = Number(rows[0].cantidad_actual);

      if (cantidad <= 0) {
        await connection.rollback();
        throw new Error('La existencia no tiene stock para dar de baja');
      }

      const [result] = await connection.query(
        `INSERT INTO ${MOVEMENTS_TABLE} (id_existencia, tipo_movimiento, cantidad, motivo, id_usuario, estado_registro) VALUES (?, 'Desperdicio', ?, ?, ?, ?)`,
        [id_existencia, cantidad, EXPIRATION_WRITE_OFF_REASON, id_usuario ?? null, ACTIVE_STATE]
      );

      await connection.query(
        `UPDATE ${INVENTORY_TABLE} SET id_usuario_modificacion = ? WHERE id_existencia = ?`,
        [id_usuario ?? null, id_existencia]
      );

      const [movementRows] = await connection.query(`SELECT * FROM ${MOVEMENTS_TABLE} WHERE id_movimiento = ?`, [result.insertId]);

      await recordAudit(connection, {
        table: MOVEMENTS_TABLE,
        recordId: result.insertId,
        action: AUDIT_ACTION_CREATE,
        before: null,
        after: movementRows[0] || null,
        userId: id_usuario,
      });

      await connection.commit();

      return { id_existencia: Number(id_existencia), id_movimiento: result.insertId, cantidad_baja: cantidad };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
};

module.exports = {
  handlers,
};
