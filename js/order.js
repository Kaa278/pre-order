// order.js - FINAL (Firestore dulu, bukti optional & tidak bikin loading lama)
(async function () {
  // tunggu firebase init
  if (window.firebaseReady) {
    await window.firebaseReady.catch(e => console.warn("Firebase not ready:", e));
  }

  const db = window.db;
  const storage = window.storage || (window.firebase && firebase.storage && firebase.storage());

  if (!db) {
    alert("Firestore belum siap. Cek firebase-init.js & SDK include.");
    return;
  }

  // Product mapping
  const productNames = {
    kaos: "Kaos UDB",
    workshirt: "Workshirt UDB",
    hoodie: "Hoodie UDB",
    polo: "Polo Shirt UDB",
    jaket: "Jaket UDB",
    topi: "Topi Cap UDB"
  };

  // Price mapping (per unit)
  const productPrices = {
    kaos: 65000,
    workshirt: 85000,
    hoodie: 125000,
    polo: 75000,
    jaket: 150000,
    topi: 45000
  };

  let paymentProofFile = null;
  let selected =
    localStorage.getItem("selectedProduct") ||
    new URLSearchParams(window.location.search).get("product") ||
    "kaos";

  const productSelect = document.getElementById("productSelect");
  if (productSelect) productSelect.value = selected;

  function updateDpDisplay() {
    const qty = Number(document.getElementById("qty").value) || 1;
    const price = productPrices[selected] || 0;
    const total = price * qty;
    const dp = Math.ceil(total * 0.5);

    const dpElem = document.getElementById("dpAmount");
    if (dpElem) {
      dpElem.textContent =
        "Rp " +
        dp.toLocaleString("id-ID") +
        " (50% dari total Rp " +
        total.toLocaleString("id-ID") +
        ")";
    }
  }

  if (productSelect) {
    productSelect.addEventListener("change", function (e) {
      selected = e.target.value;
      localStorage.setItem("selectedProduct", selected);
      updateDpDisplay();
    });
  }

  const qtyEl = document.getElementById("qty");
  if (qtyEl) qtyEl.addEventListener("input", updateDpDisplay);

  // bukti OPTIONAL
  const proofInput = document.getElementById("paymentProof");
  if (proofInput) {
    proofInput.addEventListener("change", function (e) {
      const file = e.target.files[0];
      if (!file) {
        paymentProofFile = null;
        document.getElementById("uploadProgress").classList.add("hidden");
        return;
      }
      paymentProofFile = file;
      document.getElementById("uploadBar").style.width = "0%";
      document.getElementById("uploadProgress").classList.remove("hidden");
    });
  }

  window.addEventListener("load", updateDpDisplay);

  const form = document.getElementById("orderForm");
  if (!form) return;

  // helper upload progress
  function uploadWithProgress(ref, file, progressBar) {
    return new Promise((resolve, reject) => {
      const task = ref.put(file);
      task.on(
        "state_changed",
        snap => {
          const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
          progressBar.style.width = pct + "%";
          progressBar.textContent = pct + "%";
        },
        reject,
        () => resolve(task)
      );
    });
  }

  // timeout wrapper biar gak ngegantung
  function withTimeout(promise, ms = 15000) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("upload-timeout")), ms)
      )
    ]);
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const qtyVal = Number(document.getElementById("qty").value) || 1;
    const unitPrice = productPrices[selected] || 0;
    const totalPrice = unitPrice * qtyVal;
    const dpRequired = Math.ceil(totalPrice * 0.5);

    // validasi ukuran & warna wajib
    if (!document.getElementById("size").value) {
      alert("Silakan pilih ukuran!");
      return;
    }
    if (!document.getElementById("color").value) {
      alert("Silakan pilih warna!");
      return;
    }

    const order = {
      product: selected,
      productName: productNames[selected] || selected,
      nama: document.getElementById("nama").value,
      nim: document.getElementById("nim").value,
      kelas: document.getElementById("kelas").value,
      phone: document.getElementById("phone").value,
      size: document.getElementById("size").value,
      color: document.getElementById("color").value,
      qty: qtyVal,
      notes: document.getElementById("notes").value,
      unitPrice,
      totalPrice,
      dpRequired
    };

    // backup localStorage
    try {
      const orders = JSON.parse(localStorage.getItem("orders") || "[]");
      orders.push({ ...order, createdAt: new Date().toLocaleString("id-ID") });
      localStorage.setItem("orders", JSON.stringify(orders));
    } catch (err) {
      console.warn("localStorage save failed:", err);
    }

    const submitBtn = document.querySelector('#orderForm button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "Mengirim order...";

    const progressBar = document.getElementById("uploadBar");
    const resultEl = document.getElementById("result");
    resultEl.classList.remove("hidden");
    resultEl.className =
      "mt-6 p-4 bg-yellow-100 border border-yellow-300 text-yellow-800 rounded-lg";
    resultEl.innerHTML =
      "<div class='text-center'>⏳ Mengirim order, mohon tunggu...</div>";

    // ===== 1) SIMPAN ORDER KE FIRESTORE DULU (tanpa nunggu upload) =====
    let docRef = null;
    try {
      const firestoreOrder = {
        nama: order.nama,
        nim: order.nim,
        kelas: order.kelas,
        telepon: order.phone,
        produk: order.productName,
        jumlah: order.qty,
        ukuran: order.size,
        warna: order.color,
        catatan: order.notes,
        hargaTotal: order.totalPrice,
        dp: order.dpRequired,
        buktiUrl: "-",          // default dulu
        verified: false,
        uploadStatus: "no-proof",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      docRef = await db.collection("orders").add(firestoreOrder);
    } catch (fireErr) {
      console.error("FIRESTORE SAVE FAILED:", fireErr);
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      resultEl.className =
        "mt-6 p-4 bg-red-100 border border-red-300 text-red-800 rounded-lg";
      resultEl.innerHTML =
        "<div class='text-center'>❌ Gagal menyimpan order ke Firestore.</div>";
      alert("Gagal menyimpan order ke Firestore. Cek console.");
      return;
    }

    // ===== 2) COBA UPLOAD BUKTI (kalau ada). kalau gagal, skip =====
    let buktiUrl = "-";
    let uploadStatus = "no-proof";

    if (paymentProofFile && storage) {
      try {
        submitBtn.textContent = "Mengunggah bukti...";

        const timestamp = Date.now();
        const safeName = paymentProofFile.name.replace(/[^\w.\-]/g, "_");
        const storagePath = `orders/${timestamp}_${safeName}`;

        const ref = storage.ref(storagePath);
        const task = await withTimeout(
          uploadWithProgress(ref, paymentProofFile, progressBar),
          15000
        );

        buktiUrl = await task.snapshot.ref.getDownloadURL();
        uploadStatus = "uploaded";

        // update dokumen Firestore yang barusan dibuat
        await docRef.update({
          buktiUrl,
          uploadStatus
        });
      } catch (uploadErr) {
        console.warn("UPLOAD FAILED, order tetap masuk:", uploadErr);
        uploadStatus = "failed";

        // update status aja biar admin tau
        try {
          await docRef.update({ uploadStatus });
        } catch (e) {}
      }
    }

    // ===== 3) UI FINAL =====
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;

    resultEl.className =
      "mt-6 p-6 bg-green-100 border border-green-400 text-green-800 rounded-lg";

    if (uploadStatus === "uploaded") {
      resultEl.innerHTML = `
        <div class="text-center">
          <h3 class="text-xl font-bold mb-2">✓ Order + Bukti Masuk</h3>
          <p class="mb-2">Terima kasih <strong>${order.nama}</strong>, order kamu sudah masuk.</p>
          <p class="text-sm mb-2">Produk: <strong>${order.productName}</strong> | Jumlah: <strong>${order.qty}</strong></p>
          <p class="text-xs text-green-700">Admin akan verifikasi bukti DP secara manual.</p>
        </div>
      `;
    } else if (uploadStatus === "failed") {
      resultEl.innerHTML = `
        <div class="text-center">
          <h3 class="text-xl font-bold mb-2">✓ Order Masuk</h3>
          <p class="mb-2">Order masuk, tapi bukti DP gagal diupload.</p>
          <p class="text-sm">Silakan kirim bukti ke admin lewat WA / upload ulang nanti.</p>
        </div>
      `;
    } else {
      resultEl.innerHTML = `
        <div class="text-center">
          <h3 class="text-xl font-bold mb-2">✓ Order Masuk</h3>
          <p class="mb-2">Order kamu sudah masuk. Bukti DP bisa diupload nanti.</p>
        </div>
      `;
    }

    // reset form
    document.getElementById("orderForm").style.display = "none";
    paymentProofFile = null;
    if (proofInput) proofInput.value = "";
    document.getElementById("uploadProgress").classList.add("hidden");
  });

  document.getElementById("cancelBtn")
    .addEventListener("click", () => window.history.back());
  document.getElementById("backBtn")
    .addEventListener("click", () => window.history.back());
})();
