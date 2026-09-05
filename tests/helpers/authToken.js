const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

// Mismo payload que arma user.controller.js#login (sub, username, rol). Firmar el token
// directo evita depender del endpoint de login en cada prueba de otro dominio.
const signToken = ({ sub, username = 'test.user', rol }) => {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET no esta definido (revisa que tests/setup.js haya cargado .env.test)');
  }

  return jwt.sign({ sub, username, rol }, JWT_SECRET, { expiresIn: '1h' });
};

module.exports = {
  signToken,
};
