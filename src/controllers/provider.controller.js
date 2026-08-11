const providerModel = require('../models/provider.model');

const parseId = (value) => Number.parseInt(value, 10);

const getProviders = async (_req, res, next) => {
  try {
    const providers = await providerModel.findAll();
    return res.status(200).json(providers);
  } catch (error) {
    return next(error);
  }
};

const getProviderById = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const provider = await providerModel.findById(id);

    if (!provider) {
      return res.status(404).json({ message: 'Proveedor no encontrado' });
    }

    return res.status(200).json(provider);
  } catch (error) {
    return next(error);
  }
};

const createProvider = async (req, res, next) => {
  try {
    const { nombre_empresa, nit, contacto_nombre, telefono } = req.body;

    if (!nombre_empresa) {
      return res.status(400).json({ message: 'nombre_empresa es obligatorio' });
    }

    const newProvider = await providerModel.create({
      nombre_empresa,
      nit,
      contacto_nombre,
      telefono,
      id_usuario_modificacion: req.auth?.sub ?? null,
    });

    return res.status(201).json(newProvider);
  } catch (error) {
    return next(error);
  }
};

const updateProvider = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const { nombre_empresa, nit, contacto_nombre, telefono } = req.body;

    if (!nombre_empresa) {
      return res.status(400).json({ message: 'nombre_empresa es obligatorio' });
    }

    const updatedProvider = await providerModel.update(id, {
      nombre_empresa,
      nit,
      contacto_nombre,
      telefono,
      id_usuario_modificacion: req.auth?.sub ?? null,
    });

    if (!updatedProvider) {
      return res.status(404).json({ message: 'Proveedor no encontrado' });
    }

    return res.status(200).json(updatedProvider);
  } catch (error) {
    return next(error);
  }
};

const deleteProvider = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const deleted = await providerModel.remove(id, req.auth?.sub ?? null);

    if (!deleted) {
      return res.status(404).json({ message: 'Proveedor no encontrado' });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getProviders,
  getProviderById,
  createProvider,
  updateProvider,
  deleteProvider,
};
