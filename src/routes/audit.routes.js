const { Router } = require('express');
const auditController = require('../controllers/audit.controller');

const router = Router();

router.get('/', auditController.getAuditRecords);
router.get('/tablas', auditController.getAuditTables);

module.exports = router;
