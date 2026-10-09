const { pool } = require('../../config/db');
const { PRODUCT_STAGE_REQUIREMENTS_TABLE, CAT_STAGE_TABLE } = require('../shared/constants');
const { AUDIT_ACTION_UPDATE, recordAudit } = require('../shared/audit');

const requirementQueries = {
  findByProduct: `SELECT r.id_requisito, r.id_producto, r.id_tipo_etapa, cte.nombre_etapa, r.orden FROM ${PRODUCT_STAGE_REQUIREMENTS_TABLE} r LEFT JOIN ${CAT_STAGE_TABLE} cte ON cte.id_tipo_etapa = r.id_tipo_etapa WHERE r.id_producto = ? ORDER BY r.orden ASC`,
};

const handlers = {
  'productStageRequirements.findByProduct': async ({ id_producto }) => {
    const [rows] = await pool.query(requirementQueries.findByProduct, [id_producto]);
    return rows;
  },

  // Reemplaza toda la receta de un producto de una sola vez (mas simple que un CRUD
  // incremental de agregar/quitar/reordenar una fila a la vez).
  'productStageRequirements.replaceForProduct': async ({ id_producto, etapas, id_usuario_modificacion }) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [beforeRows] = await connection.query(requirementQueries.findByProduct, [id_producto]);

      await connection.query(`DELETE FROM ${PRODUCT_STAGE_REQUIREMENTS_TABLE} WHERE id_producto = ?`, [id_producto]);

      for (let index = 0; index < etapas.length; index += 1) {
        await connection.query(
          `INSERT INTO ${PRODUCT_STAGE_REQUIREMENTS_TABLE} (id_producto, id_tipo_etapa, orden, id_usuario_modificacion) VALUES (?, ?, ?, ?)`,
          [id_producto, etapas[index], index + 1, id_usuario_modificacion ?? null]
        );
      }

      const [afterRows] = await connection.query(requirementQueries.findByProduct, [id_producto]);

      await recordAudit(connection, {
        table: PRODUCT_STAGE_REQUIREMENTS_TABLE,
        recordId: id_producto,
        action: AUDIT_ACTION_UPDATE,
        before: beforeRows,
        after: afterRows,
        userId: id_usuario_modificacion,
      });

      await connection.commit();
      return afterRows;
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
