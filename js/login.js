// login.js - authentication handler
(async function(){
  // tunggu init selesai
  if (window.firebaseReady) {
    await window.firebaseReady.catch(e => {
      console.warn("Firebase init failed:", e);
    });
  }

  // ambil auth lagi setelah ready
  const auth = window.auth || (window.firebase && firebase.auth && firebase.auth());

  const ADMIN_UID = 'DSNoDr0mLvaOYlpRyh6WTdtgzyI2';

  const form = document.getElementById('loginForm');
  const messageEl = document.getElementById('message');
  if (!form) return;

  form.addEventListener('submit', function(e){
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (!auth) {
      // fallback demo
      if (email === 'admin' && password === 'admin123') {
        localStorage.setItem('adminSession', JSON.stringify({
          username: 'admin',
          loginTime: new Date().toISOString()
        }));
        messageEl.className = 'mt-4 p-3 rounded-lg text-sm bg-green-100 text-green-800';
        messageEl.textContent = 'Login demo berhasil! Alihkan ke dashboard...';
        messageEl.classList.remove('hidden');
        setTimeout(() => window.location.href = 'admin-dashboard.html', 1000);
        return;
      }

      messageEl.className = 'mt-4 p-3 rounded-lg text-sm bg-red-100 text-red-800';
      messageEl.textContent = 'Firebase Auth tidak tersedia. Cek include firebase-auth-compat.js & firebase-init.js.';
      messageEl.classList.remove('hidden');
      return;
    }

    auth.signInWithEmailAndPassword(email, password)
      .then(cred => {
        const user = cred.user;
        if (user.uid !== ADMIN_UID) {
          messageEl.className = 'mt-4 p-3 rounded-lg text-sm bg-red-100 text-red-800';
          messageEl.textContent = 'Akun bukan admin. Gunakan akun admin.';
          messageEl.classList.remove('hidden');
          auth.signOut();
          return;
        }

        messageEl.className = 'mt-4 p-3 rounded-lg text-sm bg-green-100 text-green-800';
        messageEl.textContent = 'Login berhasil! Alihkan ke dashboard...';
        messageEl.classList.remove('hidden');
        setTimeout(() => window.location.href = 'admin-dashboard.html', 1000);
      })
      .catch(err => {
        // fallback demo
        if (email === 'admin' && password === 'admin123') {
          localStorage.setItem('adminSession', JSON.stringify({
            username: 'admin',
            loginTime: new Date().toISOString()
          }));
          messageEl.className = 'mt-4 p-3 rounded-lg text-sm bg-green-100 text-green-800';
          messageEl.textContent = 'Login demo berhasil! Alihkan ke dashboard...';
          messageEl.classList.remove('hidden');
          setTimeout(() => window.location.href = 'admin-dashboard.html', 1000);
          return;
        }

        messageEl.className = 'mt-4 p-3 rounded-lg text-sm bg-red-100 text-red-800';
        messageEl.textContent = 'Gagal login: ' + err.message;
        messageEl.classList.remove('hidden');
      });
  });
})();
