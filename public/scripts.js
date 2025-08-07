// Common JavaScript functions used across all pages

// Toast notification function
function showToast(message, type = "info") {
  const toast = document.getElementById("toast")
  toast.textContent = message
  toast.className = `toast toast-${type} show`

  setTimeout(() => {
    toast.className = "toast"
  }, 3000)
}

// Format date function
function formatDate(dateString) {
  const date = new Date(dateString)
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

// Check authentication and load user info
async function checkAuthAndLoadUser() {
  try {
    const response = await fetch("/api/auth/me")
    if (response.ok) {
      const data = await response.json()
      const userNameElement = document.getElementById("userName")
      if (userNameElement) {
        userNameElement.textContent = data.user.name
      }
    } else {
      // Redirect to login if not authenticated
      window.location.href = "/"
    }
  } catch (error) {
    window.location.href = "/"
  }
}

// Logout functionality
async function logout() {
  try {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
    })

    if (response.ok) {
      showToast("Logged out successfully", "success")
      setTimeout(() => {
        window.location.href = "/"
      }, 1000)
    } else {
      showToast("Logout failed", "error")
    }
  } catch (error) {
    showToast("Network error during logout", "error")
  }
}

// Add logout event listener when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("logoutBtn")
  if (logoutBtn) {
    logoutBtn.addEventListener("click", logout)
  }
})
