const { Router } = require('express');
const greenNetController = require('../controllers/green_net.controller');

const router = Router();

router.get('/', greenNetController.getRedes);
router.get('/sublote/:id_sublote', greenNetController.getRedesBySublote);
router.post('/', greenNetController.createRed);

module.exports = router;
