const nodemailer = require('nodemailer');
const pug = require('pug');
const htmlToText = require('html-to-text');

class Email{
    constructor(user,url){
        this.to = user.correo;
        this.firstName = user.nombre.split(' ')[0];
        this.url = url
        this.from =`IKTAN STRATEGIES <${process.env.EMAIL_FROM}>`
    }
    newTransport(){
        if(process.env.NODE_ENV === 'production'){
            //Sendgrid
            return nodemailer.createTransport({
                service: 'SendGrid',
                auth: {
                    user: process.env.SENDGRID_USERNAME,
                    pass: process.env.SENDGRID_PASSWORD
                }
            })
        }
        return nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            auth: {
                user: process.env.EMAIL_USERNAME,
                pass: process.env.EMAIL_PASSWORD
            }
    
        })
    }

    async send(template,tema){
        //1)Renderizar el html para le correo basado en una plantilla pug
        const html = pug.renderFile(`${__dirname}/../views/email/${template}.pug`,{
            firstName: this.firstName,
            url: this.url,
            subject: tema
        });
        //2)Opciones de correo
        const opcionesEmail = {
            from: this.from,
            to: this.to,
            subject: tema,
            html,
            text: htmlToText.convert(html,{wordwrap: 130})

        }
        //3)Crear un tranporte y se envie el email
        await this.newTransport().sendMail(opcionesEmail)
    }
    async sendConfirmarCuenta(){
        await this.send('confirmarToken', 'Tu cuenta ya esta casi lista')
    }
    async sendWelcome(){
       await this.send('welcome', 'Bienvenid@ a la familia de IKTAN TRAINING')
    }
    async sendPaswordReset(){
        await this.send('passwordReset', 'Su token de restablecimiento de contraseña(solo es valido por 10 minutos)')
    }
}







const enviarEmail = async opciones=>{
    //1)Crear transportador
    const transportador = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        auth: {
            user: process.env.EMAIL_USERNAME,
            pass: process.env.EMAIL_PASSWORD
        }
        //Activar en email la opcion aplicacion menos segura

    })
    //2)Definimos las opciones de correo
    const opcionesEmail = {
        from: "Victor Hugo Garcia Rodriguez <peke-vichugo900000@hotmail.com>",
        to: opciones.email,
        subject: opciones.subject,
        text: opciones.message,
        //html:
    }

    //3)Enviar email
    await transportador.sendMail(opcionesEmail)
}
module.exports = {enviarEmail, Email};