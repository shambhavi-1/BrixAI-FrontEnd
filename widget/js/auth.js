const API_BASE = 'http://localhost:5000/api'; // Adjust for your backend

function showTab(tab) {
  document.getElementById('login-tab').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('register-tab').style.display = tab === 'register' ? 'block' : 'none';
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');

  // Update the sliding indicator
  const tabsContainer = document.querySelector('.auth-tabs');
  if (tabsContainer) {
    tabsContainer.setAttribute('data-active', tab);
  }
}

async function loginUser() {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('token', data.accessToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      window.location.href = 'dashboard.html';
    } else {
      alert(data.message);
    }
  } catch (err) {
    alert('Login failed');
  }
}

async function registerUser() {
  const name = document.getElementById('reg-name').value;
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;
  const role = document.getElementById('reg-role').value;

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role })
    });
    const data = await res.json();
    if (res.ok) {
      alert('Registration successful! Please login.');
      showTab('login');
    } else {
      alert(data.message);
    }
  } catch (err) {
    alert('Registration failed');
  }
}
