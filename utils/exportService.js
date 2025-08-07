function generateCSV(data, headers) {
  if (!data || data.length === 0) {
    return "No data available"
  }

  // Create CSV header
  let csv = headers.join(",") + "\n"

  // Add data rows
  data.forEach((row) => {
    const values = headers.map((header) => {
      const value = row[header.toLowerCase().replace(" ", "_")] || ""
      // Escape commas and quotes
      return `"${String(value).replace(/"/g, '""')}"`
    })
    csv += values.join(",") + "\n"
  })

  return csv
}

function generatePDF(data, title) {
  // Simple HTML to PDF conversion (in real app, use puppeteer or similar)
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f8f9fa; font-weight: bold; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .header { text-align: center; margin-bottom: 30px; }
        .date { text-align: right; color: #666; margin-bottom: 20px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🏥 Hospital Management System</h1>
        <h2>${title}</h2>
      </div>
      <div class="date">Generated on: ${new Date().toLocaleDateString()}</div>
      <table>
        <thead>
          <tr>
            ${Object.keys(data[0] || {})
              .map((key) => `<th>${key.replace(/_/g, " ").toUpperCase()}</th>`)
              .join("")}
          </tr>
        </thead>
        <tbody>
          ${data
            .map(
              (row) => `
            <tr>
              ${Object.values(row)
                .map((value) => `<td>${value || ""}</td>`)
                .join("")}
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
      <div style="margin-top: 30px; text-align: center; color: #666;">
        <p>Total Records: ${data.length}</p>
      </div>
    </body>
    </html>
  `

  return html
}

function generateReport(type, data, filters = {}) {
  const reports = {
    patient_summary: {
      title: "Patient Summary Report",
      process: (data) =>
        data.map((p) => ({
          ID: p.id,
          Name: p.name,
          Age: p.age,
          Gender: p.gender,
          Contact: p.contact,
          "Registration Date": new Date(p.created_at).toLocaleDateString(),
        })),
    },
    appointment_summary: {
      title: "Appointment Summary Report",
      process: (data) =>
        data.map((a) => ({
          ID: a.id,
          Patient: a.patient_name,
          Doctor: a.doctor_name,
          Date: new Date(a.appointment_date).toLocaleDateString(),
          Time: a.appointment_time,
          Status: a.status,
        })),
    },
    financial_summary: {
      title: "Financial Summary Report",
      process: (data) =>
        data.map((b) => ({
          "Bill ID": b.id,
          Patient: b.patient_name,
          Amount: `$${Number.parseFloat(b.amount).toFixed(2)}`,
          Service: b.service_details,
          Date: new Date(b.billing_date).toLocaleDateString(),
          Status: b.status,
        })),
    },
  }

  const report = reports[type]
  if (!report) {
    throw new Error("Invalid report type")
  }

  const processedData = report.process(data)
  return {
    title: report.title,
    data: processedData,
    summary: {
      total_records: processedData.length,
      generated_at: new Date().toISOString(),
      filters: filters,
    },
  }
}

module.exports = {
  generateCSV,
  generatePDF,
  generateReport,
}
