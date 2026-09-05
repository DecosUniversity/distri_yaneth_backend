const clientModel = require('../models/client.model');

const parseId = (value) => Number.parseInt(value, 10);
const normalizeRequiredText = (value) => (typeof value === 'string' ? value.trim() : value);

const getClients = async (_req, res, next) => {
  try {
    const clients = await clientModel.findAll();
    return res.status(200).json(clients);
  } catch (error) {
    return next(error);
  }
};

const getClientById = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const client = await clientModel.findById(id);

    if (!client) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }

    return res.status(200).json(client);
  } catch (error) {
    return next(error);
  }
};

const createClient = async (req, res, next) => {
  try {
    const { nombre_comercial, departamento, municipio, zona, direccion_entrega, telefono, nit_facturacion } = req.body;
    const normalizedNombreComercial = normalizeRequiredText(nombre_comercial);

    if (!normalizedNombreComercial) {
      return res.status(400).json({ message: 'nombre_comercial es obligatorio' });
    }

    const newClient = await clientModel.create({
      nombre_comercial: normalizedNombreComercial,
      departamento,
      municipio,
      zona,
      direccion_entrega,
      telefono,
      nit_facturacion,
      id_usuario_modificacion: req.auth?.sub ?? null,
    });

    return res.status(201).json(newClient);
  } catch (error) {
    return next(error);
  }
};

const updateClient = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const { nombre_comercial, departamento, municipio, zona, direccion_entrega, telefono, nit_facturacion } = req.body;
    const normalizedNombreComercial = normalizeRequiredText(nombre_comercial);

    if (!normalizedNombreComercial) {
      return res.status(400).json({ message: 'nombre_comercial es obligatorio' });
    }

    const updatedClient = await clientModel.update(id, {
      nombre_comercial: normalizedNombreComercial,
      departamento,
      municipio,
      zona,
      direccion_entrega,
      telefono,
      nit_facturacion,
      id_usuario_modificacion: req.auth?.sub ?? null,
    });

    if (!updatedClient) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }

    return res.status(200).json(updatedClient);
  } catch (error) {
    return next(error);
  }
};

const deleteClient = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const deleted = await clientModel.remove(id, req.auth?.sub ?? null);

    if (!deleted) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
};
