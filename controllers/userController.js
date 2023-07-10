const User = require('../models/User');
const catchAsync = require('../utils/catchAsync');
//const APIFeature = require('../utils/apiFeature');
const AppError = require('../utils/AppError');
const { deleteOne, updateOne, getOne, getAll } = require('../controllers/handleFactory')
//Modulo para la carga de archivos desde el cliente al servidor

const filtrarObj = (obj, ...parametrosPermitidos) => {
    const newObj = {};
    Object.keys(obj).forEach(el => {
        if (parametrosPermitidos.includes(el)) newObj[el] = obj[el]
    });
    return newObj;
}


const updateMe = catchAsync(async (req, res, next) => {
    //1)Crear un error si el usuario intenta actualizar su contraseña
    const contraseña = req.body.contraseña;
    const confirmarContraseña = req.body.confirmarContraseña;
    if (contraseña || confirmarContraseña) {
        return next(new AppError("Esta ruta no es para actualizar contraseñas.Porfavor use /actualizarMiPassword", 400))
    }
    //2)Actualizar documento
    //New: true actualiza el nuevo documento con la informacion que le vamos a pasar
    const filtrarBody = filtrarObj(req.body, "correo", "nombre", "apellidos");
    if (req.file) filtrarBody.photo = req.file.filename;
    const updateUser = await User.findByIdAndUpdate(req.user.id, filtrarBody,
        { new: true, runValidators: true })
    res.status(200).json({
        status: "successful",
        data: {
            user: updateUser
        }
    })
});


const deleteMe = catchAsync(async (req, res, next) => {
    await User.findByIdAndUpdate(req.user.id, { activo: false });
    res.status(204).json({
        status: "successful",
        data: null
    })
});

const getMe = (req, res, next) => {
    req.params.id = req.user.id;
    next();
}

const createUser = catchAsync(async (req, res, next) => {
    res.status(200).json({
        message: "Este ruta no esta disponible, Porfavor use la ruta de users/registro"
    })
});

const allUsers = getAll(User);

const oneUser = getOne(User);

const updateUser = updateOne(User);

const deleteUser = deleteOne(User);

module.exports = {
    createUser, oneUser, allUsers, deleteUser, updateUser, updateMe, deleteMe, getMe
};