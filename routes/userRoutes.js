//Modulo de terceros
const express = require('express');
//Modulo userController
const {createUser,allUsers,oneUser,updateUser,deleteUser, updateMe, deleteMe, getMe} = require('../controllers/userController')
const {registro,login,olvideContraseña,restablecerContraseña, protect,actualizarContraseña,
     restrictTo, cerrarSesion, comprobarToken } = require('../controllers/authController');
const router = express.Router();

//Autenticacion
router.route('/registro').post(registro);
router.route('/confirmar/:token').get(comprobarToken)
router.route('/login').post(login)
router.route('/cerrarSesion').get(cerrarSesion)
router.route('/olvidePassword').post(olvideContraseña);
router.route('/restablecerPassword/:token').patch(restablecerContraseña);

//Apartir de aqui las rutas de abajo deben de estar autenticadas un truco para que no pongamos en todos los metodos protect es el sigm router es una mini aplicacion
router.use(protect);
//Rutas para usuarios
router.route('/actualizarMiPassword').patch(actualizarContraseña);

router.route('/me').get(getMe,oneUser);
router.route('/updateMe').patch(updateMe);
router.route('/deleteMe').delete(deleteMe);

//Rutas solo para administradores
router.use(restrictTo('administrador'))
router.route('/').get(allUsers).post(createUser);
router.route('/:id').get(oneUser).patch(updateUser).delete(deleteUser);


module.exports = router;