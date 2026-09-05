// Extiende el dataset de demostracion: agrega 3 productos terminados nuevos con su propio
// ciclo de produccion (para que tengan stock real), y una tanda de pedidos repartidos entre
// clientes/productos/fechas (las fechas se recorren hacia atras despues de crear cada pedido,
// ya que orders.create siempre usa NOW()) para poder probar los filtros del reporte de pedidos.
//
// Uso: node scripts/seed_more_products.js   (desde la carpeta Backend, requiere haber corrido
// primero seed_demo_data.js para tener catalogo base de clientes/proveedores).

require('dotenv').config();

const { pool } = require('../src/config/db');

const productHandlers = require('../src/workers/domains/product.worker').handlers;
const entryHandlers = require('../src/workers/domains/entradas_mercancia.worker').handlers;
const maturationHandlers = require('../src/workers/domains/maturation.worker').handlers;
const productionHandlers = require('../src/workers/domains/production.worker').handlers;
const orderHandlers = require('../src/workers/domains/order.worker').handlers;

const log = (...args) => console.log('[seed-productos]', ...args);

const daysAgo = (n) => {
  const date = new Date();
  date.setDate(date.getDate() - n);
  return date;
};

const main = async () => {
  const [dbNameRows] = await pool.query('SELECT DATABASE() AS db');
  log(`Conectado a la base de datos: ${dbNameRows[0].db}`);

  if (dbNameRows[0].db.endsWith('_test')) {
    throw new Error('Este script es para la base de datos real, no para la de pruebas (_test). Aborta.');
  }

  const [users] = await pool.query('SELECT id_usuario, rol FROM usuarios');
  const idAdmin = users.find((u) => u.rol === 'Administrador').id_usuario;
  const idLogistica = (users.find((u) => u.rol === 'Logistica') || users.find((u) => u.rol === 'Administrador')).id_usuario;

  const [providers] = await pool.query('SELECT id_proveedor, nombre_empresa FROM proveedores');
  const [clients] = await pool.query('SELECT id_cliente, nombre_comercial FROM clientes');
  const [existingProducts] = await pool.query('SELECT id_producto, nombre FROM productos');

  const platanoVerde = existingProducts.find((p) => p.nombre === 'Platano Verde');
  const platanoFrito = existingProducts.find((p) => p.nombre === 'Platano Frito Bolsa de 3 LBS');
  const platanoRed = existingProducts.find((p) => p.nombre === 'Platano verde Red 4 LBS');

  log('Creando productos terminados nuevos...');
  const nuevosProductosDef = [
    { nombre: 'Tostones Congelados Bolsa 2 LBS', unidad_medida: 'Unidades', stock_minimo: 40 },
    { nombre: 'Pure de Platano Congelado 1 LB', unidad_medida: 'Unidades', stock_minimo: 30 },
    { nombre: 'Chips de Platano Bolsa 4 OZ', unidad_medida: 'Unidades', stock_minimo: 60 },
  ];

  const nuevosProductos = [];
  for (const def of nuevosProductosDef) {
    const created = await productHandlers['products.create']({
      nombre: def.nombre,
      tipo_producto: 'Producto Terminado',
      unidad_medida: def.unidad_medida,
      stock_minimo: def.stock_minimo,
      precio_venta_sugerido: 0,
      id_usuario_modificacion: idAdmin,
    });
    nuevosProductos.push(created);
    log(`Producto creado: ${created.nombre} (#${created.id_producto})`);
  }

  log('Generando stock real para cada producto nuevo (entrada -> maduracion -> produccion)...');
  for (let i = 0; i < nuevosProductos.length; i += 1) {
    const provider = providers[i % providers.length];
    const pesoKg = 90 + i * 15;

    const entrada = await entryHandlers['entries.create']({
      id_proveedor: provider.id_proveedor,
      id_producto: platanoVerde.id_producto,
      fecha_vencimiento: '2027-06-01',
      cantidad_disponible: pesoKg,
      costo_unitario: 4.6,
      documento_referencia: `FAC-PROD-${100 + i}`,
      id_usuario_receptor: idAdmin,
    });

    const [loteRows] = await pool.query('SELECT id_lote_mp FROM lotes_materia_prima WHERE id_entrada_origen = ?', [
      entrada.id_entrada,
    ]);

    const sublote = await maturationHandlers['maturationLots.accept']({
      id: loteRows[0].id_lote_mp,
      estado_maduracion: 'Maduro',
      id_usuario_modificacion: idAdmin,
    });

    const proceso = await productionHandlers['productionProcesses.create']({
      id_sublote: sublote.id_sublote,
      id_producto_resultado: nuevosProductos[i].id_producto,
      cantidad_ingresada_kg: Number(sublote.peso_kg),
      fecha_inicio: null,
      id_usuario_registro: idAdmin,
    });

    await productionHandlers['productionProcesses.finalize']({
      id: proceso.id_proceso,
      cantidad_producida_kg: Number(sublote.peso_kg), // sin mermas, produccion directa
      fecha_fin: new Date(),
      fecha_vencimiento: '2027-06-01',
      costo_unitario: 6,
      id_usuario_modificacion: idAdmin,
    });

    log(`${nuevosProductos[i].nombre}: proceso #${proceso.id_proceso} finalizado con ${sublote.peso_kg} kg`);
  }

  log('Creando pedidos repartidos entre clientes, productos y fechas...');
  const productosParaPedidos = [...nuevosProductos, platanoFrito, platanoRed].filter(Boolean);
  const totalPedidosNuevos = 10;

  for (let i = 0; i < totalPedidosNuevos; i += 1) {
    const cliente = clients[i % clients.length];
    const producto1 = productosParaPedidos[i % productosParaPedidos.length];
    const producto2 = productosParaPedidos[(i + 1) % productosParaPedidos.length];

    const pedido = await orderHandlers['orders.create']({
      id_cliente: cliente.id_cliente,
      observaciones: null,
      id_usuario_creacion: idLogistica,
      lineas: [
        { id_producto: producto1.id_producto, cantidad: 3 + (i % 5) },
        { id_producto: producto2.id_producto, cantidad: 1 + (i % 3) },
      ],
    });

    // orders.create siempre usa NOW(); se recorre la fecha hacia atras para poder
    // probar los filtros de fecha del reporte con datos repartidos en el tiempo.
    const fechaBackdated = daysAgo(i * 6 + 2);
    await pool.query('UPDATE pedidos SET fecha_creacion = ? WHERE id_pedido = ?', [fechaBackdated, pedido.id_pedido]);

    log(`Pedido #${pedido.id_pedido} para ${cliente.nombre_comercial}, fecha ${fechaBackdated.toISOString().slice(0, 10)}`);
  }

  log('Listo. Productos y pedidos de demostracion agregados con exito.');
};

main()
  .catch((error) => {
    console.error('[seed-productos] FALLO:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
