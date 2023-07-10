const express = require('express');
const cors = require('cors')

const morgan = require('morgan');
//Controla los errores a nivel global
const erroresGlobales = require('../controllers/errorController');

const userRoutes = require('../routes/userRoutes');

//Importamos el modulo que nos va a permitir si hay demasiadas solicitudes de una op bloquear las solicitudes
const  rateLimit = require('express-rate-limit')
//Importamos el modulo que va a manejar los encabezados HTTTP security
const helmet = require('helmet')
//Importamos el modulo que va a prevenir los sql inyection
const mongoSanitize = require('express-mongo-sanitize')
//Importamos el modulo que nos va a prevenir de los script maliciosos html
const xss = require('xss-clean');
//manejo de cookies del cliente al serv
const cookieParser = require('cookie-parser')
//Importamos la clase que va a manejar los errores globalmente

const AppError = require('../utils/AppError')
  
//Aqui unicamente a la variable app se le asignan todos los metodos de express
const app = express();
///////////////////////////////////GOLBAL MIDDLWARE///////////////////////////////////////////

//Seguridad en los encabezados, esta en espera ()
app.use(helmet());

if(process.env.NODE_ENV === 'development'){
    //nos da la informacion de la solicitud en consola
    app.use(morgan('dev'));
}
//Litiar cuantas solicitude spodemos recibir en un determinado tiempo
const limiter = rateLimit({
    //Cuantas solicitudes
    max: 1000,
    //En cuanto tiempo 1 hora
    windowMs:60 *60* 1000,
    message: "Demasiadas solicitudes de esta Ip, Porfavor intentelo en una hora"
})
//Afectara a todas las rutas que comienzen en /api
app.use('/api',limiter);

//Usamos un middelware para podamos analizar los datos que nos envia el cliente
//y podemos modificar los datos que nos envien
//PARA MAS FACIL DE ENTENER ESTE CODIGO NOS PERMITE USAR EL req.body
app.use(express.json({limit: '10kb'}));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());


//1)Desinfeccion de datos sql Inyection
app.use(mongoSanitize());
//2)Desinfeccion de datos scripts html malicioso
app.use(xss());


//NOTA AQUI SE APLICA A TODAS LAS RUTAS DEBIDO QUE ESTA EN EL INDEX
//Agregaremos un m middlware para saber la hora en que se realizan las peticiones
app.use((req,res,next) =>{
    req.requestTime = new Date().toISOString();
    next();
})
app.use(express.static(`${__dirname}/../public/servidor`))
/*
const whileList = ['http://127.0.0.1:3000',process.env.FRONTEND_URL];
const corsOptions = {
    origin: function (origin, callback) {
      if(whileList.includes(origin)){
        callback(null,true)
      }else{
        callback(new AppError("No tienes el acceso a la api",401))
      }
    },    
    credentials: true
  }
  ///img/cursos/
  //
app.use(cors(corsOptions)) */
app.use(express.static(`${__dirname}/../public/cliente`))

//Usamos el midelware de usuarios
app.use('/api/v1/users',userRoutes);

//Controlador para le manejo de errores de rutas(si no encuentra una ruta le mandara una respuesta)
app.all('*',(req,res,next)=>{

    next(new AppError(`No se encuentra ${req.originalUrl} en este servidor`,404))
})

//MANEJO DE ERRORES A NIVEL GLOBAL
app.use(erroresGlobales)
module.exports = app;
