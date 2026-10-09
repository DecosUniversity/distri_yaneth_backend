const parseId = (value) => Number.parseInt(value, 10);

// Valida el arreglo de id_tipo_etapa que define la receta/plan de un producto terminado.
// `requireNonEmpty`: si es true, un arreglo vacio tambien se considera invalido (usado al
// crear un producto terminado, donde el plan es obligatorio desde el inicio).
const validateEtapasPayload = (etapas, { requireNonEmpty = false } = {}) => {
  if (!Array.isArray(etapas)) {
    return 'etapas debe ser un arreglo de id_tipo_etapa';
  }

  if (requireNonEmpty && etapas.length === 0) {
    return 'Debes definir al menos una etapa en el plan de proceso del producto';
  }

  for (const value of etapas) {
    const id = parseId(value);

    if (Number.isNaN(id) || id <= 0) {
      return 'Cada etapa debe tener un id_tipo_etapa valido';
    }
  }

  const uniqueIds = new Set(etapas.map((value) => parseId(value)));

  if (uniqueIds.size !== etapas.length) {
    return 'No puedes repetir la misma etapa en la receta';
  }

  return null;
};

module.exports = {
  parseId,
  validateEtapasPayload,
};
