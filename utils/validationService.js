// Advanced validation functions
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return {
    isValid: emailRegex.test(email),
    message: emailRegex.test(email) ? "" : "Please enter a valid email address",
  }
}

function validatePhone(phone) {
  const phoneRegex = /^[+]?[1-9][\d]{0,15}$/
  return {
    isValid: phoneRegex.test(phone.replace(/[\s\-()]/g, "")),
    message: phoneRegex.test(phone.replace(/[\s\-()]/g, "")) ? "" : "Please enter a valid phone number",
  }
}

function validatePassword(password) {
  const minLength = 8
  const hasUpperCase = /[A-Z]/.test(password)
  const hasLowerCase = /[a-z]/.test(password)
  const hasNumbers = /\d/.test(password)
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password)

  const errors = []
  if (password.length < minLength) errors.push(`Password must be at least ${minLength} characters long`)
  if (!hasUpperCase) errors.push("Password must contain at least one uppercase letter")
  if (!hasLowerCase) errors.push("Password must contain at least one lowercase letter")
  if (!hasNumbers) errors.push("Password must contain at least one number")
  if (!hasSpecialChar) errors.push("Password must contain at least one special character")

  return {
    isValid: errors.length === 0,
    message: errors.join(". "),
    strength: calculatePasswordStrength(password),
  }
}

function calculatePasswordStrength(password) {
  let score = 0
  if (password.length >= 8) score += 1
  if (password.length >= 12) score += 1
  if (/[a-z]/.test(password)) score += 1
  if (/[A-Z]/.test(password)) score += 1
  if (/[0-9]/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password)) score += 1

  const strengths = ["Very Weak", "Weak", "Fair", "Good", "Strong", "Very Strong"]
  return strengths[Math.min(score, 5)]
}

function sanitizeInput(input) {
  if (typeof input !== "string") return input

  return input
    .replace(/[<>]/g, "") // Remove potential HTML tags
    .replace(/['"]/g, "") // Remove quotes to prevent SQL injection
    .trim()
}

module.exports = {
  validateEmail,
  validatePhone,
  validatePassword,
  sanitizeInput,
  calculatePasswordStrength,
}
