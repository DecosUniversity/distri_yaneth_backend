const normalizeNullableText = (value) => (value === undefined || value === null || value === '' ? null : value);

module.exports = {
  normalizeNullableText,
};
