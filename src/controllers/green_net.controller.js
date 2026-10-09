const greenNetModel = require('../models/green_net.model');

const parseId = (value) => Number.parseInt(value, 10);

// El empaque de redes se estandarizo dentro de Produccion ("+ Empacar red", que reutiliza
// productionProcesses.create/addStage con un desglose de `cajas`): ya no existe un endpoint
// para crear redes aqui. Este controlador solo sirve para consultar el historico previo a
// ese cambio.
const getRedes = async (_req, res, next) => {
  try {
    const redes = await greenNetModel.findAll();
    return res.status(200).json(redes);
  } catch (error) {
    return next(error);
  }
};

const getRedesBySublote = async (req, res, next) => {
  try {
    const idSublote = parseId(req.params.id_sublote);

    if (Number.isNaN(idSublote)) {
      return res.status(400).json({ message: 'id_sublote invalido' });
    }

    const redes = await greenNetModel.findBySublot(idSublote);
    return res.status(200).json(redes);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getRedes,
  getRedesBySublote,
};
