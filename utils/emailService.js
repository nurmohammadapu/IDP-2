const crypto = require("crypto")

// Simple email template generator
function generateEmailTemplate(type, data) {
  const templates = {
    appointment_reminder: {
      subject: `Appointment Reminder - ${data.date}`,
      body: `
        <h2>🏥 Hospital Management System</h2>
        <h3>Appointment Reminder</h3>
        <p>Dear ${data.patient_name},</p>
        <p>This is a reminder for your upcoming appointment:</p>
        <ul>
          <li><strong>Doctor:</strong> ${data.doctor_name}</li>
          <li><strong>Date:</strong> ${data.date}</li>
          <li><strong>Time:</strong> ${data.time}</li>
          <li><strong>Specialty:</strong> ${data.specialty}</li>
        </ul>
        <p>Please arrive 15 minutes early.</p>
        <p>Thank you!</p>
      `,
    },
    password_reset: {
      subject: "Password Reset Request",
      body: `
        <h2>🏥 Hospital Management System</h2>
        <h3>Password Reset</h3>
        <p>Dear ${data.name},</p>
        <p>You requested a password reset. Your temporary password is:</p>
        <h3 style="background: #f0f0f0; padding: 10px; border-radius: 5px;">${data.temp_password}</h3>
        <p>Please login and change your password immediately.</p>
        <p>If you didn't request this, please contact admin.</p>
      `,
    },
    bill_generated: {
      subject: `Bill Generated - Amount: $${data.amount}`,
      body: `
        <h2>🏥 Hospital Management System</h2>
        <h3>Bill Generated</h3>
        <p>Dear ${data.patient_name},</p>
        <p>A new bill has been generated for your recent visit:</p>
        <ul>
          <li><strong>Amount:</strong> $${data.amount}</li>
          <li><strong>Service:</strong> ${data.service_details}</li>
          <li><strong>Date:</strong> ${data.billing_date}</li>
        </ul>
        <p>Please visit the hospital to make payment.</p>
        <p>Thank you!</p>
      `,
    },
  }

  return templates[type] || { subject: "Notification", body: "You have a new notification." }
}

// Simulate email sending (in real app, use nodemailer or similar)
function sendEmail(to, subject, body) {
  return new Promise((resolve) => {
    // Simulate email sending delay
    setTimeout(() => {
      console.log(`📧 Email sent to: ${to}`)
      console.log(`📧 Subject: ${subject}`)
      console.log(`📧 Body: ${body.substring(0, 100)}...`)
      resolve({ success: true, message: "Email sent successfully" })
    }, 1000)
  })
}

function generateTempPassword() {
  return crypto.randomBytes(4).toString("hex").toUpperCase()
}

module.exports = {
  generateEmailTemplate,
  sendEmail,
  generateTempPassword,
}
