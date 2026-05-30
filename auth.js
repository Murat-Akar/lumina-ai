// Lumina AI — Authentication
// Demo credentials. For production, replace with a real auth service.
var LUMINA_AUTH_KEY = 'lumina_token';
var LUMINA_USERS = [
  { email: 'demo@lumina.ai', password: 'lumina2024' }
];

function luminaCheckAuth() {
  if (!sessionStorage.getItem(LUMINA_AUTH_KEY)) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

function luminaLogin(email, password) {
  var user = LUMINA_USERS.find(function(u) {
    return u.email.toLowerCase() === email.toLowerCase() && u.password === password;
  });
  if (user) {
    sessionStorage.setItem(LUMINA_AUTH_KEY, JSON.stringify({ email: user.email, ts: Date.now() }));
    return true;
  }
  return false;
}

function luminaLogout() {
  sessionStorage.clear();
  window.location.href = 'login.html';
}
