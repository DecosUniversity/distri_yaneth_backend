const { getJwtSecret, MIN_SECRET_LENGTH } = require('../../src/config/auth');

describe('getJwtSecret', () => {
  const original = process.env.JWT_SECRET;

  afterEach(() => {
    process.env.JWT_SECRET = original;
  });

  it('devuelve la clave configurada cuando es valida', () => {
    process.env.JWT_SECRET = 'x'.repeat(MIN_SECRET_LENGTH);
    expect(getJwtSecret()).toBe('x'.repeat(MIN_SECRET_LENGTH));
  });

  it('falla si JWT_SECRET no esta definido (no hay clave por defecto)', () => {
    delete process.env.JWT_SECRET;
    expect(() => getJwtSecret()).toThrow(/no esta definido/);
  });

  it('rechaza los valores de ejemplo conocidos', () => {
    for (const placeholder of ['super-secret-change-me', 'dev-secret-change-me']) {
      process.env.JWT_SECRET = placeholder;
      expect(() => getJwtSecret()).toThrow(/valor de ejemplo/);
    }
  });

  it('rechaza claves demasiado cortas', () => {
    process.env.JWT_SECRET = 'x'.repeat(MIN_SECRET_LENGTH - 1);
    expect(() => getJwtSecret()).toThrow(/al menos/);
  });
});
