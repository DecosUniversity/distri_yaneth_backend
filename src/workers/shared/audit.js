const AUDIT_TABLE = 'auditoria_cambios';

const AUDIT_ACTION_CREATE = 'Creacion';
const AUDIT_ACTION_UPDATE = 'Actualizacion';
const AUDIT_ACTION_DELETE = 'Eliminacion';

const serializeAuditValue = (value) => (value === null || value === undefined ? null : JSON.stringify(value));

const recordAudit = async (connection, { table, recordId, action, before, after, userId }) => {
  await connection.query(
    `INSERT INTO ${AUDIT_TABLE} (tabla_afectada, id_registro_afectado, accion, valores_anteriores, valores_nuevos, id_usuario) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      table,
      recordId === null || recordId === undefined ? null : String(recordId),
      action,
      serializeAuditValue(before),
      serializeAuditValue(after),
      userId ?? null,
    ]
  );
};

module.exports = {
  AUDIT_ACTION_CREATE,
  AUDIT_ACTION_UPDATE,
  AUDIT_ACTION_DELETE,
  recordAudit,
};
