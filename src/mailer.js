const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'tu-correo@gmail.com',
    pass: process.env.EMAIL_PASS || 'tu-password-de-app'
  }
});

async function sendAppointmentEmail({ doctorEmail, doctorName, patientName, date, time, treatment }) {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER || 'tu-correo@gmail.com',
      to: doctorEmail,
      subject: 'Nueva cita registrada',
      html: `
        <h2>Nueva cita agendada</h2>
        <p>Estimado/a ${doctorName},</p>
        <p>Se ha registrado una nueva cita en el sistema.</p>
        <ul>
          <li>Paciente: ${patientName}</li>
          <li>Fecha: ${date}</li>
          <li>Hora: ${time}</li>
          <li>Tratamiento: ${treatment}</li>
        </ul>
        <p>Gracias por usar el sistema de citas médicas.</p>
      `
    });
    return true;
  } catch (error) {
    console.error('Error al enviar correo:', error.message);
    return false;
  }
}

module.exports = {
  sendAppointmentEmail
};
