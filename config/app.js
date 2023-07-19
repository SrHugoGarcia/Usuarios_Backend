const express = require('express');
const cors = require('cors')
const morgan = require('morgan');
const erroresGlobales = require('../controllers/errorController');
const userRoutes = require('../routes/userRoutes');
const  rateLimit = require('express-rate-limit')
const helmet = require('helmet')
const mongoSanitize = require('express-mongo-sanitize')
const xss = require('xss-clean');
const cookieParser = require('cookie-parser')

const AppError = require('../utils/AppError')
  
const app = express();

app.use(helmet());

if(process.env.NODE_ENV === 'development'){
    app.use(morgan('dev'));
}
const limiter = rateLimit({
    //Cuantas solicitudes
    max: 1000,
    //En cuanto tiempo 1 hora
    windowMs:60 *60* 1000,
    message: "Demasiadas solicitudes de esta Ip, Porfavor intentelo en una hora"
})
app.use('/api',limiter);

app.use(express.json({limit: '10kb'}));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());


app.use(mongoSanitize());
app.use(xss());

app.use((req,res,next) =>{
    req.requestTime = new Date().toISOString();
    next();
})
app.use(express.static(`${__dirname}/../public/servidor`))

const whileList = [process.env.FRONTEND_URL];
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
app.use(cors(corsOptions)) 
app.use(express.static(`${__dirname}/../public/cliente`))

app.use('/api/v1/users',userRoutes);

app.all('*',(req,res,next)=>{

    next(new AppError(`No se encuentra ${req.originalUrl} en este servidor`,404))
})

app.use(erroresGlobales)
module.exports = app;
