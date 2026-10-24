const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/auth');

const authenticateToken = (req, res, next) => {
  const authorization = req.headers.authorization || '';
  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Token no proporcionado' });
  }

  try {
    const payload = jwt.verify(token, getJwtSecret());
    req.auth = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Token invalido o expirado' });
  }
};

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    const userRole = req.auth?.rol;

    if (!userRole) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    if (!roles.includes(userRole)) {
      return res.status(403).json({ message: 'No tienes permisos para este modulo' });
    }

    return next();
  };
};

module.exports = {
  authenticateToken,
  authorizeRoles,
};
