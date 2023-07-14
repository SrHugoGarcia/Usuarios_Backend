const User = require('../models/User');
const AppError = require('../utils/AppError')
const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const catchAsync = require('../utils/catchAsync');
const { Email } = require('../utils/email');
const crypto = require('crypto');

const signToken = id =>{
    return jwt.sign({id: id},process.env.JWT_SECRET,{
        expiresIn: process.env.JWT_EXPIRE_IN
    });
}

const createSendToken =(user,statusCode,req,res)=>{
    const token = signToken(user._id);
    const cookieOptions ={
        expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES_IN *24 *60 *60*1000),
        secure:  req.secure || req.headers['x-forwarded-proto'] === 'https', 
        httpOnly: true,
    }
    user.contraseña = undefined;
    res.cookie('jwt',token,cookieOptions);

    res.status(statusCode).json({
        status: "successful",
        token,
        data: {
            user
        },
        checkToken:true
    })
}

const registro = catchAsync(async(req,res,next)=>{   
    const newUser= await User.create({
        nombre : req.body.nombre,
        apellidos : req.body.apellidos,
        correo : req.body.correo,
        contraseña : req.body.contraseña,
        confirmarContraseña : req.body.confirmarContraseña,
        confirmar:true,
        contraseñaActualizadaAt: req.body.contraseñaActualizadaAt,
    });

    createSendToken(newUser,201,req,res);
});

const login =catchAsync(async(req,res,next)=>{
    const {correo, contraseña}= req.body;
    if(!correo || !contraseña){
        return next(new AppError("Porfavor ingrese un correo y contraseña",400))
    }
    const user = await User.findOne({correo}).select('+contraseña   -__v -contraseñaActualizadaAt -contraseñaResetExpires -contraseñaResetToken');
    if(!user || !await user.correctaContraseña(contraseña, user.contraseña)){
        return next(new AppError("Email o password incorrecto ",401))
    }
    if(user.confirmar == false){
        return next(new AppError("Tu cuenta no ha sido confirmada",401))
    }
    createSendToken(user,200,req,res);
})

const cerrarSesion =(req,res)=>{
    res.cookie('jwt', 'CerrarSesion',{
        expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES_IN *24 *60 *60*1000),
        secure:  req.secure || req.headers['x-forwarded-proto'] === 'https', 
        httpOnly: true,
    });
    res.status(200).json({status: 'successful'});
};

const protect =catchAsync(async(req,res,next)=>{
    let token;
        if(req.headers.authorization && req.headers.authorization.startsWith("Bearer")){
            token = req.headers.authorization.split(" ")[1];
        }else if(req.cookies.jwt){
            token = req.cookies.jwt;
        }
    if(!token) return next(new AppError("Tu no has iniciado sesion, porfavor inicia sesion para obtener el acceso",401));
    const decoded = await promisify(jwt.verify)(token,process.env.JWT_SECRET);
    const user = await User.findById(decoded.id)
    if(!user) return next(new AppError("el usuario que pertenece a este token ya no existe",404));
    if(user.actualizoContraseñaDespues(decoded.iat)){
        return next(new AppError("El usuario recientemente actualizo su contraseña. porfavor vuelva a iniciar sesion",401));
    }
    req.user = user;
    next();

})

const restrictTo =(...roles)=>{
    return (req,res,next)=>{
        if(!roles.includes(req.user.role)){
            return next(new AppError("No tienes los permisos para realizar esta accion",403))
        }
        next();
    }
}

const olvideContraseña =catchAsync( async(req,res,next)=>{
        const {correo} = req.body;
        const user =await User.findOne({correo});
        if(!user) return next(new AppError("El correo electronico no pertence a ningun usuario",404));
        const resetToken = user.createContraseñaResetToken();
        await user.save({validateBeforeSave:false});
    try{
        const resetUrl = `${process.env.FRONTEND_URL}/olvide-password/${resetToken}`
        await new Email(user,resetUrl).sendPaswordReset();
        res.status(200).json({
            status: "successful",
            message: "Token enviado al correo electronico"
        })
    }catch(err){
        user.contraseñaResetToken = undefined;
        user.contraseñaResetExpires = undefined;
        await user.save({validateBeforeSave:false});
        return next(new AppError("Hubo un error al enviar el correo electronico.Vuelve a intentarlo mas tarde",500))
    }
    
});

const restablecerContraseña =catchAsync(async(req,res,next)=>{
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex')
    const user = await User.findOne({contraseñaResetToken: hashedToken, contraseñaResetExpires: {$gt: Date.now()}})
    if(!user) {
        return next(new AppError("El token no es valido o ha caducado",400));
    }
    const contraseña = req.body.contraseña;
    const confirmarContraseña = req.body.confirmarContraseña;
    user.contraseña = contraseña;
    user.confirmarContraseña = confirmarContraseña;
    user.contraseñaResetToken = undefined;
    user.contraseñaResetExpires = undefined;
    await user.save();
     createSendToken(user,200,req,res);
});


const actualizarContraseña = catchAsync(async(req,res,next)=>{
    const user = await User.findById(req.user.id).select('contraseña');
    const contraseñaCurrent = req.body.contraseñaCurrent;
    if(!await user.correctaContraseña(contraseñaCurrent,user.contraseña)){
        return next(new AppError("Las contraseña es incorrecta",401));
    }
    const contraseña= req.body.contraseña;
    const confirmarContraseña = req.body.confirmarContraseña;
    user.contraseña = contraseña
    user.confirmarContraseña = confirmarContraseña;
    await user.save();
    createSendToken(user,200,req,res);
    
});

module.exports = {registro, login,cerrarSesion ,protect, restrictTo, olvideContraseña, restablecerContraseña, actualizarContraseña};