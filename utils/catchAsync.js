
//Va a sustituir los try catch para no repetir codigo
const catchAsync = recibefuncion =>{
    return (req,res,next) =>{
        recibefuncion(req,res,next).catch(next);
    }
}

module.exports = catchAsync;