const { createApp } = Vue;

createApp({
	data() {
		return {
			// Mengambil sumber data dari dataBahanAjar.js
			paketList: (typeof paket !== 'undefined') ? paket : [],
			upbjjList: (typeof upbjjList !== 'undefined') ? upbjjList : [],
			pengirimanList: (typeof pengirimanList !== 'undefined') ? pengirimanList : [],
			derivedPaketFromItems: [],
			dummyTrackingData: null,

			// Form input
			form: {
				nomorDO: "",
				nim: "",
				nama: "",
				ekspedisi: "",
				paketKode: "",
				tanggalKirim: "",
			},

			// List Delivery Order
			orders: [],

			// Modal state
			showDetailModal: false,
			detailOrder: null,

			// UI helpers
			today: new Date(),
		};
	},

	computed: {
		// Muat semua daftar paket
		allPaketList() {
			if (Array.isArray(this.paketList)) return this.paketList;
			if (this.derivedPaketFromItems.length) return this.derivedPaketFromItems;
			return [];
		},

		// Daftar opsi ekspedisi
		ekspedisiOptions() {
			if (Array.isArray(this.pengirimanList) && this.pengirimanList.length) return this.pengirimanList;
			if (Array.isArray(this.upbjjList) && this.upbjjList.length) return this.upbjjList;
			// Derive dari item dataBahanAjar
			if (Array.isArray(window.dataBahanAjar)) {
				const set = new Set(window.dataBahanAjar.map(i => i.upbjj).filter(Boolean));
				return Array.from(set);
			}
			return [];
		},

		// Detail paket yang dipilih di form
		paketDetail() {
			const kode = this.form.paketKode;
			if (!kode) return null;
			return this.allPaketList.find(p => p.kode === kode) || null;
		},

		// Total harga dengan format Rupiah
		totalHarga() {
			const harga = this.paketDetail && (this.paketDetail.harga || 0);
			return this.formatRupiah(harga);
		},

		// Generate nomor DO untuk selanjutnya
		nextNomorDO() {
			return this._generateNextDO();
		},

		// Tampilkan orders + (opsional) dataTracking merged
		displayedOrders() {
			// Tampilkan orders + dataTracking merged
			const merged = [...this.orders];
			
			// Tambahkan dari dataTracking jika ada
			if (typeof this.dummyTrackingData === "object" && this.dummyTrackingData !== null) {
				Object.keys(this.dummyTrackingData).forEach(k => {
					const rec = this.dummyTrackingData[k];
					// Normalize to our order shape
					merged.push({
						nomorDO: rec.nomorDO || k,
						nim: rec.nim || rec.namaN || "",
						nama: rec.nama || rec.namaPenerima || "",
						paketKode: rec.paket || "",
						ekspedisi: rec.ekspedisi || "",
						tanggalKirim: rec.tanggalKirim || rec.tanggal || "",
						total: rec.total || rec.totalPembayaran || 0,
						status: rec.status || "Dalam Proses",
						perjalanan: Array.isArray(rec.perjalanan) ? rec.perjalanan : []
					});
				});
			}
			return merged;
		}
	},

	methods: {
		// Format angka ke Rupiah
		formatRupiah(value) {
			const n = Number(value) || 0;
			return n.toLocaleString("id-ID", { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
		},

		// Generate DO selanjutnya berdasarkan existing orders + dataTracking (cek tahun)
		_generateNextDO() {
			const year = new Date().getFullYear();
			const prefix = `DO${year}-`;
			const numbers = [];

			this.orders.forEach(o => {
				if (typeof o.nomer === "string") return; // Ignore
				if (o.nomorDO && o.nomorDO.startsWith(prefix)) {
				numbers.push(o.nomorDO);
				}
			});

			if (typeof window.dataTracking === "object" && window.dataTracking !== null) {
				Object.values(window.dataTracking).forEach(rec => {
					if (rec && rec.nomorDO && rec.nomorDO.startsWith(prefix)) numbers.push(rec.nomorDO);
				});
			}

			// Parse max sequence
			let maxSeq = 0;
			numbers.forEach(str => {
				const m = str.match(new RegExp(`DO${year}-(\\d+)`));
				if (m && m[1]) {
					const v = parseInt(m[1], 10);
					if (v > maxSeq) maxSeq = v;
				}
			});

			const next = (maxSeq + 1).toString().padStart(3, '0');
			return `${prefix}${next}`;
		},

		// Helper untuk memformat tanggal ke format ISO yyyy-mm-dd
		_formatDateISO(d) {
			if (!d) return '';
			const y = d.getFullYear();
			const m = (d.getMonth() + 1).toString().padStart(2, '0');
			const day = d.getDate().toString().padStart(2, '0');
			return `${y}-${m}-${day}`;
		},

		// Validasi form
		validateForm(item) {
			let isValid = true;
			const fields = ['nomorDO', 'nim', 'nama', 'ekspedisi', 'paketKode', 'tanggalKirim'];

			fields.forEach(field => {
				const feedback = document.getElementById(`${field}-msg`);
				const input = document.getElementById(`${field}`);
				const value = item[field];

				// Reset class dan pesan sebelumnya
				if (input) input.classList.remove('is-invalid');
				if (feedback) feedback.textContent = '';

				// Validasi umum: tidak boleh kosong
				if (!value || value === '') {
					isValid = false;
					if (input) input.classList.add('is-invalid');
					if (feedback) feedback.textContent = `${field.charAt(0).toUpperCase() + field.slice(1)} harus diisi`;
				} else {
					// Validasi spesifik ekspedisi
					if (field === "ekspedisi") {
						const isValidEkspedisi = Array.isArray(this.ekspedisiOptions) ? this.ekspedisiOptions.some(e => {
							// Berupa string atau object
							if (typeof e === "string") return e === value;
							if (e.kode) return e.kode === value;
							if (e.nama) return e.nama === value;
							return false;
						}) : false;
						console.log("Validating ekspedisi:", value, this.ekspedisiOptions, isValidEkspedisi);

						if (!isValidEkspedisi) {
							isValid = false;
							if (input) input.classList.add("is-invalid");
							if (feedback) feedback.textContent = "Ekspedisi tidak valid";
						}
					}

					// Validasi spesifik paketKode
					if (field === 'paketKode') {
						const isValidPaket = Array.isArray(this.allPaketList) ? this.allPaketList.some(p => p.kode === value) : false;
						console.log('Validating paketKode:', value, this.allPaketList, isValidPaket);

						if (!isValidPaket) {
							isValid = false;
							if (input) input.classList.add('is-invalid');
							if (feedback) feedback.textContent = 'Paket tidak valid';
						}
					}
				}
			});

			return isValid;
		},

		// Reset feedback dan is-invalid
		resetValidation() {
			const fields = ['kode', 'judul', 'kategori', 'upbjj', 'lokasiRak', 'harga'];
			fields.forEach(field => {
				const input = document.getElementById(`${field}`);
				const feedback = document.getElementById(`${field}-msg`);
				if (input) input.classList.remove('is-invalid');
				if (feedback) feedback.textContent = '';
			});
		},

		// Persiapan form untuk tambah / reset form (generate DO, set date)
		newDO() {
			this.form.nomorDO = this._generateNextDO();
			// Set tanggal default ke tanggal hari ini
			this.form.tanggalKirim = this._formatDateISO(new Date());
			this.form.nim = '';
			this.form.nama = '';
			this.form.ekspedisi = this.ekspedisiOptions.length ? this.ekspedisiOptions[0] : '';
			this.form.paketKode = this.allPaketList.length ? this.allPaketList[0].kode : '';
		},

		// Simpan DO ke array orders
		saveDO() {
			// Validasi
			if (!this.validateForm(this.form)) return;

			const paket = this.paketDetail;
			const total = paket ? (paket.harga || 0) : 0;

			const order = {
				nomorDO: this.form.nomorDO || this._generateNextDO(),
				nim: this.form.nim,
				nama: this.form.nama,
				paketKode: this.form.paketKode,
				paketNama: paket ? (paket.nama || paket.title || paket.label || paket.kode) : '',
				ekspedisi: this.form.ekspedisi,
				tanggalKirim: this.form.tanggalKirim,
				total: total,
				status: 'Dalam Proses',
				perjalanan: [] // Awalnya kosong
			};

			this.orders.push(order);

			// Setelah simpan, siapkan form baru untuk input berikutnya
			this.newDO();
		},

		// menampilkan badge sesuai status
		badgeClass(status) {
			if (!status) return "badge bg-secondary";
			if (status === "Dalam Perjalanan") return "badge bg-primary";
			if (status === "Dalam Proses") return "badge bg-warning text-dark";
			if (status === "Dikirim") return "badge bg-info";
			if (status === "Selesai") return "badge bg-success";
			return "badge bg-secondary";
		},

		// Buka modal detail order
		openDetail(order) {
			// jika parameter adalah nomorDO string, cari order
			let o = order;
			if (typeof order === "string") {
				o = this.displayedOrders.find(x => x.nomorDO === order) || null;
			}
			this.detailOrder = o ? JSON.parse(JSON.stringify(o)) : null;
			this.showDetailModal = !!this.detailOrder;
		},

		// Tutup modal detail order
		closeDetail() {
			this.showDetailModal = false;
			this.detailOrder = null;
		},

		// Paket isi (array) untuk ditampilkan di select
		paketIsiList(p) {
			if (!p) return [];
			return p.isi || p.items || p.list || [];
		},

		// Helper untuk memformat tanggal
		fmtTanggalDisplay(d) {
			if (!d) return '-';
			try {
				const dt = new Date(d);
				return dt.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
			} catch (e) {
				return d;
			}
		},

		// Helper untuk memformat tanggal dan waktu
		fmtTanggalWaktuDisplay(d) {
			if (!d) return '-';
			try {
				const dt = new Date(d);
				return dt.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
			} catch (e) {
				return d;
			}
		},

		// Helper: Build derived paket list dari dataBahanAjar
		_buildDerivedPaketFromItems() {
			if (Array.isArray(window.dataBahanAjar) && !this.paketList) {
				// group items by kode as paket with single item each (fallback)
				this.derivedPaketFromItems = window.dataBahanAjar.map(it => ({
					kode: it.kode || ("PKT-" + (it.kode || Math.random().toString(36).slice(2,7))),
					nama: it.judul || it.nama || ("Paket " + (it.kode || "")),
					isi: [ it.judul || "" ],
					harga: it.harga || 0
				}));
			}
		},

		// Ubah status order
		setStatus(order, status) {
			const idx = this.orders.findIndex(o => o.nomorDO === order.nomorDO);
			if (idx !== -1) {
				this.orders[idx].status = status;
			}
		},

		// Tampilkan riwayat perjalanan berdasarkan urutan terbaru pertama
		getPerjalananSorted(order) {
			const arr = order && Array.isArray(order.perjalanan) ? [...order.perjalanan] : [];
			return arr.sort((a,b) => {
				const ta = new Date(a.waktu).getTime() || 0;
				const tb = new Date(b.waktu).getTime() || 0;
				return tb - ta;
			});
		},

		// Tambahkan util untuk mengelola class body modal-open
		toggleBodyClass() {
            const anyOpen = !!(this.showAddModal || this.showEditModal);
            try {
                if (anyOpen) {
                    document.body.classList.add('modal-open');
                } else {
                    document.body.classList.remove('modal-open');
                }
            } catch (e) {
                // ignore (mis. SSR)
            }
        }
	},

	// Pantau perubahan pada form input paketKode dan nim
	watch: {
		// Jika paket dipilih, isi detail paket akan otomatis muncul (side-effect: nothing needed, paketDetail computed sudah update)
		'form.paketKode'(nv, ov) {
			// Jika paket berubah, set tanggal default jika kosong
			if (!this.form.tanggalKirim) {
				this.form.tanggalKirim = this._formatDateISO(new Date());
			}
		},

		// Jika nim berubah, kita bisa otomatis trim dan (opsional) autofill nama dari dataBahanAjar (jika ada mapping)
		'form.nim'(nv, ov) {
			this.form.nim = (nv || '').trim();
			// Jika ada mapping nim->nama di dataTracking, isi nama otomatis
			if (typeof window.dataTracking === 'object' && window.dataTracking !== null) {
				const key = Object.keys(window.dataTracking).find(k => {
					const rec = window.dataTracking[k];
					return rec && (rec.nim === this.form.nim || rec.nomorDO === this.form.nim);
				});
				if (key && window.dataTracking[key] && window.dataTracking[key].nama) {
					this.form.nama = window.dataTracking[key].nama;
				}
			}
		},

		// Modal edit
        showDetailModal() {
            this.toggleBodyClass();
        }
	},

	mounted() {
		// Build derived paket jika diperlukan
		this._buildDerivedPaketFromItems();

		// Inisiasi form dan menambahkan nomor DO dan tanggal
		this.newDO();

		// Deteksi otomatis data tracking dummy
		if (!window.dataTracking) {
			const candidates = Object.keys(window).filter(k =>
			k.toLowerCase().includes('tracking')
			);
			if (candidates.length > 0) {
				window.dataTracking = window[candidates[0]];

				// Tampilkan pesan di console untuk debugging
				console.log('Data dummy tracking terdeteksi:', candidates[0]);
			}
		}

		// Masukkin dataTracking ke orders agar reaktif
		if (typeof window.dataTracking === "object" && window.dataTracking !== null) {
			const arr = Object.keys(window.dataTracking).map(k => {
				const rec = window.dataTracking[k];
				return {
					nomorDO: rec.nomorDO || k,
					nim: rec.nim || rec.namaN || "",
					nama: rec.nama || rec.namaPenerima || "",
					paketKode: rec.paket || "",
					paketNama: rec.namaPaket || rec.paket || "",
					ekspedisi: rec.ekspedisi || "",
					tanggalKirim: rec.tanggalKirim || rec.tanggal || "",
					total: rec.total || rec.totalPembayaran || 0,
					status: rec.status || "Dalam Proses",
					perjalanan: Array.isArray(rec.perjalanan) ? rec.perjalanan : []
				};
			});
			this.orders = arr;

			// Tampilkan pesan di console untuk debugging
			console.log('Data dummy tracking dimuat:', this.orders);
		} else {
			// Tampilkan pesan di console untuk debugging
			console.warn('Data dummy tracking Tidak ditemukan dataTracking di dataBahanAjar.js');
		}
	}

}).mount("#app");