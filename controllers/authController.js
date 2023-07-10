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
    //Las cookies sirven para que el navegador no pueda modicar ni acceder a la cookie que mandaremos
    //Un cookie es un pequeño fragmento de texto
    const cookieOptions ={
        //Fecha en milisegundos
        expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES_IN *24 *60 *60*1000),
        //La cookie solo se va a enviar si se usa el protocolo https
        secure:  req.secure || req.headers['x-forwarded-proto'] === 'https', 
        //La almacena y luego la envia en cada solicitud
        httpOnly: true,
    }
    user.contraseña = undefined;
    res.cookie('jwt',token,cookieOptions);
    res.cookie('checkToken', true, {
        secure:  req.secure || req.headers['x-forwarded-proto'] === 'https', 
        expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES_IN *24 *60 *60*1000),
      }) 

    //console.log(res)
    res.status(statusCode).json({
        status: "successful",
        token,
        data: {
            user
        }
    })
}

const comprobarToken = async (req, res,next) => {
    const { token } = req.params
    const user = await User.findOne({ token });
    if(!user) return next(new AppError('Invalido Token',400));
    
    user.confirmar = true;
    user.token = '';
    await User.findByIdAndUpdate(user.id,user);
    const url = `http://127.0.0.1:5173/panel-user/actualizar-perfil`;
    await new Email(user,url).sendWelcome()
    res.status(200).json({status: 'successful'});
};

const registro = catchAsync(async(req,res,next)=>{   
    //La mejores practicas es que nunca debemos de mandar tal cual el body como no lo mandan
    //Siempre tenemos que especificar cada apartado por seguridad
    const newUser= await User.create({
        nombre : req.body.nombre,
        apellidos : req.body.apellidos,
        correo : req.body.correo,
        contraseña : req.body.contraseña,
        confirmarContraseña : req.body.confirmarContraseña,
        contraseñaActualizadaAt: req.body.contraseñaActualizadaAt,
    });
    //La url del usuario en donde va a cambiar su foto de perfil
    //const url = `${req.protocol}://${req.get('host')}/me`;
    const url = `${process.env.FRONTEND_URL}/confirmar/${newUser.token}`;
    //console.log(url)
    await new Email(newUser,url).sendConfirmarCuenta();
//(Carga util, la palabra secreta)
//La palabra secreta no debe de ser corta, minimo debe de tener 30 caracteres y 2 especiales
    createSendToken(newUser,201,req,res);
});

const login =catchAsync(async(req,res,next)=>{
    const {correo, contraseña}= req.body;
    //1) verificar si existe email y la contraseña
    if(!correo || !contraseña){
        return next(new AppError("Porfavor ingrese un correo y contraseña",400))
    }

    //2)Verificar si el correo y la contraseña son correctos
    const user = await User.findOne({correo}).select('+contraseña   -__v -contraseñaActualizadaAt -contraseñaResetExpires -contraseñaResetToken');
    if(!user || !await user.correctaContraseña(contraseña, user.contraseña)){
        return next(new AppError("Incorrecto email o password",401))
    }
    if(user.confirmar == false){
        return next(new AppError("Tu cuenta no ha sido confirmada",401))
    }
    //Enviar un JWT al cliente
    createSendToken(user,200,req,res);
})

const cerrarSesion =(req,res)=>{
    res.cookie('jwt', 'CerrarSesion',{
        expires: new Date(Date.now() +10 * 1000),
        httpOnly: true
    });
    res.status(200).json({status: 'successful'});
};

//Protejemos nuestras rutas, verificando su la persona es un usuario
const protect =catchAsync(async(req,res,next)=>{
    let token;
    //1)Traer el token y verificar si existe
    //startsWith significa si comienza con Bearer
        //console.log(req.cookies)
        if(req.headers.authorization && req.headers.authorization.startsWith("Bearer")){
            token = req.headers.authorization.split(" ")[1];
        }else if(req.cookies.jwt){
           // console.log(token)
            token = req.cookies.jwt;
           // console.log(req.cookie)
            //console.log(token)

        }
    if(!token) return next(new AppError("Tu no has iniciado sesion, porfavor inicia sesion para obtener el acceso",401));
    //2) Verificar si el token es valido
    const decoded = await promisify(jwt.verify)(token,process.env.JWT_SECRET);
    
    //3) Verificar si el usuario existe
    const user = await User.findById(decoded.id)
    if(!user) return next(new AppError("el usuario que pertenece a este token ya no existe",404));
    //4) Verificar si el usuario cambio la contraseña despues de que se genero el token
    if(user.actualizoContraseñaDespues(decoded.iat)){
        return next(new AppError("El usuario recientemente actualizo su contraseña. porfavor vuelva a iniciar sesion",401));
    }
    //ACCESO A LA RUTA
    req.user = user;
    next();

})

//Restringir acceso
const restrictTo =(...roles)=>{
    return (req,res,next)=>{
        //roles ["admin", "lead-guide"]
        if(!roles.includes(req.user.role)){
            return next(new AppError("No tienes los permisos para realizar esta accion",403))
        }
        next();
    }
}

const olvideContraseña =catchAsync( async(req,res,next)=>{
    //1) Obtener el usuario con el post email
        const {correo} = req.body;
        const user =await User.findOne({correo});
        if(!user) return next(new AppError("El correo electronico no pertence a ningun usuario",404));
    //2)Generar un token aleatorio
        const resetToken = user.createContraseñaResetToken();
        //Desactiva todos lod validadores de nuestro schema
        await user.save({validateBeforeSave:false});
    //3)Enviar al usuario un email
    //SE CAMBIARA CUANDO YA TENGAMOS EL FRONT Y Se colocar el del front el link solo le anidaremos el token
    //const resetUrl = `${req.protocol}://${req.get("host")}//api/v1/users/resetPassword/${resetToken}`
    /*const message = `¿Olvidaste tu contraseña? Enviamos una solicitud de actualizacion con su nueva contraseña, confirme
    su password en el siguiente link ${resetUrl}\n Si no olvido su contraseña ignore este mensaje`; */

    try{
        /*
        await enviarEmail({
            email: user.correo,
            subject: "Su token de restablecimiento de contraseña(Valido para 10 minutos)",
            message
        })*/
        const resetUrl = `http://127.0.0.1:5173/olvide-password/${resetToken}`
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
    //1)Obtener el usuario segun el token
    //El token que esta en la database esta encriptafo entonces vamos a encriptar el token que le mandamso al usuario para compararlos
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex')
    const user = await User.findOne({contraseñaResetToken: hashedToken, contraseñaResetExpires: {$gt: Date.now()}})
    //2) Establecer la nueva constraseña solo si el token no ha espirado
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
    //3)Actualizar la propiedad contraseñaActualizadaAt para el usuario actual

    //4)Iniciar sesion enviando el JWT al cliente
     //Enviar un JWT al cliente
     createSendToken(user,200,req,res);
});
//Actualizar contraseña sin que la halla olvidado esta funcion puede estar cuando se loge
const actualizarContraseña = catchAsync(async(req,res,next)=>{
    //Como seguridad siempre que el usuario quiera cambiar la contraseña debemos de pedirsela
    //1)Obtener el usuario de la collection
    const user = await User.findById(req.user.id).select('contraseña');
    //2)Verificar si la contraseña publicada es correcta
    const contraseñaCurrent = req.body.contraseñaCurrent;
    if(!await user.correctaContraseña(contraseñaCurrent,user.contraseña)){
        return next(new AppError("Las contraseña es incorresta",401));
    }

    //3)Actualizar el password
    const contraseña= req.body.contraseña;
    const confirmarContraseña = req.body.confirmarContraseña;
    user.contraseña = contraseña
    user.confirmarContraseña = confirmarContraseña;
    await user.save();
    //4) Volver a iniciar sesion y enviar el JWT
    /*
    const token = signToken(user.id)
    res.status(200).json({
        status: "successful",
        token
    }) */
    createSendToken(user,200,req,res);
    
});

module.exports = {registro, login,cerrarSesion ,protect, restrictTo, olvideContraseña, restablecerContraseña, actualizarContraseña,comprobarToken};