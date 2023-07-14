const mongoose = require('mongoose');

const conexionDB =async ()=>{
    const db = process.env.DATABASE.replace('<PASSWORD>',process.env.DATABASE_PASSWORD);
    await  mongoose.connect(db,{
        useNewUrlParser: true,
        useUnifiedTopology: true,
    }).then(con=>{
        console.log("Conexion con la base de datos exitosa");
    })
   
}


module.exports = conexionDB;