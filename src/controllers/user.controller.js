const userModel = require('../models/user.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const parseId = (value) => Number.parseInt(value, 10);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

const sanitizeUser = (user) => ({
  id_usuario: user.id_usuario,
  nombre_completo: user.nombre_completo,
  username: user.username,
  rol: user.rol,
  estado_registro: user.estado_registro,
  fecha_creacion: user.fecha_creacion,
  fecha_modificacion: user.fecha_modificacion,
  id_usuario_modificacion: user.id_usuario_modificacion,
  usuario_modificacion_nombre: user.usuario_modificacion_nombre,
});

const getUsers = async (_req, res, next) => {
  try {
    const users = await userModel.findAll();
    res.status(200).json(users.map(sanitizeUser));
  } catch (error) {
    next(error);
  }
};

const getUserById = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const user = await userModel.findById(id);

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    return res.status(200).json(sanitizeUser(user));
  } catch (error) {
    return next(error);
  }
};

const createUser = async (req, res, next) => {
  try {
    const { nombre_completo, username, password_hash, password, rol } = req.body;
    const rawPassword = password || password_hash;

    if (!nombre_completo || !username || !rawPassword || !rol) {
      return res.status(400).json({
        message: 'nombre_completo, username, password y rol son obligatorios',
      });
    }

    if (String(rawPassword).length < 6) {
      return res.status(400).json({ message: 'La password debe tener al menos 6 caracteres' });
    }

    const hashedPassword = await bcrypt.hash(String(rawPassword), 10);

    const newUser = await userModel.create({
      nombre_completo,
      username,
      password_hash: hashedPassword,
      rol,
      id_usuario_modificacion: req.auth?.sub ?? null,
    });
    return res.status(201).json(sanitizeUser(newUser));
  } catch (error) {
    return next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const { nombre_completo, username, password_hash, rol } = req.body;

    if (!nombre_completo || !username || !password_hash || !rol) {
      return res.status(400).json({
        message: 'nombre_completo, username, password_hash y rol son obligatorios',
      });
    }

    const updatedUser = await userModel.update(id, {
      nombre_completo,
      username,
      password_hash,
      rol,
      id_usuario_modificacion: req.auth?.sub ?? null,
    });

    if (!updatedUser) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    return res.status(200).json(sanitizeUser(updatedUser));
  } catch (error) {
    return next(error);
  }
};

const resetUserPassword = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const { new_password } = req.body;

    if (!new_password || String(new_password).length < 6) {
      return res
        .status(400)
        .json({ message: 'new_password es obligatoria y debe tener al menos 6 caracteres' });
    }

    const hashedPassword = await bcrypt.hash(String(new_password), 10);
    const updatedUser = await userModel.resetPassword(id, hashedPassword, req.auth?.sub ?? null);

    if (!updatedUser) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    return res.status(200).json({
      message: 'Password restablecida correctamente',
      user: sanitizeUser(updatedUser),
    });
  } catch (error) {
    return next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID invalido' });
    }

    const deleted = await userModel.remove(id, req.auth?.sub ?? null);

    if (!deleted) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'username y password son obligatorios' });
    }

    const user = await userModel.findByUsername(username);

    if (!user) {
      return res.status(401).json({ message: 'Credenciales invalidas' });
    }

    const passwordMatches =
      (await bcrypt.compare(password, user.password_hash).catch(() => false)) ||
      password === user.password_hash;

    if (!passwordMatches) {
      return res.status(401).json({ message: 'Credenciales invalidas' });
    }

    const token = jwt.sign(
      {
        sub: user.id_usuario,
        username: user.username,
        rol: user.rol,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(200).json({
      message: 'Sesion iniciada',
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  resetUserPassword,
  deleteUser,
  login,
};
