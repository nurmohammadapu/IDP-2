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

// Format time function (12-hour format with AM/PM)
function formatTime12(time24) {
  if (!time24) return '-'
  // If already formatted with AM/PM, return as is
  if (time24.includes('AM') || time24.includes('PM')) return time24
  const [hStr, mStr] = time24.split(':')
  if (!hStr || !mStr) return time24
  let h = parseInt(hStr, 10)
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12
  if (h === 0) h = 12
  return `${String(h).padStart(2, '0')}:${mStr} ${ampm}`
}

// Check authentication and load user info
async function checkAuthAndLoadUser() {
  try {
    const response = await fetch("/api/auth/me")
    if (response.ok) {
      const data = await response.json()
      const user = data.user
      
      // Page authorization mapping
      const allowedPages = {
        admin: ['dashboard.html', 'users.html', 'patients.html', 'doctors.html', 'appointments.html', 'billing.html', 'reports.html', 'settings.html', 'advanced.html', 'tests.html'],
        receptionist: ['dashboard.html', 'patients.html', 'doctors.html', 'appointments.html', 'tests.html', 'settings.html'],
        doctor_assistant: ['dashboard.html', 'patients.html', 'doctors.html', 'appointments.html', 'reports.html', 'settings.html'],
        doctor: ['doctor-dashboard.html', 'doctor-appointments.html', 'doctor-revenue.html', 'settings.html'],
        patient: ['patient-dashboard.html', 'patient-appointments.html', 'patient-bills.html', 'settings.html'],
        accountant: ['dashboard.html', 'billing.html', 'reports.html', 'settings.html']
      }

      // Check current page permission
      const pathname = window.location.pathname
      const currentFile = pathname.split('/').pop() || 'dashboard.html'
      
      const mainPortalPages = [
        'dashboard.html', 'users.html', 'patients.html', 'doctors.html', 'appointments.html', 'billing.html', 
        'reports.html', 'settings.html', 'advanced.html', 'tests.html', 'doctor-dashboard.html', 'doctor-appointments.html', 'doctor-revenue.html',
        'patient-dashboard.html', 'patient-appointments.html', 'patient-bills.html', 'receptionist-dashboard.html'
      ]

      if (mainPortalPages.includes(currentFile)) {
        const allowed = allowedPages[user.role] || []
        if (!allowed.includes(currentFile)) {
          // Redirect unauthorized roles to their dashboard
          if (user.role === 'admin') window.location.href = 'dashboard.html'
          else if (user.role === 'receptionist') window.location.href = 'dashboard.html'
          else if (user.role === 'doctor_assistant') window.location.href = 'dashboard.html'
          else if (user.role === 'doctor') window.location.href = 'doctor-dashboard.html'
          else if (user.role === 'patient') window.location.href = 'patient-dashboard.html'
          else if (user.role === 'accountant') window.location.href = 'dashboard.html'
          else window.location.href = 'index.html'
          return
        }
      }

      // Store globally for pages that expect window.currentUser
      window.currentUser = user;
      
      const formattedName = (user.role === 'doctor' && !user.name.startsWith('Dr.')) ? `Dr. ${user.name}` : user.name;

      // Render Dynamic Sidebar
      renderDynamicSidebar(user.role)

      // Add dynamic user profile card in sidebar footer if missing
      const sidebarFooter = document.querySelector('.sidebar-footer')
      if (sidebarFooter && !sidebarFooter.querySelector('.user-info')) {
        const userInfo = document.createElement('div')
        userInfo.className = 'user-info'
        userInfo.style.marginBottom = '1rem'
        userInfo.style.display = 'flex'
        userInfo.style.flexDirection = 'column'
        userInfo.style.padding = '0.5rem'
        
        const uName = document.createElement('span')
        uName.id = 'userName'
        uName.style.fontWeight = '600'
        uName.style.fontSize = '0.9rem'
        uName.style.color = '#f1f5f9'
        uName.textContent = formattedName
        
        const uEmail = document.createElement('small')
        uEmail.id = 'userEmail'
        uEmail.style.fontSize = '0.75rem'
        uEmail.style.color = '#94a3b8'
        uEmail.style.marginTop = '2px'
        uEmail.textContent = user.email
        
        userInfo.appendChild(uName)
        userInfo.appendChild(uEmail)
        sidebarFooter.insertBefore(userInfo, sidebarFooter.firstChild)
      } else {
        const uName = document.getElementById('userName')
        const uEmail = document.getElementById('userEmail')
        if (uName) uName.textContent = formattedName
        if (uEmail) uEmail.textContent = user.email
      }
    } else {
      // Redirect to login if not authenticated
      window.location.href = "/"
    }
  } catch (error) {
    window.location.href = "/"
  }
}

// Function to dynamically render the sidebar matching the user's role
function renderDynamicSidebar(role) {
  const sidebarMenu = document.querySelector('.sidebar-menu')
  if (!sidebarMenu) return

  const currentFile = window.location.pathname.split('/').pop() || 'dashboard.html'
  let menuItems = []

  if (role === 'admin') {
    menuItems = [
      { href: 'dashboard.html', text: '📊 Dashboard' },
      { href: 'users.html', text: '🔑 User Management' },
      { href: 'patients.html', text: '👥 Patients' },
      { href: 'doctors.html', text: '👨‍⚕️ Doctors' },
      { href: 'appointments.html', text: '📅 Appointments' },
      { href: 'tests.html', text: '🧪 Tests' },
      { href: 'billing.html', text: '💰 Billing' },
      { href: 'reports.html', text: '📈 Sales & Revenue' },
      { href: 'settings.html', text: '⚙️ Settings' },
      { href: 'advanced.html', text: '📝 Activity Log', id: 'advancedLink' }
    ]
  } else if (role === 'receptionist') {
    menuItems = [
      { href: 'dashboard.html', text: '📊 Dashboard' },
      { href: 'patients.html', text: '👥 Patients' },
      { href: 'doctors.html', text: '👨‍⚕️ Doctors' },
      { href: 'appointments.html', text: '📅 Appointments' },
      { href: 'tests.html', text: '🧪 Tests Price List' },
      { href: 'settings.html', text: '⚙️ Settings' }
    ]
  } else if (role === 'doctor_assistant') {
    menuItems = [
      { href: 'dashboard.html', text: '📊 Dashboard' },
      { href: 'patients.html', text: '👥 Patients' },
      { href: 'doctors.html', text: '👨‍⚕️ Doctors' },
      { href: 'appointments.html', text: '📅 Appointments' },
      { href: 'reports.html', text: '📈 Sales & Revenue' },
      { href: 'settings.html', text: '⚙️ Settings' }
    ]
  } else if (role === 'doctor') {
    menuItems = [
      { href: 'doctor-dashboard.html', text: '📊 Dashboard' },
      { href: 'doctor-appointments.html', text: '📅 My Appointments' },
      { href: 'doctor-revenue.html', text: '📈 Sales & Revenue' },
      { href: 'settings.html', text: '⚙️ Settings' }
    ]
  } else if (role === 'patient') {
    menuItems = [
      { href: 'patient-dashboard.html', text: '📊 Dashboard' },
      { href: 'patient-appointments.html', text: '📅 My Appointments' },
      { href: 'patient-bills.html', text: '💰 My Bills' },
      { href: 'settings.html', text: '⚙️ Settings' }
    ]
  } else if (role === 'accountant') {
    menuItems = [
      { href: 'dashboard.html', text: '📊 Dashboard' },
      { href: 'billing.html', text: '💰 Billing' },
      { href: 'reports.html', text: '📈 Sales & Revenue' },
      { href: 'settings.html', text: '⚙️ Settings' }
    ]
  }

  sidebarMenu.innerHTML = ''
  menuItems.forEach(item => {
    const li = document.createElement('li')
    const a = document.createElement('a')
    a.href = item.href
    a.innerHTML = item.text
    if (item.id) a.id = item.id
    
    if (currentFile === item.href) {
      a.className = 'active'
    }
    
    li.appendChild(a)
    sidebarMenu.appendChild(li)
  })

  // Append user role subheader in sidebar-header if missing
  const sidebarHeader = document.querySelector('.sidebar-header')
  if (sidebarHeader) {
    const h2 = sidebarHeader.querySelector('h2')
    if (h2) h2.innerHTML = '🔬 DCMS'
    let roleSub = sidebarHeader.querySelector('.user-role')
    if (!roleSub) {
      roleSub = document.createElement('p')
      roleSub.className = 'user-role'
      sidebarHeader.appendChild(roleSub)
    }
    
    if (role === 'admin') roleSub.textContent = 'Admin Portal'
    else if (role === 'receptionist') roleSub.textContent = 'Receptionist Portal'
    else if (role === 'doctor_assistant') roleSub.textContent = 'Doctor Assistant (Compounder)'
    else if (role === 'doctor') roleSub.textContent = 'Doctor Portal'
    else if (role === 'patient') roleSub.textContent = 'Patient Portal'
    else if (role === 'accountant') roleSub.textContent = 'Accountant Portal'
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
