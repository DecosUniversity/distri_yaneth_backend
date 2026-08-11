const { enqueueDbJob } = require('../queues/db.queue');

const findAll = async () => {
  return enqueueDbJob('users.findAll', {});
};

const findById = async (id) => {
  return enqueueDbJob('users.findById', { id });
};

const findByUsername = async (username) => {
  return enqueueDbJob('users.findByUsername', { username });
};

const create = async ({ nombre_completo, username, password_hash, rol, estado_registro, id_usuario_modificacion }) => {
  return enqueueDbJob('users.create', {
    nombre_completo,
    username,
    password_hash,
    rol,
    estado_registro,
    id_usuario_modificacion,
  });
};

const update = async (id, { nombre_completo, username, password_hash, rol, estado_registro, id_usuario_modificacion }) => {
  return enqueueDbJob('users.update', {
    id,
    nombre_completo,
    username,
    password_hash,
    rol,
    estado_registro,
    id_usuario_modificacion,
  });
};

const resetPassword = async (id, password_hash, id_usuario_modificacion) => {
  return enqueueDbJob('users.resetPassword', {
    id,
    password_hash,
    id_usuario_modificacion,
  });
};

const remove = async (id, id_usuario_modificacion) => {
  return enqueueDbJob('users.remove', { id, id_usuario_modificacion });
};

module.exports = {
  findAll,
  findById,
  findByUsername,
  create,
  update,
  resetPassword,
  remove,
};
