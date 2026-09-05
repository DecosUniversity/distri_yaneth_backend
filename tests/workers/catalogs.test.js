const { pool, resetDatabase, seedBaseline } = require('../helpers/db');
const { createVehicle } = require('../helpers/fixtures');
const { handlers: vehicleHandlers } = require('../../src/workers/domains/vehicle.worker.js');
const { handlers: vehicleServiceHandlers } = require('../../src/workers/domains/vehicle_service.worker.js');
const { handlers: serviceTypeHandlers } = require('../../src/workers/domains/service_type.worker.js');
const { handlers: mermaTypeHandlers } = require('../../src/workers/domains/merma_type.worker.js');
const { handlers: stageTypeHandlers } = require('../../src/workers/domains/stage_type.worker.js');
const { handlers: productHandlers } = require('../../src/workers/domains/product.worker.js');
const { handlers: clientHandlers } = require('../../src/workers/domains/client.worker.js');

let baseline;

beforeEach(async () => {
  await resetDatabase();
  baseline = await seedBaseline();
});

describe('vehicles.update', () => {
  it('crea un reporte de kilometraje cuando el km cambia', async () => {
    const idVehiculo = await createVehicle({ kilometrajeActual: 500 });

    await vehicleHandlers['vehicles.update']({
      id: idVehiculo,
      placa: 'TST-1',
      modelo: 'Modelo de pruebas',
      estado: 'Disponible',
      kilometraje_actual: 700,
      id_usuario_modificador: baseline.idUsuario,
    });

    const [reportRows] = await pool.query('SELECT kilometraje_registrado FROM reporte_kilometraje_vehiculo WHERE id_vehiculo = ?', [
      idVehiculo,
    ]);
    expect(reportRows).toHaveLength(1);
    expect(Number(reportRows[0].kilometraje_registrado)).toBe(700);
  });

  it('no crea reporte de kilometraje si el km no cambia', async () => {
    const idVehiculo = await createVehicle({ kilometrajeActual: 500 });

    await vehicleHandlers['vehicles.update']({
      id: idVehiculo,
      placa: 'TST-1',
      modelo: 'Modelo actualizado',
      estado: 'Disponible',
      kilometraje_actual: 500,
      id_usuario_modificador: baseline.idUsuario,
    });

    const [reportRows] = await pool.query('SELECT * FROM reporte_kilometraje_vehiculo WHERE id_vehiculo = ?', [idVehiculo]);
    expect(reportRows).toHaveLength(0);

    const [vehicleRows] = await pool.query('SELECT modelo FROM vehiculos WHERE id_vehiculo = ?', [idVehiculo]);
    expect(vehicleRows[0].modelo).toBe('Modelo actualizado');
  });
});

describe('vehicleServices CRUD', () => {
  it('crea, actualiza y elimina un servicio de vehiculo', async () => {
    const idVehiculo = await createVehicle();
    const serviceType = await serviceTypeHandlers['serviceTypes.create']({
      nombre_servicio: 'Cambio de aceite',
      id_usuario_modificacion: baseline.idUsuario,
    });

    const created = await vehicleServiceHandlers['vehicleServices.create']({
      id_vehiculo: idVehiculo,
      id_tipo_servicio: serviceType.id_tipo_servicio,
      fecha_servicio: '2026-08-01',
      km_en_servicio: 1000,
      id_usuario_modificacion: baseline.idUsuario,
    });
    expect(created.tipo_servicio_nombre).toBe('Cambio de aceite');

    const updated = await vehicleServiceHandlers['vehicleServices.update']({
      id: created.id_servicio,
      id_vehiculo: idVehiculo,
      id_tipo_servicio: serviceType.id_tipo_servicio,
      fecha_servicio: '2026-08-02',
      km_en_servicio: 1200,
      id_usuario_modificacion: baseline.idUsuario,
    });
    expect(Number(updated.km_en_servicio)).toBe(1200);

    const removed = await vehicleServiceHandlers['vehicleServices.remove']({ id: created.id_servicio });
    expect(removed).toBe(true);

    const [rows] = await pool.query('SELECT * FROM servicios_vehiculo WHERE id_servicio = ?', [created.id_servicio]);
    expect(rows).toHaveLength(0);
  });
});

describe('mermaTypes CRUD', () => {
  it('crea, actualiza y desactiva (soft-delete) un tipo de merma', async () => {
    const created = await mermaTypeHandlers['mermaTypes.create']({
      nombre_merma: 'Cascara de prueba',
      id_usuario_modificacion: baseline.idUsuario,
    });
    expect(created.estado_registro).toBe('Activo');

    const updated = await mermaTypeHandlers['mermaTypes.update']({
      id: created.id_tipo_merma,
      nombre_merma: 'Cascara renombrada',
      id_usuario_modificacion: baseline.idUsuario,
    });
    expect(updated.nombre_merma).toBe('Cascara renombrada');

    const removed = await mermaTypeHandlers['mermaTypes.remove']({ id: created.id_tipo_merma, id_usuario_modificacion: baseline.idUsuario });
    expect(removed).toBe(true);

    const [rows] = await pool.query('SELECT estado_registro FROM cat_tipos_merma WHERE id_tipo_merma = ?', [
      created.id_tipo_merma,
    ]);
    expect(rows[0].estado_registro).toBe('Inactivo');

    const all = await mermaTypeHandlers['mermaTypes.findAll']();
    expect(all.find((row) => row.id_tipo_merma === created.id_tipo_merma)).toBeUndefined();
  });
});

describe('stageTypes CRUD', () => {
  it('crea, actualiza y desactiva (soft-delete) un tipo de etapa', async () => {
    const created = await stageTypeHandlers['stageTypes.create']({
      nombre_etapa: 'Coccion de prueba',
      id_usuario_modificacion: baseline.idUsuario,
    });
    expect(created.estado_registro).toBe('Activo');

    const updated = await stageTypeHandlers['stageTypes.update']({
      id: created.id_tipo_etapa,
      nombre_etapa: 'Coccion renombrada',
      id_usuario_modificacion: baseline.idUsuario,
    });
    expect(updated.nombre_etapa).toBe('Coccion renombrada');

    const removed = await stageTypeHandlers['stageTypes.remove']({
      id: created.id_tipo_etapa,
      id_usuario_modificacion: baseline.idUsuario,
    });
    expect(removed).toBe(true);

    const [rows] = await pool.query('SELECT estado_registro FROM cat_tipos_etapa WHERE id_tipo_etapa = ?', [
      created.id_tipo_etapa,
    ]);
    expect(rows[0].estado_registro).toBe('Inactivo');

    const all = await stageTypeHandlers['stageTypes.findAll']();
    expect(all.find((row) => row.id_tipo_etapa === created.id_tipo_etapa)).toBeUndefined();
  });
});

describe('products CRUD', () => {
  it('crea, actualiza y desactiva un producto', async () => {
    const created = await productHandlers['products.create']({
      nombre: 'Producto de prueba',
      tipo_producto: 'Insumo',
      unidad_medida: 'Unidad',
      id_usuario_modificacion: baseline.idUsuario,
    });
    expect(created.stock_minimo).not.toBeNull();

    const updated = await productHandlers['products.update']({
      id: created.id_producto,
      nombre: 'Producto renombrado',
      tipo_producto: 'Insumo',
      unidad_medida: 'Unidad',
      id_usuario_modificacion: baseline.idUsuario,
    });
    expect(updated.nombre).toBe('Producto renombrado');

    await productHandlers['products.remove']({ id: created.id_producto, id_usuario_modificacion: baseline.idUsuario });
    const [rows] = await pool.query('SELECT estado_registro FROM productos WHERE id_producto = ?', [created.id_producto]);
    expect(rows[0].estado_registro).toBe('Inactivo');
  });
});

describe('clients CRUD', () => {
  it('crea, actualiza y desactiva un cliente', async () => {
    const created = await clientHandlers['clients.create']({
      nombre_comercial: 'Cliente de prueba',
      id_usuario_modificacion: baseline.idUsuario,
    });

    const updated = await clientHandlers['clients.update']({
      id: created.id_cliente,
      nombre_comercial: 'Cliente renombrado',
      id_usuario_modificacion: baseline.idUsuario,
    });
    expect(updated.nombre_comercial).toBe('Cliente renombrado');

    await clientHandlers['clients.remove']({ id: created.id_cliente, id_usuario_modificacion: baseline.idUsuario });
    const [rows] = await pool.query('SELECT estado_registro FROM clientes WHERE id_cliente = ?', [created.id_cliente]);
    expect(rows[0].estado_registro).toBe('Inactivo');
  });

  it('guarda y actualiza departamento, municipio y zona', async () => {
    const created = await clientHandlers['clients.create']({
      nombre_comercial: 'Cliente con ubicacion',
      departamento: 'Guatemala',
      municipio: 'Mixco',
      zona: '5',
      direccion_entrega: '3a calle 4-56',
      id_usuario_modificacion: baseline.idUsuario,
    });

    expect(created.departamento).toBe('Guatemala');
    expect(created.municipio).toBe('Mixco');
    expect(created.zona).toBe('5');

    const updated = await clientHandlers['clients.update']({
      id: created.id_cliente,
      nombre_comercial: created.nombre_comercial,
      departamento: 'Guatemala',
      municipio: 'Villa Nueva',
      zona: '12',
      id_usuario_modificacion: baseline.idUsuario,
    });

    expect(updated.municipio).toBe('Villa Nueva');
    expect(updated.zona).toBe('12');
  });
});
