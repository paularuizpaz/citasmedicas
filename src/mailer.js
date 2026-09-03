const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'tu-correo@gmail.com',
    pass: process.env.EMAIL_PASS || 'tu-password-de-app'
  }
});

async function verifyMailer() {
  try {
    await transporter.verify();
    console.log('Servicio de correo SMTP configurado correctamente.');
    return true;
  } catch (error) {
    console.error('No se pudo verificar el servicio de correo:', error.message);
    return false;
  }
}

async function sendAppointmentEmail({ doctorEmail, doctorName, patientEmail, patientName, date, time, treatment }) {
  const appointmentDetails = `
    <ul>
      <li>Paciente: ${patientName}</li>
      <li>Fecha: ${date}</li>
      <li>Hora: ${time}</li>
      <li>Motivo: ${treatment}</li>
    </ul>
  `;
  const messages = [
    {
      to: doctorEmail,
      subject: 'Nueva cita registrada',
      html: `<h2>Nueva cita agendada</h2><p>Estimado/a ${doctorName},</p><p>Se ha registrado una nueva cita en su agenda.</p>${appointmentDetails}`
    }
  ];

  if (patientEmail) {
    messages.push({
      to: patientEmail,
      subject: 'Confirmación de cita médica',
      html: `<h2>Cita médica confirmada</h2><p>Hola ${patientName},</p><p>Tu cita médica fue registrada correctamente.</p>${appointmentDetails}`
    });
  }

  const results = await Promise.all(messages.map(async (message) => {
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER || 'tu-correo@gmail.com',
        ...message
      });
      return true;
    } catch (error) {
      console.error(`Error al enviar correo a ${message.to}:`, error.message);
      return false;
    }
  }));

  return results.every(Boolean);
}

async function sendAppointmentCancellationEmail({ patientEmail, patientName, doctorName, date, time, treatment, reason }) {
  if (!patientEmail) return false;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER || 'tu-correo@gmail.com',
      to: patientEmail,
      subject: 'Cita médica cancelada',
      html: `<h2>Cita médica cancelada</h2><p>Hola ${patientName},</p><p>El/la doctor/a ${doctorName} canceló tu cita médica.</p><ul><li>Fecha: ${date}</li><li>Hora: ${time}</li><li>Motivo: ${treatment}</li>${reason ? `<li>Detalle: ${reason}</li>` : ''}</ul><p>Ingresa a la plataforma para agendar una nueva cita.</p>`
    });
    return true;
  } catch (error) {
    console.error(`Error al enviar cancelación a ${patientEmail}:`, error.message);
    return false;
  }
}

module.exports = {
  sendAppointmentEmail,
  sendAppointmentCancellationEmail,
  verifyMailer
};
