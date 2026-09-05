const { pool } = require('../../src/config/db');

// Crea un lote de materia prima + un sub-lote ya "Listo para produccion",
// sin pasar por todo el flujo de maduracion (eso lo cubren las pruebas de ese dominio).
const createReadySublot = async ({ idProducto, idProveedor, pesoKg = 100 }) => {
  const [lotResult] = await pool.query(
    `INSERT INTO lotes_materia_prima
       (id_producto, id_proveedor, fecha_recepcion, peso_inicial_kg, estado_maduracion, estado_registro)
     VALUES (?, ?, CURRENT_DATE, ?, 'Maduro', 'Activo')`,
    [idProducto, idProveedor, pesoKg]
  );

  const [sublotResult] = await pool.query(
    `INSERT INTO sublotes_maduracion
       (id_lote_mp, codigo_sublote, peso_inicial_kg, peso_kg, estado_maduracion, estado_registro)
     VALUES (?, 'A', ?, ?, 'Maduro', 'Listo para produccion')`,
    [lotResult.insertId, pesoKg, pesoKg]
  );

  return { idLoteMp: lotResult.insertId, idSublote: sublotResult.insertId };
};

// Sub-lote Verde y Activo (el estado que exige el empaque en red verde), a diferencia
// de createReadySublot que entrega uno Maduro y Listo para produccion.
const createActiveGreenSublot = async ({ idProducto, idProveedor, pesoKg = 100 }) => {
  const [lotResult] = await pool.query(
    `INSERT INTO lotes_materia_prima
       (id_producto, id_proveedor, fecha_recepcion, peso_inicial_kg, estado_maduracion, estado_registro)
     VALUES (?, ?, CURRENT_DATE, ?, 'Verde', 'Activo')`,
    [idProducto, idProveedor, pesoKg]
  );

  const [sublotResult] = await pool.query(
    `INSERT INTO sublotes_maduracion
       (id_lote_mp, codigo_sublote, peso_inicial_kg, peso_kg, estado_maduracion, estado_registro)
     VALUES (?, 'A', ?, ?, 'Verde', 'Activo')`,
    [lotResult.insertId, pesoKg, pesoKg]
  );

  return { idLoteMp: lotResult.insertId, idSublote: sublotResult.insertId };
};

// placa es varchar(15): un contador de modulo garantiza unicidad sin arriesgar truncamiento silencioso.
let vehicleFixtureCounter = 0;
let pilotFixtureCounter = 0;

const createVehicle = async ({ placa, kilometrajeActual = 1000 } = {}) => {
  vehicleFixtureCounter += 1;
  const [result] = await pool.query(
    `INSERT INTO vehiculos (placa, modelo, estado, kilometraje_actual, estado_registro)
     VALUES (?, 'Modelo de pruebas', 'Disponible', ?, 'Activo')`,
    [placa || `TST-${vehicleFixtureCounter}`, kilometrajeActual]
  );
  return result.insertId;
};

const createPilot = async ({ username } = {}) => {
  pilotFixtureCounter += 1;
  const [result] = await pool.query(
    `INSERT INTO usuarios (nombre_completo, username, password_hash, rol, estado_registro)
     VALUES ('Piloto de Pruebas', ?, 'x', 'Piloto', 'Activo')`,
    [username || `piloto.test.${pilotFixtureCounter}`]
  );
  return result.insertId;
};

// Crea una existencia de producto terminado con stock real (via un movimiento Entrada),
// para que orders.create tenga inventario del que descontar. Retorna el id_existencia.
const createFinishedProductStock = async ({ idProducto, cantidad = 100, fechaVencimiento = '2030-01-01' }) => {
  const [existenciaResult] = await pool.query(
    `INSERT INTO inventario_existencias (id_producto, fecha_vencimiento, cantidad_disponible, estado_registro) VALUES (?, ?, 0, 'Activo')`,
    [idProducto, fechaVencimiento]
  );
  const idExistencia = existenciaResult.insertId;

  await pool.query(
    `INSERT INTO movimientos_inventario (id_existencia, tipo_movimiento, cantidad, motivo, estado_registro) VALUES (?, 'Entrada', ?, 'Stock de prueba', 'Activo')`,
    [idExistencia, cantidad]
  );

  return idExistencia;
};

const createOrderWithLines = async ({ idCliente, idProducto, cantidad = 5, idUsuarioCreacion }) => {
  const [orderResult] = await pool.query(
    `INSERT INTO pedidos (id_cliente, id_usuario_creacion, id_usuario_modificacion, estado_registro) VALUES (?, ?, ?, 'Activo')`,
    [idCliente, idUsuarioCreacion, idUsuarioCreacion]
  );
  const [detailResult] = await pool.query(`INSERT INTO pedido_detalle (id_pedido, id_producto, cantidad) VALUES (?, ?, ?)`, [
    orderResult.insertId,
    idProducto,
    cantidad,
  ]);
  return { idPedido: orderResult.insertId, idDetalle: detailResult.insertId };
};

module.exports = {
  createReadySublot,
  createActiveGreenSublot,
  createVehicle,
  createPilot,
  createFinishedProductStock,
  createOrderWithLines,
};
