const { Router } = require('express');
const userController = require('../controllers/user.controller');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth.middleware');

const router = Router();

router.post('/login', userController.login);

router.use(authenticateToken, authorizeRoles('Administrador'));

router.get('/', userController.getUsers);
router.get('/:id', userController.getUserById);
router.post('/', userController.createUser);
router.put('/:id', userController.updateUser);
router.patch('/:id/reset-password', userController.resetUserPassword);
router.delete('/:id', userController.deleteUser);

module.exports = router;
