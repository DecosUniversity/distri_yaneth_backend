const swaggerJsdoc = require('swagger-jsdoc');

const PORT = process.env.PORT || 3000;

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'API - Sistema de Produccion de Banano/Platano',
      version: '1.0.0',
      description:
        'API REST para la gestion de entradas de materia prima, maduracion, produccion (etapas, mermas, insumos), ' +
        'inventario, distribucion (pedidos, rutas, devoluciones), trazabilidad y catalogos (productos, proveedores, ' +
        'clientes, vehiculos, usuarios). Proyecto de graduacion.',
    },
    servers: [{ url: `http://localhost:${PORT}`, description: 'Servidor local' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Token JWT obtenido en POST /api/users/login',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Mensaje de error' },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: { type: 'string', example: 'dennis' },
            password: { type: 'string', format: 'password', example: '123456' },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Sesion iniciada' },
            token: { type: 'string' },
            user: { $ref: '#/components/schemas/Usuario' },
          },
        },
        Usuario: {
          type: 'object',
          properties: {
            id_usuario: { type: 'integer' },
            nombre_completo: { type: 'string' },
            username: { type: 'string' },
            rol: { type: 'string', enum: ['Administrador', 'Produccion', 'Logistica', 'Piloto'] },
            estado_registro: { type: 'string', enum: ['Activo', 'Inactivo'] },
            fecha_creacion: { type: 'string', format: 'date-time' },
            fecha_modificacion: { type: 'string', format: 'date-time' },
          },
        },
        UsuarioInput: {
          type: 'object',
          required: ['nombre_completo', 'username', 'password', 'rol'],
          properties: {
            nombre_completo: { type: 'string' },
            username: { type: 'string' },
            password: { type: 'string', format: 'password', minLength: 6 },
            rol: { type: 'string', enum: ['Administrador', 'Produccion', 'Logistica', 'Piloto'] },
          },
        },
        Proveedor: {
          type: 'object',
          properties: {
            id_proveedor: { type: 'integer' },
            nombre_empresa: { type: 'string' },
            nit: { type: 'string' },
            contacto_nombre: { type: 'string' },
            telefono: { type: 'string' },
            estado_registro: { type: 'string', enum: ['Activo', 'Inactivo'] },
          },
        },
        ProveedorInput: {
          type: 'object',
          required: ['nombre_empresa'],
          properties: {
            nombre_empresa: { type: 'string' },
            nit: { type: 'string' },
            contacto_nombre: { type: 'string' },
            telefono: { type: 'string' },
          },
        },
        Cliente: {
          type: 'object',
          properties: {
            id_cliente: { type: 'integer' },
            nombre_comercial: { type: 'string' },
            departamento: { type: 'string' },
            municipio: { type: 'string' },
            zona: { type: 'string' },
            direccion_entrega: { type: 'string' },
            telefono: { type: 'string' },
            nit_facturacion: { type: 'string' },
            estado_registro: { type: 'string', enum: ['Activo', 'Inactivo'] },
          },
        },
        ClienteInput: {
          type: 'object',
          required: ['nombre_comercial'],
          properties: {
            nombre_comercial: { type: 'string' },
            departamento: { type: 'string' },
            municipio: { type: 'string' },
            zona: { type: 'string' },
            direccion_entrega: { type: 'string' },
            telefono: { type: 'string' },
            nit_facturacion: { type: 'string' },
          },
        },
        Producto: {
          type: 'object',
          properties: {
            id_producto: { type: 'integer' },
            nombre: { type: 'string' },
            descripcion: { type: 'string' },
            unidad_medida: { type: 'string' },
            tipo_producto: {
              type: 'string',
              enum: ['Materia Prima', 'Producto Terminado', 'Insumo', 'Venta Directa'],
            },
            stock_minimo: { type: 'number' },
            precio_venta_sugerido: { type: 'number' },
            estado_registro: { type: 'string', enum: ['Activo', 'Inactivo'] },
          },
        },
        ProductoInput: {
          type: 'object',
          required: ['nombre', 'tipo_producto'],
          properties: {
            nombre: { type: 'string' },
            descripcion: { type: 'string' },
            unidad_medida: { type: 'string' },
            tipo_producto: {
              type: 'string',
              enum: ['Materia Prima', 'Producto Terminado', 'Insumo', 'Venta Directa'],
            },
            stock_minimo: { type: 'number' },
            precio_venta_sugerido: { type: 'number' },
            etapas: {
              type: 'array',
              description:
                'Obligatorio y no vacio cuando tipo_producto es "Producto Terminado": plan de etapas ' +
                '(ids de cat_tipos_etapa, en el orden en que deben cumplirse) que el producto debe completar ' +
                'antes de poder finalizar un proceso de produccion.',
              items: { type: 'integer' },
              example: [1, 2, 3],
            },
          },
        },
        ProductoEtapaRequerida: {
          type: 'object',
          properties: {
            id_requisito: { type: 'integer' },
            id_producto: { type: 'integer' },
            id_tipo_etapa: { type: 'integer' },
            nombre_etapa: { type: 'string' },
            orden: { type: 'integer' },
          },
        },
        Vehiculo: {
          type: 'object',
          properties: {
            id_vehiculo: { type: 'integer' },
            placa: { type: 'string' },
            modelo: { type: 'string' },
            estado: { type: 'string', enum: ['Disponible', 'En Ruta', 'Mantenimiento'] },
            kilometraje_actual: { type: 'number' },
            estado_registro: { type: 'string', enum: ['Activo', 'Inactivo'] },
          },
        },
        VehiculoInput: {
          type: 'object',
          required: ['placa'],
          properties: {
            placa: { type: 'string' },
            modelo: { type: 'string' },
            estado: { type: 'string', enum: ['Disponible', 'En Ruta', 'Mantenimiento'] },
            kilometraje_actual: { type: 'number' },
          },
        },
        TipoEtapa: {
          type: 'object',
          properties: {
            id_tipo_etapa: { type: 'integer' },
            nombre_etapa: { type: 'string' },
            descripcion: { type: 'string' },
            estado_registro: { type: 'string', enum: ['Activo', 'Inactivo'] },
          },
        },
        TipoMerma: {
          type: 'object',
          properties: {
            id_tipo_merma: { type: 'integer' },
            nombre_merma: { type: 'string' },
            descripcion: { type: 'string' },
            estado_registro: { type: 'string', enum: ['Activo', 'Inactivo'] },
          },
        },
        CuartoFrio: {
          type: 'object',
          properties: {
            id_cuarto_frio: { type: 'integer' },
            nombre_cuarto: { type: 'string' },
            descripcion: { type: 'string' },
            estado_registro: { type: 'string', enum: ['Activo', 'Inactivo'] },
          },
        },
        ProcesoProduccion: {
          type: 'object',
          properties: {
            id_proceso: { type: 'integer' },
            id_sublote: { type: 'integer' },
            id_producto_resultado: { type: 'integer' },
            id_orden: { type: 'integer', nullable: true },
            cantidad_ingresada_kg: { type: 'number' },
            cantidad_producida_kg: { type: 'number', nullable: true },
            rendimiento_porcentaje: { type: 'number', nullable: true },
            estado_proceso: { type: 'string', enum: ['En proceso', 'Pausado', 'Finalizado'] },
            fecha_inicio: { type: 'string', format: 'date-time' },
            fecha_fin: { type: 'string', format: 'date-time', nullable: true },
            etapas: { type: 'array', items: { $ref: '#/components/schemas/EtapaProduccion' } },
            mermas: { type: 'array', items: { type: 'object' } },
            insumos: { type: 'array', items: { type: 'object' } },
          },
        },
        ProcesoProduccionInput: {
          type: 'object',
          required: ['id_sublote', 'id_producto_resultado', 'cantidad_ingresada_kg'],
          properties: {
            id_sublote: {
              type: 'integer',
              description:
                'Debe estar "Listo para produccion", o "Activo" con estado_maduracion "Verde" (empaque en red).',
            },
            id_producto_resultado: { type: 'integer' },
            id_orden: { type: 'integer', nullable: true },
            cantidad_ingresada_kg: { type: 'number' },
            fecha_inicio: { type: 'string', format: 'date-time' },
            cuarto_congelado: { type: 'string' },
            ubicacion_cuarto_congelado: { type: 'string' },
            observaciones: { type: 'string' },
          },
        },
        EtapaProduccion: {
          type: 'object',
          properties: {
            id_etapa: { type: 'integer' },
            id_proceso: { type: 'integer' },
            id_tipo_etapa: { type: 'integer' },
            nombre_etapa: { type: 'string' },
            cantidad_personas: { type: 'integer' },
            personal_asignado: { type: 'string' },
            fecha_inicio: { type: 'string', format: 'date-time' },
            fecha_fin: { type: 'string', format: 'date-time', nullable: true },
            cantidad_entrada_kg: { type: 'number', nullable: true },
            cantidad_salida_kg: { type: 'number', nullable: true },
            merma_kg: { type: 'number', nullable: true },
            cajas: {
              type: 'array',
              description: 'Desglose opcional de cajas (empaque en red): cantidad de redes y peso por caja.',
              items: {
                type: 'object',
                properties: {
                  id_detalle: { type: 'integer' },
                  cantidad_redes: { type: 'integer' },
                  peso_kg: { type: 'number' },
                },
              },
            },
          },
        },
        EtapaProduccionInput: {
          type: 'object',
          required: ['id_tipo_etapa', 'cantidad_personas', 'fecha_inicio'],
          properties: {
            id_tipo_etapa: {
              type: 'integer',
              description: 'Debe pertenecer al plan de etapas del producto, si el producto tiene uno definido.',
            },
            cantidad_personas: { type: 'integer' },
            personal_asignado: { type: 'string' },
            fecha_inicio: { type: 'string', format: 'date-time' },
            cantidad_entrada_kg: { type: 'number' },
            observaciones: { type: 'string' },
            cajas: {
              type: 'array',
              description: 'Opcional: desglose de cajas para esta etapa (empaque en red).',
              items: {
                type: 'object',
                required: ['cantidad_redes', 'peso_kg'],
                properties: {
                  cantidad_redes: { type: 'integer' },
                  peso_kg: { type: 'number' },
                },
              },
            },
          },
        },
        FinalizarProcesoInput: {
          type: 'object',
          required: ['cantidad_producida_kg', 'fecha_fin', 'fecha_vencimiento'],
          properties: {
            cantidad_producida_kg: { type: 'number' },
            fecha_fin: { type: 'string', format: 'date-time' },
            fecha_vencimiento: { type: 'string', format: 'date' },
            observaciones: { type: 'string' },
            justificacion_diferencia: {
              type: 'string',
              description: 'Obligatoria si la diferencia entre ingresado-mermas y producido supera la tolerancia.',
            },
          },
          description:
            'El costo unitario del lote se toma del precio de venta sugerido del producto, y la ubicacion de ' +
            'cuarto frio de los ingresos ya registrados en "Registrar cuarto frio": ninguno de los dos se envia aqui.',
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Autenticacion', description: 'Login (publico, sin token)' },
      { name: 'Usuarios', description: 'Solo Administrador' },
      { name: 'Proveedores', description: 'Administrador, Produccion, Logistica' },
      { name: 'Clientes', description: 'Administrador, Logistica' },
      { name: 'Entradas de Mercancia', description: 'Administrador, Produccion, Logistica' },
      { name: 'Maduracion', description: 'Administrador, Produccion, Logistica' },
      { name: 'Produccion', description: 'Administrador, Produccion' },
      { name: 'Redes Verdes', description: 'Historico de empaque en red previo a su unificacion con Produccion' },
      { name: 'Productos', description: 'Administrador, Produccion, Logistica' },
      { name: 'Inventario', description: 'Administrador, Produccion, Logistica' },
      { name: 'Tipos de Servicio', description: 'Administrador, Logistica' },
      { name: 'Vehiculos', description: 'Catalogo de vehiculos' },
      { name: 'Servicios de Vehiculo', description: 'Administrador, Logistica' },
      { name: 'Reporte Kilometraje Vehiculo', description: 'Administrador, Logistica, Piloto' },
      { name: 'Pedidos', description: 'Administrador, Logistica, Piloto' },
      { name: 'Rutas', description: 'Administrador, Logistica, Piloto' },
      { name: 'Devoluciones', description: 'Administrador, Logistica, Piloto, Produccion' },
      { name: 'Auditoria', description: 'Solo Administrador' },
      { name: 'Trazabilidad', description: 'Administrador, Produccion, Logistica' },
    ],
  },
  apis: ['./src/routes/*.js'],
};

module.exports = swaggerJsdoc(options);
