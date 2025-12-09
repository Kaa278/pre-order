// firebase-init.js (COMPAT FIX + bucket fallback)
// Exposes: window.firebaseReady, window.db, window.storage, window.auth, window.__switchToAltBucket

(function () {
  if (window.firebaseReady) return;

  window.firebaseReady = new Promise((resolve, reject) => {
    try {
      const firebaseConfig = {
        apiKey: "AIzaSyA89o0d_8-TT7phYFTvJtGU0swt_1QHZog",
        authDomain: "pre-order-90344.firebaseapp.com",
        projectId: "pre-order-90344",
        messagingSenderId: "1079721083296",

        // tetap isi salah satu biar "ada default bucket"
        storageBucket: "pre-order-90344.appspot.com"
      };

      if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

      const app = firebase.app();

      // Firestore & Auth
      window.db = firebase.firestore(app);
      window.auth = firebase.auth(app);

      // ===== Storage primary & alt via COMPAT =====
      const primaryBucket = "gs://pre-order-90344.appspot.com";
      const altBucket = "gs://pre-order-90344.firebasestorage.app";

      window.storagePrimary = app.storage(primaryBucket);
      window.storageAlt = app.storage(altBucket);

      // default pakai primary dulu
      window.storage = window.storagePrimary;

      // switch function buat retry
      window.__switchToAltBucket = function () {
        console.warn("Switching storage bucket to ALT:", altBucket);
        window.storage = window.storageAlt;
      };

      resolve();
    } catch (e) {
      reject(e);
    }
  });
})();
