// Clave con la que se firman y verifican los JWT. No hay valor por defecto: si falta o es
// debil, el servidor no arranca, para que nunca se firmen tokens con una clave conocida.
const MIN_SECRET_LENGTH = 32;
const KNOWN_PLACEHOLDERS = ['super-secret-change-me', 'dev-secret-change-me'];

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET no esta definido en las variables de entorno');
  }
  if (KNOWN_PLACEHOLDERS.includes(secret)) {
    throw new Error('JWT_SECRET usa el valor de ejemplo; genere una clave propia');
  }
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET debe tener al menos ${MIN_SECRET_LENGTH} caracteres`);
  }

  return secret;
};

module.exports = {
  getJwtSecret,
  MIN_SECRET_LENGTH,
};
