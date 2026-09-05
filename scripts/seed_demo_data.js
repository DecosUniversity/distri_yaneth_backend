// Puebla la base de datos REAL (.env, no .env.test) con un dataset amplio y realista para
// seguir probando la app manualmente. Reutiliza los handlers reales del worker (no INSERTs
// sueltos) para que todo quede consistente: codigo_lote, auditoria, movimientos de inventario,
// maquina de estados de pedidos/rutas, etc.
//
// Pensado para correr sobre una base de datos recien vaciada (ver wipe_except_usuarios.js):
// no asume ningun catalogo previo salvo la tabla `usuarios`, que siempre se conserva.
//
// Uso: node scripts/seed_demo_data.js   (desde la carpeta Backend)

require('dotenv').config();

const { pool } = require('../src/config/db');

const providerHandlers = require('../src/workers/domains/provider.worker').handlers;
const clientHandlers = require('../src/workers/domains/client.worker').handlers;
const productHandlers = require('../src/workers/domains/product.worker').handlers;
const vehicleHandlers = require('../src/workers/domains/vehicle.worker').handlers;
const serviceTypeHandlers = require('../src/workers/domains/service_type.worker').handlers;
const vehicleServiceHandlers = require('../src/workers/domains/vehicle_service.worker').handlers;
const mermaTypeHandlers = require('../src/workers/domains/merma_type.worker').handlers;
const userHandlers = require('../src/workers/domains/user.worker').handlers;
const entryHandlers = require('../src/workers/domains/entradas_mercancia.worker').handlers;
const maturationHandlers = require('../src/workers/domains/maturation.worker').handlers;
const greenNetHandlers = require('../src/workers/domains/green_net.worker').handlers;
const productionHandlers = require('../src/workers/domains/production.worker').handlers;
const orderHandlers = require('../src/workers/domains/order.worker').handlers;
const routeHandlers = require('../src/workers/domains/route.worker').handlers;
const returnHandlers = require('../src/workers/domains/order_return.worker').handlers;

const log = (...args) => console.log('[seed]', ...args);

const daysAgo = (n) => {
  const date = new Date();
  date.setDate(date.getDate() - n);
  return date.toISOString().slice(0, 10);
};

const main = async () => {
  const [dbNameRows] = await pool.query('SELECT DATABASE() AS db');
  log(`Conectado a la base de datos: ${dbNameRows[0].db}`);

  if (dbNameRows[0].db.endsWith('_test')) {
    throw new Error('Este script es para la base de datos real, no para la de pruebas (_test). Aborta.');
  }

  // --- Usuarios: se reutilizan los reales, nunca se crean/borran aqui ---
  const [existingUsers] = await pool.query('SELECT id_usuario, username, rol FROM usuarios');
  const adminUser = existingUsers.find((u) => u.rol === 'Administrador');
  const pilotUser = existingUsers.find((u) => u.rol === 'Piloto');
  const idAdmin = adminUser.id_usuario;

  let logisticaUser = existingUsers.find((u) => u.rol === 'Logistica');
  if (!logisticaUser) {
    logisticaUser = await userHandlers['users.create']({
      nombre_completo: 'Maria Fernanda Lopez',
      username: 'maria.logistica',
      password_hash: 'demo1234',
      rol: 'Logistica',
      id_usuario_modificacion: idAdmin,
    });
    log(`Usuario Logistica creado: ${logisticaUser.username} / demo1234`);
  }

  // --- Catalogo base ---
  log('Creando proveedores...');
  const fincaLaFe = await providerHandlers['providers.create']({
    nombre_empresa: 'Finca La Fe',
    nit: '5544332-1',
    contacto_nombre: 'Roberto Paz',
    telefono: '5522-1100',
    id_usuario_modificacion: idAdmin,
  });
  const provider1 = await providerHandlers['providers.create']({
    nombre_empresa: 'Agroindustrial El Progreso',
    nit: '1234567-8',
    contacto_nombre: 'Carlos Mendez',
    telefono: '5511-2233',
    id_usuario_modificacion: idAdmin,
  });
  const provider2 = await providerHandlers['providers.create']({
    nombre_empresa: 'Bananeras del Sur',
    nit: '9876543-1',
    contacto_nombre: 'Lucia Ramirez',
    telefono: '5599-8877',
    id_usuario_modificacion: idAdmin,
  });

  log('Creando clientes (con departamento/municipio/zona repartidos para probar el orden de rutas por zona)...');
  const clientDefs = [
    { nombre: 'Restaurante Joselito', departamento: 'Guatemala', municipio: 'Guatemala', zona: '1', telefono: '5500-0011' },
    { nombre: 'Comedor Dona Rosa', departamento: 'Guatemala', municipio: 'Guatemala', zona: '1', telefono: '5500-0012' },
    { nombre: 'Tienda Don Chepe', departamento: 'Guatemala', municipio: 'Guatemala', zona: '10', telefono: '5500-0013' },
    { nombre: 'Super La Economica', departamento: 'Guatemala', municipio: 'Mixco', zona: '5', telefono: '5500-0014' },
    { nombre: 'Restaurante El Fogon', departamento: 'Guatemala', municipio: 'Villa Nueva', zona: '12', telefono: '5500-0015' },
  ];
  const allClients = [];
  for (const def of clientDefs) {
    const created = await clientHandlers['clients.create']({
      nombre_comercial: def.nombre,
      departamento: def.departamento,
      municipio: def.municipio,
      zona: def.zona,
      direccion_entrega: `Zona ${def.zona}, ${def.municipio}`,
      telefono: def.telefono,
      id_usuario_modificacion: idAdmin,
    });
    allClients.push(created);
  }

  log('Creando productos...');
  const platanoVerde = await productHandlers['products.create']({
    nombre: 'Platano Verde',
    tipo_producto: 'Materia Prima',
    unidad_medida: 'kg',
    stock_minimo: 100,
    id_usuario_modificacion: idAdmin,
  });
  const platanoFrito = await productHandlers['products.create']({
    nombre: 'Platano Frito Bolsa de 3 LBS',
    tipo_producto: 'Producto Terminado',
    unidad_medida: 'Unidades',
    stock_minimo: 30,
    precio_venta_sugerido: 25,
    id_usuario_modificacion: idAdmin,
  });
  const platanoRed = await productHandlers['products.create']({
    nombre: 'Platano verde en red',
    tipo_producto: 'Producto Terminado',
    unidad_medida: 'kg',
    stock_minimo: 20,
    precio_venta_sugerido: 15,
    id_usuario_modificacion: idAdmin,
  });
  const insumoBolsa = await productHandlers['products.create']({
    nombre: 'Bolsa Plastica 3 LBS',
    tipo_producto: 'Insumo',
    unidad_medida: 'Unidad',
    stock_minimo: 200,
    id_usuario_modificacion: idAdmin,
  });

  // El insumo necesita stock antes de poder consumirse en produccion.
  await entryHandlers['entries.create']({
    id_proveedor: fincaLaFe.id_proveedor,
    id_producto: insumoBolsa.id_producto,
    fecha_vencimiento: daysAgo(-365),
    cantidad_disponible: 500,
    costo_unitario: 0.35,
    documento_referencia: 'FAC-INSUMO-001',
    id_usuario_receptor: idAdmin,
  });

  log('Creando vehiculos y servicios...');
  const vehicle1 = await vehicleHandlers['vehicles.create']({
    placa: '368JHS',
    modelo: 'Toyota Dyna 2018',
    estado: 'Disponible',
    kilometraje_actual: 38000,
    id_usuario_modificacion: idAdmin,
  });
  const vehicle2 = await vehicleHandlers['vehicles.create']({
    placa: 'P123ABC',
    modelo: 'Isuzu NPR 2020',
    estado: 'Disponible',
    kilometraje_actual: 15000,
    id_usuario_modificacion: idAdmin,
  });
  const vehicle3 = await vehicleHandlers['vehicles.create']({
    placa: 'C456XYZ',
    modelo: 'Hyundai Porter 2019',
    estado: 'Disponible',
    kilometraje_actual: 42000,
    id_usuario_modificacion: idAdmin,
  });
  const allVehicles = [vehicle1, vehicle2, vehicle3];

  const serviceTypeOil = await serviceTypeHandlers['serviceTypes.create']({
    nombre_servicio: 'Cambio de aceite',
    km_frecuencia: 5000,
    id_usuario_modificacion: idAdmin,
  });
  await vehicleServiceHandlers['vehicleServices.create']({
    id_vehiculo: vehicle2.id_vehiculo,
    id_tipo_servicio: serviceTypeOil.id_tipo_servicio,
    fecha_servicio: daysAgo(20),
    km_en_servicio: 14500,
    costo_servicio: 350,
    proximo_servicio_km: 19500,
    id_usuario_modificacion: idAdmin,
  });

  log('Creando tipos de merma...');
  const mermaCascara = await mermaTypeHandlers['mermaTypes.create']({
    nombre_merma: 'Cascara',
    descripcion: 'Cascara descartada al pelar',
    id_usuario_modificacion: idAdmin,
  });
  const mermaRecorte = await mermaTypeHandlers['mermaTypes.create']({
    nombre_merma: 'Recorte',
    descripcion: 'Recorte de puntas y bordes durante el corte',
    id_usuario_modificacion: idAdmin,
  });

  // El catalogo de tipos de etapa ya trae Pelado/Corte/Fritura/Embalaje sembrados por la
  // migracion que reemplazo el enum nombre_etapa; se reutilizan por id_tipo_etapa.
  const [stageTypeRows] = await pool.query('SELECT id_tipo_etapa, nombre_etapa FROM cat_tipos_etapa');
  const stageTypesByName = Object.fromEntries(stageTypeRows.map((row) => [row.nombre_etapa, row.id_tipo_etapa]));

  // --- Flujo: entradas -> maduracion -> produccion ---
  log('Registrando entradas de materia prima...');
  const providersRotation = [fincaLaFe, provider1, provider2, fincaLaFe];
  const entradas = [];
  for (let i = 0; i < 4; i += 1) {
    const entrada = await entryHandlers['entries.create']({
      id_proveedor: providersRotation[i].id_proveedor,
      id_producto: platanoVerde.id_producto,
      fecha_vencimiento: daysAgo(-30),
      cantidad_disponible: 150 + i * 25,
      costo_unitario: 4.5,
      documento_referencia: `FAC-${1000 + i}`,
      id_usuario_receptor: idAdmin,
    });
    entradas.push(entrada);
  }
  log(`${entradas.length} entradas creadas, codigos: ${entradas.map((e) => e.codigo_lote).join(', ')}`);

  const lotesIds = [];
  for (const entrada of entradas) {
    const [rows] = await pool.query('SELECT id_lote_mp FROM lotes_materia_prima WHERE id_entrada_origen = ?', [
      entrada.id_entrada,
    ]);
    lotesIds.push(rows[0].id_lote_mp);
  }

  log('Procesando maduracion (2 directo a Maduro, 2 Verde con split + cierre)...');
  const readySublotes = [];

  const sublote0 = await maturationHandlers['maturationLots.accept']({
    id: lotesIds[0],
    estado_maduracion: 'Maduro',
    id_usuario_modificacion: idAdmin,
  });
  readySublotes.push(sublote0);

  const sublote1 = await maturationHandlers['maturationLots.accept']({
    id: lotesIds[1],
    estado_maduracion: 'Maduro',
    id_usuario_modificacion: idAdmin,
  });
  readySublotes.push(sublote1);

  const subloteVerde2 = await maturationHandlers['maturationLots.accept']({
    id: lotesIds[2],
    estado_maduracion: 'Verde',
    id_usuario_modificacion: idAdmin,
  });
  const split2 = await maturationHandlers['maturationSublots.split']({
    id: subloteVerde2.id_sublote,
    peso_kg: Math.round(Number(subloteVerde2.peso_kg) * 0.3),
    observaciones: 'Fraccionado para empacar en red verde',
    id_usuario_modificacion: idAdmin,
  });
  await maturationHandlers['maturationControls.create']({
    id_sublote: subloteVerde2.id_sublote,
    grados_brix: 18,
    peso_medido_kg: Number(split2.origen.peso_kg) * 0.9,
    temperatura_cuarto: 22,
    id_usuario_modificacion: idAdmin,
  });
  const cerrado2 = await maturationHandlers['maturationSublots.close']({
    id: split2.origen.id_sublote,
    peso_medido_kg: Number(split2.origen.peso_kg) * 0.92,
    id_usuario_modificacion: idAdmin,
  });
  readySublotes.push(cerrado2);

  log('Empacando redes verdes (varias cajas de un solo envio)...');
  await greenNetHandlers['greenNets.create']({
    id_sublote: split2.nuevo.id_sublote,
    id_producto: platanoRed.id_producto,
    fecha_vencimiento: daysAgo(-45),
    cajas: [
      { cantidad_redes: 20, peso_kg: 18 },
      { cantidad_redes: 20, peso_kg: 17.5 },
    ],
    id_usuario: idAdmin,
  });

  const subloteVerde3 = await maturationHandlers['maturationLots.accept']({
    id: lotesIds[3],
    estado_maduracion: 'Verde',
    id_usuario_modificacion: idAdmin,
  });
  const cerrado3 = await maturationHandlers['maturationSublots.close']({
    id: subloteVerde3.id_sublote,
    peso_medido_kg: Number(subloteVerde3.peso_kg) * 0.95,
    id_usuario_modificacion: idAdmin,
  });
  readySublotes.push(cerrado3);

  log('Creando procesos de produccion...');

  const procesoA = await productionHandlers['productionProcesses.create']({
    id_sublote: readySublotes[0].id_sublote,
    id_producto_resultado: platanoFrito.id_producto,
    cantidad_ingresada_kg: Number(readySublotes[0].peso_kg),
    fecha_inicio: null,
    id_usuario_registro: idAdmin,
  });
  const etapaNombres = ['Pelado', 'Corte', 'Fritura', 'Embalaje'];
  let entradaEtapa = Number(procesoA.cantidad_ingresada_kg);
  for (const nombre of etapaNombres) {
    await productionHandlers['productionProcesses.addStage']({
      id: procesoA.id_proceso,
      id_tipo_etapa: stageTypesByName[nombre],
      cantidad_personas: 3,
      personal_asignado: 'Equipo A',
      fecha_inicio: new Date(),
      cantidad_entrada_kg: entradaEtapa,
      id_usuario_modificacion: idAdmin,
    });
    const merma = entradaEtapa * 0.03;
    await productionHandlers['productionProcesses.addMerma']({
      id: procesoA.id_proceso,
      id_etapa: null,
      id_tipo_merma: nombre === 'Pelado' ? mermaCascara.id_tipo_merma : mermaRecorte.id_tipo_merma,
      cantidad_kg: Number(merma.toFixed(2)),
      id_usuario_modificacion: idAdmin,
    });
    entradaEtapa -= merma;
  }
  await productionHandlers['productionProcesses.addInsumo']({
    id: procesoA.id_proceso,
    id_etapa: null,
    id_producto: insumoBolsa.id_producto,
    cantidad: 40,
    unidad_medida: 'Unidad',
    observaciones: 'Empaque de bolsas para el lote',
    id_usuario_modificacion: idAdmin,
  });

  const [mermaTotalA] = await pool.query(
    'SELECT COALESCE(SUM(cantidad_kg),0) AS total FROM produccion_mermas WHERE id_proceso = ?',
    [procesoA.id_proceso]
  );
  const producidoA = Number(procesoA.cantidad_ingresada_kg) - Number(mermaTotalA[0].total);
  await productionHandlers['productionProcesses.finalize']({
    id: procesoA.id_proceso,
    cantidad_producida_kg: Number(producidoA.toFixed(2)),
    fecha_fin: new Date(),
    fecha_vencimiento: daysAgo(-90),
    costo_unitario: 8,
    id_usuario_modificacion: idAdmin,
  });
  log(`Proceso A finalizado (#${procesoA.id_proceso}), producidos ${producidoA.toFixed(2)} kg`);

  const procesoB = await productionHandlers['productionProcesses.create']({
    id_sublote: readySublotes[1].id_sublote,
    id_producto_resultado: platanoFrito.id_producto,
    cantidad_ingresada_kg: Number(readySublotes[1].peso_kg),
    fecha_inicio: null,
    id_usuario_registro: idAdmin,
  });
  await productionHandlers['productionProcesses.finalize']({
    id: procesoB.id_proceso,
    cantidad_producida_kg: Number((Number(procesoB.cantidad_ingresada_kg) * 0.8).toFixed(2)),
    fecha_fin: new Date(),
    fecha_vencimiento: daysAgo(-90),
    justificacion_diferencia: 'Se descarto parte del lote por punto de maduracion irregular',
    id_usuario_modificacion: idAdmin,
  });
  log(`Proceso B finalizado con diferencia justificada (#${procesoB.id_proceso})`);

  const procesoC = await productionHandlers['productionProcesses.create']({
    id_sublote: readySublotes[2].id_sublote,
    id_producto_resultado: platanoFrito.id_producto,
    cantidad_ingresada_kg: Number(readySublotes[2].peso_kg),
    fecha_inicio: null,
    id_usuario_registro: idAdmin,
  });
  await productionHandlers['productionProcesses.addStage']({
    id: procesoC.id_proceso,
    id_tipo_etapa: stageTypesByName['Pelado'],
    cantidad_personas: 2,
    fecha_inicio: new Date(),
    cantidad_entrada_kg: Number(procesoC.cantidad_ingresada_kg),
    id_usuario_modificacion: idAdmin,
  });
  log(`Proceso C dejado activo/en curso (#${procesoC.id_proceso})`);

  const procesoD = await productionHandlers['productionProcesses.create']({
    id_sublote: readySublotes[3].id_sublote,
    id_producto_resultado: platanoFrito.id_producto,
    cantidad_ingresada_kg: Number(readySublotes[3].peso_kg),
    fecha_inicio: null,
    id_usuario_registro: idAdmin,
  });
  await productionHandlers['productionProcesses.revert']({ id: procesoD.id_proceso, id_usuario_modificacion: idAdmin });
  log(`Proceso D revertido (#${procesoD.id_proceso}), sub-lote vuelve a Listo para produccion`);

  // --- Distribucion: pedidos, rutas, devoluciones ---
  log('Creando pedidos (con fecha de entrega programada)...');
  const pedidosCreados = [];
  for (let i = 0; i < 4; i += 1) {
    const cliente = allClients[i % allClients.length];
    const pedido = await orderHandlers['orders.create']({
      id_cliente: cliente.id_cliente,
      observaciones: i === 3 ? 'Entregar antes del mediodia' : null,
      fecha_entrega_programada: daysAgo(-(2 + i)),
      id_usuario_creacion: logisticaUser.id_usuario,
      lineas: [
        { id_producto: platanoFrito.id_producto, cantidad: 5 + i },
        { id_producto: platanoRed.id_producto, cantidad: 2 },
      ],
    });
    pedidosCreados.push(pedido);
  }
  log(`${pedidosCreados.length} pedidos creados`);

  log('Armando y cerrando ruta 1 (entrega completa)...');
  const ruta1 = await routeHandlers['routes.create']({
    id_pedidos: [pedidosCreados[0].id_pedido, pedidosCreados[1].id_pedido],
    id_vehiculo: allVehicles[0].id_vehiculo,
    id_piloto: pilotUser.id_usuario,
    id_usuario_creacion: logisticaUser.id_usuario,
  });
  await routeHandlers['routes.registrarSalida']({
    id: ruta1.id_ruta,
    km_salida: Number(allVehicles[0].kilometraje_actual || 0) + 10,
    galones_combustible: 8,
    id_usuario_modificacion: logisticaUser.id_usuario,
  });
  const [lineas1] = await pool.query(
    'SELECT id_detalle, cantidad FROM pedido_detalle WHERE id_pedido IN (?, ?)',
    [pedidosCreados[0].id_pedido, pedidosCreados[1].id_pedido]
  );
  await routeHandlers['routes.confirmarEntregas']({
    id: ruta1.id_ruta,
    entregas: lineas1.map((l) => ({ id_detalle: l.id_detalle, cantidad_entregada: Number(l.cantidad) })),
    id_usuario_modificacion: logisticaUser.id_usuario,
  });
  await routeHandlers['routes.cerrar']({
    id: ruta1.id_ruta,
    km_llegada: Number(allVehicles[0].kilometraje_actual || 0) + 45,
    id_usuario_modificacion: logisticaUser.id_usuario,
  });
  log(`Ruta 1 cerrada (#${ruta1.id_ruta}), pedidos ${pedidosCreados[0].id_pedido} y ${pedidosCreados[1].id_pedido} Entregados`);

  log('Armando y cerrando ruta 2 (entrega parcial -> devolucion)...');
  const ruta2 = await routeHandlers['routes.create']({
    id_pedidos: [pedidosCreados[2].id_pedido],
    id_vehiculo: allVehicles[1].id_vehiculo,
    id_piloto: pilotUser.id_usuario,
    id_usuario_creacion: logisticaUser.id_usuario,
  });
  await routeHandlers['routes.registrarSalida']({
    id: ruta2.id_ruta,
    km_salida: Number(allVehicles[1].kilometraje_actual || 0) + 5,
    id_usuario_modificacion: logisticaUser.id_usuario,
  });
  const [lineas2] = await pool.query('SELECT id_detalle, cantidad FROM pedido_detalle WHERE id_pedido = ?', [
    pedidosCreados[2].id_pedido,
  ]);
  await routeHandlers['routes.confirmarEntregas']({
    id: ruta2.id_ruta,
    entregas: lineas2.map((l, idx) => ({
      id_detalle: l.id_detalle,
      cantidad_entregada: idx === 0 ? 0 : Number(l.cantidad),
    })),
    id_usuario_modificacion: logisticaUser.id_usuario,
  });
  await routeHandlers['routes.cerrar']({
    id: ruta2.id_ruta,
    km_llegada: Number(allVehicles[1].kilometraje_actual || 0) + 30,
    id_usuario_modificacion: logisticaUser.id_usuario,
  });
  log(`Ruta 2 cerrada (#${ruta2.id_ruta}), pedido ${pedidosCreados[2].id_pedido} queda Con Devolucion`);

  log('Recibiendo y resolviendo la devolucion...');
  const lineaDevuelta = lineas2[0];
  const devolucion = await returnHandlers['orderReturns.create']({
    id_detalle: lineaDevuelta.id_detalle,
    motivo: 'Cliente reporto producto en mal estado',
    id_usuario_recepcion: logisticaUser.id_usuario,
  });
  await returnHandlers['orderReturns.resolve']({
    id: devolucion.id_devolucion,
    resolucion: 'Reingresado a inventario',
    id_usuario_resolucion: logisticaUser.id_usuario,
  });
  log(`Devolucion #${devolucion.id_devolucion} resuelta como Reingresado a inventario`);

  log(`Pedido ${pedidosCreados[3].id_pedido} se deja Pendiente (sin ruta) para seguir probando.`);

  log('Listo. Dataset de demostracion creado con exito.');
};

main()
  .catch((error) => {
    console.error('[seed] FALLO:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
