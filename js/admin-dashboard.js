// admin-dashboard.js
(async function () {
  // tunggu firebase init
  if (window.firebaseReady) {
    await window.firebaseReady.catch(e => console.warn("Firebase init gagal:", e));
  }

  const db = window.db || (window.firebase && firebase.firestore && firebase.firestore());
  const auth = window.auth || (window.firebase && firebase.auth && firebase.auth());

  const ADMIN_UID = "DSNoDr0mLvaOYlpRyh6WTdtgzyI2";

  // ===== Debug panel helper =====
  function ensureDebugPanel(){
    let dbg = document.getElementById('fbDebug');
    if (dbg) return dbg;
    dbg = document.createElement('div');
    dbg.id = 'fbDebug';
    dbg.style.position = 'fixed';
    dbg.style.right = '12px';
    dbg.style.top = '72px';
    dbg.style.zIndex = '9999';
    dbg.style.width = '320px';
    dbg.style.maxHeight = '60vh';
    dbg.style.overflow = 'auto';
    dbg.style.background = 'rgba(0,0,0,0.75)';
    dbg.style.color = '#fff';
    dbg.style.padding = '10px';
    dbg.style.borderRadius = '8px';
    dbg.style.fontSize = '12px';
    dbg.style.fontFamily = 'monospace';
    dbg.innerHTML = '<strong>Firebase debug</strong><div id="fbDebugContent" style="margin-top:8px"></div>';
    document.body.appendChild(dbg);
    return dbg;
  }

  function updateDebug(obj){
    const dbg = ensureDebugPanel();
    const c = document.getElementById('fbDebugContent');
    const rows = [];
    for (const k of Object.keys(obj)){
      rows.push(`<div><strong>${k}:</strong> ${String(obj[k])}</div>`);
    }
    c.innerHTML = rows.join('');
  }

  // ===== render orders =====
  function renderOrders(orders) {
    const ordersTable = document.getElementById('ordersTable');
    const emptyState = document.getElementById('emptyState');

    if (!orders || orders.length === 0) {
      ordersTable.innerHTML = '';
      emptyState.style.display = 'block';
      calculateStats([], null);
      return;
    }

    emptyState.style.display = 'none';
    ordersTable.innerHTML = orders.map((order, idx) => `
      <tr class="hover:bg-gray-50 transition">
        <td class="py-3 px-4 text-gray-700">${idx + 1}</td>
        <td class="py-3 px-4 text-gray-700 font-medium">${order.nama}</td>
        <td class="py-3 px-4 text-gray-700">${order.productName || order.produk || '-'}</td>
        <td class="py-3 px-4 text-gray-700">
          <span class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
            ${order.qty || order.jumlah || 1} pcs
          </span>
        </td>
        <td class="py-3 px-4 text-gray-700">${order.size || order.ukuran || '-'}</td>
        <td class="py-3 px-4 text-gray-600 text-sm">${order.phone || order.telepon || '-'}</td>
        <td class="py-3 px-4 text-gray-600 text-sm">
          ${
            (order.createdAt && order.createdAt.toLocaleString)
              ? order.createdAt.toLocaleString('id-ID')
              : (order.createdAt && order.createdAt.toDate)
                ? order.createdAt.toDate().toLocaleString('id-ID')
                : (order.createdAt || '-')
          }
        </td>
        <td class="py-3 px-4">
          <button class="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
            onclick="window.viewOrderDetailFirestore && window.viewOrderDetailFirestore('${order.id || ''}')">
            Lihat
          </button>
        </td>
      </tr>
    `).join('');

    calculateStats(orders, null);
  }

  async function fetchOrdersFromFirestore() {
    try {
      if (!db) throw new Error('Firestore belum terinisialisasi');

      updateDebug({ status: 'fetching orders...', online: navigator.onLine });

      const snapshot = await db.collection('orders').orderBy('createdAt','desc').get();

      const orders = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          nama: data.nama || '-',
          nim: data.nim || '-',
          kelas: data.kelas || '-',
          phone: data.telepon || '-',
          productName: data.produk || '-',
          qty: data.jumlah || (data.qty || 1),
          size: data.ukuran || '-',
          notes: data.catatan || '-',
          createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
          totalPrice: data.hargaTotal || data.harga_total || 0,
          dpRequired: data.dp || data.dpRequired || 0,
          buktiUrl: data.buktiUrl || ''
        };
      });

      renderOrders(orders);
      updateDebug({ status: 'fetched ' + orders.length + ' orders', online: navigator.onLine });

    } catch (err) {
      console.error('Error fetching orders from Firestore', err);

      const fallback = JSON.parse(localStorage.getItem('orders') || '[]');
      if (fallback && fallback.length) {
        renderOrders(fallback.map((o, idx) => ({ id: idx, ...o })));
        alert('Tidak dapat mengambil data Firestore — menggunakan data lokal. (lihat console untuk detail)');
        return;
      }
      alert('Gagal memuat orders dari Firestore. (lihat console)');
    }
  }

  function calculateStats(orders) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    document.getElementById('totalOrders').textContent = orders.length;

    const todayOrders = orders.filter(o => {
      const orderDate = new Date(o.createdAt);
      const orderDay = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate());
      return orderDay.getTime() === today.getTime();
    }).length;
    document.getElementById('todayOrders').textContent = todayOrders;

    const totalRevenue = orders.reduce((sum, order) => sum + (order.totalPrice || 0), 0);
    document.getElementById('totalRevenue').textContent = 'Rp ' + totalRevenue.toLocaleString('id-ID');

    const uniqueCustomers = new Set(orders.map(o => o.nama)).size;
    document.getElementById('totalCustomers').textContent = uniqueCustomers;

    const productStats = {};
    orders.forEach(order => {
      const key = order.productName || order.product;
      productStats[key] = (productStats[key] || 0) + (order.qty || order.jumlah || 1);
    });

    document.getElementById('productStats').innerHTML = Object.entries(productStats)
      .sort((a, b) => b[1] - a[1])
      .map(([product, qty]) => `
        <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
          <span class="font-medium text-gray-700">${product}</span>
          <span class="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm font-semibold">
            ${qty} pcs
          </span>
        </div>
      `).join('');

    const topProd = Object.entries(productStats).sort((a, b) => b[1] - a[1])[0];
    if (topProd) {
      document.getElementById('topProduct').innerHTML = `
        <div class="text-center">
          <p class="text-3xl mb-2">🏆</p>
          <p class="text-lg font-bold text-gray-800">${topProd[0]}</p>
          <p class="text-sm text-gray-600 mt-1">${topProd[1]} unit terjual</p>
        </div>
      `;
    }

    document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString('id-ID');
  }

  window.viewOrderDetailFirestore = function(docId){
    if (!db) { alert('Firestore belum siap'); return; }
    db.collection('orders').doc(docId).get().then(doc => {
      if (!doc.exists) { alert('Order tidak ditemukan'); return; }
      const o = doc.data();
      alert(`
📋 Detail Order

Nama: ${o.nama || '-'}
NIM: ${o.nim || '-'}
Kelas: ${o.kelas || '-'}
Telepon: ${o.telepon || '-'}

Produk: ${o.produk || '-'}
Jumlah: ${o.jumlah || o.qty || 1} pcs
Ukuran: ${o.ukuran || '-'}
Warna: ${o.warna || '-'}

Catatan: ${o.catatan || '-'}
DP: Rp ${(o.dp||0).toLocaleString('id-ID')}
Total: Rp ${(o.hargaTotal||o.harga_total||0).toLocaleString('id-ID')}
Waktu: ${o.createdAt ? o.createdAt.toDate().toLocaleString('id-ID') : '-'}

Bukti: ${o.buktiUrl || '-'}
      `);
    }).catch(err => { console.error(err); alert('Gagal memuat detail order'); });
  };

  // tombol refresh & download
  document.getElementById('refreshBtn')
    .addEventListener('click', function(){
      this.textContent = '⏳ Loading...';
      fetchOrdersFromFirestore().finally(() => {
        this.textContent = '🔄 Refresh';
      });
    });

  document.getElementById('downloadBtn')
    .addEventListener('click', downloadRecap);

  async function downloadRecap() {
    // sama persis logic kamu, biarin aja
    const getOrders = async () => {
      try {
        if (db) {
          const snap = await db.collection('orders').orderBy('createdAt','desc').get();
          return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        }
      } catch (e) {
        console.warn('Firestore fetch failed, falling back to localStorage', e);
      }
      return JSON.parse(localStorage.getItem('orders') || '[]');
    };

    const orders = await getOrders();
    if (!orders || orders.length === 0) { alert('Tidak ada data order untuk didownload'); return; }

    const headers = ['No.', 'Nama', 'NIM', 'Telepon', 'Produk', 'Jumlah', 'Ukuran', 'Warna', 'Harga Satuan', 'Total', 'Tanggal Order', 'Bukti URL'];
    const rows = orders.map((o, idx) => {
      const harga = o.hargaTotal || o.harga_total || o.totalPrice || 0;
      const jumlah = o.jumlah || o.qty || 1;
      return [
        idx + 1,
        o.nama || '-',
        o.nim || '-',
        o.telepon || o.phone || '-',
        o.produk || o.productName || '-',
        jumlah,
        o.ukuran || o.size || '-',
        o.warna || o.color || '-',
        'Rp ' + (o.unitPrice ? o.unitPrice.toLocaleString('id-ID') : '-'),
        'Rp ' + (harga ? harga.toLocaleString('id-ID') : '-'),
        o.createdAt && o.createdAt.toDate ? o.createdAt.toDate().toLocaleString('id-ID') : (o.createdAt || '-'),
        o.buktiUrl || '-'
      ];
    });

    const totalQuantity = orders.reduce((s, o) => s + (o.jumlah || o.qty || 1), 0);
    const totalRevenue = orders.reduce((s, o) => s + (o.hargaTotal || o.harga_total || o.totalPrice || 0), 0);

    let csvContent = 'REKAP ORDER MERCHANDISE UDB\n';
    csvContent += 'Dibuat: ' + new Date().toLocaleString('id-ID') + '\n\n';
    csvContent += headers.map(h => '"' + h + '"').join(',') + '\n';
    csvContent += rows.map(row => row.map(cell => '"' + String(cell).replace(/"/g, '""') + '"').join(',')).join('\n');
    csvContent += '\n\nRINGKASAN\n';
    csvContent += '"Total Order","' + orders.length + '"\n';
    csvContent += '"Total Jumlah Barang","' + totalQuantity + ' pcs"\n';
    csvContent += '"Total Revenue","Rp ' + totalRevenue.toLocaleString('id-ID') + '"\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const fileName = 'Rekap_Order_' + new Date().toISOString().split('T')[0] + '.csv';
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    alert('✅ Rekap berhasil didownload: ' + fileName);
  }

  // logout
  document.getElementById('logoutBtn')
    .addEventListener('click', function(){
      if (!confirm('Apakah Anda yakin ingin logout?')) return;
      if (auth) {
        auth.signOut().finally(() => {
          localStorage.removeItem('adminSession');
          window.location.href = 'index.html';
        });
      } else {
        localStorage.removeItem('adminSession');
        window.location.href = 'index.html';
      }
    });

  // ===== INIT AUTH =====
  function startAfterAdminOK() {
    fetchOrdersFromFirestore();
    setInterval(fetchOrdersFromFirestore, 5000);
  }

  // demo mode
  const demoSession = localStorage.getItem("adminSession");
  if (demoSession) {
    updateDebug({ status: "demo mode", online: navigator.onLine });
    const localOrders = JSON.parse(localStorage.getItem("orders") || "[]");
    renderOrders(localOrders.map((o, idx) => ({ id: idx, ...o })));
    startAfterAdminOK();
    return;
  }

  // firebase auth mode
  if (!auth) {
    alert("Firebase Auth belum siap / SDK belum di-include.");
    return;
  }

  auth.onAuthStateChanged(user => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    if (user.uid !== ADMIN_UID) {
      alert("Akun yang digunakan bukan admin.");
      auth.signOut().then(() => window.location.href = "login.html");
      return;
    }

    const adminNameEl = document.getElementById("adminName");
    if (adminNameEl) adminNameEl.textContent = `👤 ${user.email || user.displayName || "Admin"}`;

    updateDebug({ status: "admin ok", uid: user.uid, email: user.email });
    startAfterAdminOK();
  });

})();
