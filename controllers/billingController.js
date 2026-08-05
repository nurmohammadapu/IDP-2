const {
  createBill,
  getAllBills,
  updateBillStatus,
  createAdvancedBill,
  getAllAdvancedBills,
  getAdvancedBillById,
  updateAdvancedBill,
  addPayment,
} = require("../models/billingModel")
const { auditAction } = require("../middleware/auditMiddleware")
const { getAuthenticatedUser } = require("../middleware/authMiddleware")

// Enhanced billing functions
async function getAllAdvanced(req, res) {
  try {
    const user = await getAuthenticatedUser(req)
    const bills = await getAllAdvancedBills(user)
    return res.json(bills)
  } catch (error) {
    console.error("Get advanced bills error:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}

async function getAdvancedById(req, res) {
  try {
    const { id } = req.params
    const bill = await getAdvancedBillById(id)
    if (!bill) {
      return res.status(404).json({ error: "Bill not found" })
    }
    return res.json(bill)
  } catch (error) {
    console.error("Get advanced bill error:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}

async function createAdvanced(req, res) {
  try {
    const { patient_id, billing_date, items, discount_type, discount_value, paid_amount, payment_method } = req.body

    if (!patient_id || !billing_date || !items || items.length === 0) {
      return res.status(400).json({ error: "Patient, date, and items are required" })
    }

    // Calculate subtotal
    const subtotal = items.reduce((sum, item) => sum + Number.parseFloat(item.price), 0)

    const user = await getAuthenticatedUser(req)
    const created_by = user ? user.id : null

    if (user && user.role === 'receptionist') {
      const hasForbiddenItem = items.some(item => item.name !== 'Doctor Visit')
      if (hasForbiddenItem) {
        return res.status(400).json({ error: "Receptionists are only authorized to collect Doctor Visit fees" })
      }
    }

    if (user && user.role === 'accountant') {
      const hasDoctorVisit = items.some(item => item.name === 'Doctor Visit')
      if (hasDoctorVisit) {
        return res.status(400).json({ error: "Accountants are only authorized for test-related bills and cannot add Doctor Visit fees" })
      }
    }

    const billId = await createAdvancedBill({
      patient_id,
      billing_date,
      items,
      subtotal,
      discount_type: discount_type || "amount",
      discount_value: Number.parseFloat(discount_value) || 0,
      paid_amount: Number.parseFloat(paid_amount) || 0,
      payment_method: payment_method || "cash",
      created_by
    })

    // Log audit activity
    await auditAction(req, "CREATE", "advanced_bills", billId, null, {
      patient_id,
      total_amount: subtotal - (Number.parseFloat(discount_value) || 0),
      items_count: items.length,
    })

    return res.status(201).json({ message: "Advanced bill created successfully", billId })
  } catch (error) {
    console.error("Create advanced bill error:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}

async function updateAdvanced(req, res) {
  try {
    const { id } = req.params
    const { patient_id, billing_date, items, discount_type, discount_value, paid_amount, payment_method } = req.body

    if (!patient_id || !billing_date || !items || items.length === 0) {
      return res.status(400).json({ error: "Patient, date, and items are required" })
    }

    const user = await getAuthenticatedUser(req)
    if (user && user.role === 'receptionist') {
      const hasForbiddenItem = items.some(item => item.name !== 'Doctor Visit')
      if (hasForbiddenItem) {
        return res.status(400).json({ error: "Receptionists are only authorized to collect Doctor Visit fees" })
      }
    }

    if (user && user.role === 'accountant') {
      const hasDoctorVisit = items.some(item => item.name === 'Doctor Visit')
      if (hasDoctorVisit) {
        return res.status(400).json({ error: "Accountants are only authorized for test-related bills and cannot add Doctor Visit fees" })
      }
    }

    // Get old bill data for audit
    const oldBill = await getAdvancedBillById(id)

    // Calculate subtotal
    const subtotal = items.reduce((sum, item) => sum + Number.parseFloat(item.price), 0)

    await updateAdvancedBill(id, {
      patient_id,
      billing_date,
      items,
      subtotal,
      discount_type: discount_type || "amount",
      discount_value: Number.parseFloat(discount_value) || 0,
      paid_amount: Number.parseFloat(paid_amount) || 0,
      payment_method: payment_method || "cash",
    })

    // Log audit activity
    await auditAction(
      req,
      "UPDATE",
      "advanced_bills",
      id,
      { total_amount: oldBill?.total_amount },
      { total_amount: subtotal - (Number.parseFloat(discount_value) || 0) },
    )

    return res.json({ message: "Advanced bill updated successfully" })
  } catch (error) {
    console.error("Update advanced bill error:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}

async function addBillPayment(req, res) {
  try {
    const { id } = req.params
    const { amount, payment_method, notes } = req.body

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Valid payment amount is required" })
    }

    const user = await getAuthenticatedUser(req)
    const created_by = user ? user.id : null

    const paymentId = await addPayment(id, {
      amount: Number.parseFloat(amount),
      payment_method: payment_method || "cash",
      notes: notes || "",
      created_by
    })

    // Log audit activity
    await auditAction(req, "CREATE", "bill_payments", paymentId, null, {
      bill_id: id,
      amount: Number.parseFloat(amount),
      payment_method,
    })

    return res.status(201).json({ message: "Payment added successfully", paymentId })
  } catch (error) {
    console.error("Add payment error:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}

async function generateBillPDF(req, res) {
  try {
    const { id } = req.params
    const bill = await getAdvancedBillById(id)
    if (!bill) {
      return res.status(404).json({ error: "Bill not found" })
    }

    // Generate proper PDF HTML
    const pdfHTML = generateBillPDFContent(bill)

    // Log audit activity
    await auditAction(req, "PDF_GENERATED", "advanced_bills", id, null, {
      bill_id: id,
      patient_name: bill.patient_name,
    })

    res.setHeader("Content-Type", "text/html; charset=utf-8")
    res.setHeader("Content-Disposition", `inline; filename="bill_${id}.html"`)
    res.end(pdfHTML)
  } catch (error) {
    console.error("Generate PDF error:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}

function generateBillPDFContent(bill) {
  const currentDate = new Date().toLocaleDateString("en-GB")
  const billDate = new Date(bill.billing_date).toLocaleDateString("en-GB")

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bill - ${bill.patient_name}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body { 
            font-family: 'Arial', sans-serif; 
            line-height: 1.6;
            color: #333;
            background: white;
            padding: 20px;
        }
        
        .bill-container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border: 1px solid #ddd;
            border-radius: 8px;
            overflow: hidden;
        }
        
        .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        
        .hospital-name { 
            font-size: 28px; 
            font-weight: bold; 
            margin-bottom: 10px;
        }
        
        .hospital-info { 
            font-size: 14px;
            opacity: 0.9;
        }
        
        .bill-header {
            background: #f8f9fa;
            padding: 20px 30px;
            border-bottom: 2px solid #e9ecef;
        }
        
        .bill-title {
            font-size: 24px;
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 10px;
        }
        
        .bill-info { 
            display: flex; 
            justify-content: space-between; 
            padding: 30px;
            background: white;
        }
        
        .patient-info, .bill-details { 
            width: 48%; 
        }
        
        .info-title { 
            font-weight: bold; 
            color: #2c3e50; 
            font-size: 16px;
            margin-bottom: 15px;
            padding-bottom: 8px;
            border-bottom: 2px solid #3498db;
        }
        
        .info-row { 
            margin-bottom: 8px;
            display: flex;
        }
        
        .info-label {
            font-weight: 600;
            width: 100px;
            color: #555;
        }
        
        .info-value {
            flex: 1;
            color: #333;
        }
        
        .items-section {
            padding: 30px;
            background: #fafafa;
        }
        
        .items-title {
            font-size: 18px;
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 20px;
        }
        
        .items-table { 
            width: 100%; 
            border-collapse: collapse; 
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .items-table th { 
            background: #3498db;
            color: white;
            padding: 15px;
            text-align: left;
            font-weight: 600;
        }
        
        .items-table td { 
            padding: 12px 15px;
            border-bottom: 1px solid #eee;
        }
        
        .items-table tr:last-child td {
            border-bottom: none;
        }
        
        .items-table tr:nth-child(even) {
            background: #f8f9fa;
        }
        
        .price { 
            text-align: right;
            font-weight: 600;
            color: #2c3e50;
        }
        
        .summary-section {
            padding: 30px;
            background: white;
        }
        
        .summary { 
            max-width: 400px;
            margin-left: auto;
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            border: 1px solid #e9ecef;
        }
        
        .summary-title {
            font-size: 18px;
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 15px;
            text-align: center;
        }
        
        .summary-row { 
            display: flex; 
            justify-content: space-between; 
            margin-bottom: 10px;
            padding: 5px 0;
        }
        
        .summary-row.total { 
            font-weight: bold; 
            font-size: 18px; 
            border-top: 2px solid #3498db; 
            padding-top: 15px;
            margin-top: 15px;
            color: #2c3e50;
        }
        
        .summary-row.due {
            background: #fff3cd;
            padding: 10px;
            border-radius: 4px;
            border: 1px solid #ffeaa7;
        }
        
        .payment-history { 
            margin-top: 30px;
            padding: 30px;
            background: #f8f9fa;
        }
        
        .payment-title {
            font-size: 18px;
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 20px;
        }
        
        .payment-table { 
            width: 100%; 
            border-collapse: collapse;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .payment-table th { 
            background: #27ae60;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: 600;
        }
        
        .payment-table td { 
            padding: 10px 12px;
            border-bottom: 1px solid #eee;
        }
        
        .payment-table tr:nth-child(even) {
            background: #f8f9fa;
        }
        
        .footer { 
            margin-top: 40px; 
            text-align: center; 
            color: #666; 
            font-size: 12px; 
            background: #2c3e50;
            color: white;
            padding: 20px;
        }
        
        .status { 
            padding: 6px 12px; 
            border-radius: 20px; 
            font-size: 12px; 
            font-weight: bold;
            text-transform: uppercase;
        }
        
        .status-paid { 
            background-color: #d4edda; 
            color: #155724; 
        }
        
        .status-pending { 
            background-color: #fff3cd; 
            color: #856404; 
        }
        
        .watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 100px;
            color: rgba(0,0,0,0.05);
            z-index: -1;
            font-weight: bold;
        }
        
        .no-print-banner {
            position: sticky;
            top: 0;
            background: #f8fafc;
            padding: 12px 24px;
            text-align: right;
            border-bottom: 1px solid #e2e8f0;
            margin-bottom: 20px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            z-index: 100;
        }
        
        .no-print-banner button {
            padding: 8px 16px;
            background: #4f46e5;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            font-size: 14px;
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
            transition: background 0.2s;
        }
        
        .no-print-banner button:hover {
            background: #4338ca;
        }
        
        @media print {
            body { 
                margin: 0; 
                padding: 0;
            }
            .bill-container {
                border: none;
                border-radius: 0;
            }
            .no-print {
                display: none !important;
            }
        }
    </style>
</head>
<body>
    <div class="no-print-banner no-print">
        <button onclick="window.print()">🖨️ Print / Save as PDF</button>
    </div>
    <div class="watermark">HOSPITAL BILL</div>
    
    <div class="bill-container">
        <div class="header">
            <div class="hospital-name">🏥 City General Hospital</div>
            <div class="hospital-info">
                123 Medical Street, Healthcare City<br>
                Phone: +1-234-567-8900 | Email: info@hospital.com<br>
                License: MED-2024-001 | Tax ID: 123456789
            </div>
        </div>

        <div class="bill-header">
            <div class="bill-title">Medical Bill Invoice</div>
            <div style="color: #666;">Professional Healthcare Services</div>
        </div>

        <div class="bill-info">
            <div class="patient-info">
                <div class="info-title">Patient Information</div>
                <div class="info-row">
                    <span class="info-label">Name:</span>
                    <span class="info-value">${bill.patient_name}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Contact:</span>
                    <span class="info-value">${bill.patient_contact}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Address:</span>
                    <span class="info-value">${bill.patient_address || "N/A"}</span>
                </div>
            </div>
            
            <div class="bill-details">
                <div class="info-title">Bill Details</div>
                <div class="info-row">
                    <span class="info-label">Bill ID:</span>
                    <span class="info-value">BILL-${String(bill.id).padStart(6, "0")}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Date:</span>
                    <span class="info-value">${billDate}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Status:</span>
                    <span class="info-value">
                        <span class="status ${Number.parseFloat(bill.due_amount) <= 0 ? "status-paid" : "status-pending"}">
                            ${Number.parseFloat(bill.due_amount) <= 0 ? "PAID" : "PENDING"}
                        </span>
                    </span>
                </div>
                <div class="info-row">
                    <span class="info-label">Generated:</span>
                    <span class="info-value">${currentDate}</span>
                </div>
            </div>
        </div>

        <div class="items-section">
            <div class="items-title">Service Details</div>
            <table class="items-table">
                <thead>
                    <tr>
                        <th style="width: 60px;">SL</th>
                        <th>Service Description</th>
                        <th style="width: 100px;">Type</th>
                        <th style="width: 120px;" class="price">Price (৳)</th>
                    </tr>
                </thead>
                <tbody>
                    ${
                      bill.items && bill.items.length > 0
                        ? bill.items
                            .map(
                              (item, index) => `
                        <tr>
                            <td style="text-align: center; font-weight: 600;">${index + 1}</td>
                            <td>${item.item_name}</td>
                            <td>
                                <span style="background: ${item.item_type === "test" ? "#e3f2fd" : "#f3e5f5"}; 
                                             color: ${item.item_type === "test" ? "#1976d2" : "#7b1fa2"}; 
                                             padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">
                                    ${item.item_type === "test" ? "TEST" : "SERVICE"}
                                </span>
                            </td>
                            <td class="price">৳${Number.parseFloat(item.item_price).toFixed(2)}</td>
                        </tr>
                    `,
                            )
                            .join("")
                        : '<tr><td colspan="4" style="text-align: center; color: #666;">No items found</td></tr>'
                    }
                </tbody>
            </table>
        </div>

        <div class="summary-section">
            <div class="summary">
                <div class="summary-title">Bill Summary</div>
                <div class="summary-row">
                    <span>Subtotal:</span>
                    <span>৳${Number.parseFloat(bill.subtotal || 0).toFixed(2)}</span>
                </div>
                <div class="summary-row">
                    <span>Discount ${bill.discount_type === "percentage" ? `(${bill.discount_value}%)` : ""}:</span>
                    <span>- ৳${Number.parseFloat(bill.discount_amount || 0).toFixed(2)}</span>
                </div>
                <div class="summary-row total">
                     <span>Total Amount:</span>
                    <span>৳${Number.parseFloat(bill.total_amount || 0).toFixed(2)}</span>
                </div>
                <div class="summary-row">
                    <span>Paid Amount:</span>
                    <span>৳${Number.parseFloat(bill.paid_amount || 0).toFixed(2)}</span>
                </div>
                <div class="summary-row due">
                    <span><strong>Due Amount:</strong></span>
                    <span><strong>৳${Number.parseFloat(bill.due_amount || 0).toFixed(2)}</strong></span>
                </div>
            </div>
        </div>

        ${
          bill.payments && bill.payments.length > 0
            ? `
        <div class="payment-history">
            <div class="payment-title">Payment History</div>
            <table class="payment-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Method</th>
                        <th>Notes</th>
                    </tr>
                </thead>
                <tbody>
                    ${bill.payments
                      .map(
                        (payment) => `
                        <tr>
                            <td>${new Date(payment.payment_date).toLocaleDateString("en-GB")}</td>
                            <td style="font-weight: 600;">৳${Number.parseFloat(payment.amount).toFixed(2)}</td>
                            <td style="text-transform: capitalize;">${payment.payment_method}</td>
                            <td>${payment.notes || "-"}</td>
                        </tr>
                    `,
                      )
                      .join("")}
                </tbody>
            </table>
        </div>
        `
            : ""
        }

        <div class="footer">
            <p><strong>Thank you for choosing City General Hospital</strong></p>
            <p>This is a computer generated bill. For any queries, please contact our billing department.</p>
            <p>Generated on: ${new Date().toLocaleString("en-GB")} | System: Hospital Management v1.0</p>
        </div>
    </div>
</body>
</html>
  `
}

// Legacy functions
async function getAll(req, res) {
  try {
    const bills = await getAllBills()
    return res.json(bills)
  } catch (error) {
    console.error("Get bills error:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}

async function create(req, res) {
  try {
    const { patient_id, amount, service_details, billing_date } = req.body

    if (!patient_id || !amount || !service_details || !billing_date) {
      return res.status(400).json({ error: "All fields are required" })
    }

    const billId = await createBill({
      patient_id,
      amount,
      service_details,
      billing_date,
    })

    // Log audit activity
    await auditAction(req, "CREATE", "billing", billId, null, {
      patient_id,
      amount,
      service_details,
    })

    return res.status(201).json({ message: "Bill created successfully", billId })
  } catch (error) {
    console.error("Create bill error:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}

async function updateStatus(req, res) {
  try {
    const { id } = req.params
    const { status } = req.body

    if (!status || !["pending", "paid"].includes(status)) {
      return res.status(400).json({ error: "Valid status is required" })
    }

    await updateBillStatus(id, status)

    // Log audit activity
    await auditAction(req, "UPDATE", "billing", id, null, { status })

    return res.json({ message: "Bill status updated successfully" })
  } catch (error) {
    console.error("Update bill status error:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}

module.exports = {
  // Legacy functions
  getAll,
  create,
  updateStatus,
  // Advanced functions
  getAllAdvanced,
  getAdvancedById,
  createAdvanced,
  updateAdvanced,
  addBillPayment,
  generateBillPDF,
}
