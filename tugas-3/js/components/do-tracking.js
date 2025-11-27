const Tracking = Vue.defineAsyncComponent(() => {
	// Muat template HTML dari templates/do-tracking.html
	return fetch('templates/do-tracking.html').then(response => response.text()).then(template => {
		return {
			template: template,
			data() {
				return {
					// Ambil data dari ApiService (dataBahanAjar.json)
					paketList: [],
					upbjjList: [],
					pengirimanList: [],
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

					// Pencarian (input dan nilai yang dipakai untuk filter)
					searchQuery: '',
					activeSearch: '',

					// List Delivery Order
					orders: [],

					// Modal state
					showDetailModal: false,
					detailOrder: null,

						// Indeks order aktif di this.orders saat modal detail dibuka
						_activeOrderIndex: -1,

						// New history note when adding perjalanan
						newHistoryNote: '',

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
					// gunakan helper global yang didaftarkan di app.config.globalProperties
					if (this && this.$formatRupiah) return this.$formatRupiah(harga);
					return (Number(harga) || 0).toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
				},

				// Generate nomor DO untuk selanjutnya
				nextNomorDO() {
					return this._generateNextDO();
				},

				// Tampilkan orders yang sudah berisi data tracking + saved orders
				displayedOrders() {
					const all = Array.isArray(this.orders) ? this.orders : [];
					const q = (this.activeSearch || '').toString().trim().toLowerCase();
					if (!q) return all;
					return all.filter(o => {
						const nomor = (o.nomorDO || '').toString().toLowerCase();
						const nim = (o.nim || '').toString().toLowerCase();
						const nama = (o.nama || '').toString().toLowerCase();
						return nomor.includes(q) || nim.includes(q) || nama.includes(q);
					});
				},
			},

			methods: {
				// Generate DO selanjutnya berdasarkan orders + dataTracking sebelumnya (cek tahun)
				_generateNextDO() {
					const year = new Date().getFullYear();
					const prefix = `DO${year}-`;
					const numbers = [];

					// Kumpulkan semua nomor DO yang ada
					this.orders.forEach(o => {
						if (typeof o.nomer === "string") return; // Ignore
						if (o.nomorDO && o.nomorDO.startsWith(prefix)) {
						numbers.push(o.nomorDO);
						}
					});

					// Cek di dummyTrackingData juga
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

				// Terapkan pencarian (submit) — set activeSearch yang digunakan oleh displayedOrders
				applySearch() {
					this.activeSearch = (this.searchQuery || '').toString().trim();
				},

				// Clear search (reset input + active)
				clearSearch() {
					this.searchQuery = '';
					this.activeSearch = '';
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

					// Siapkan form baru untuk input berikutnya
					this.newDO();
				},

				// Menampilkan warna badge sesuai status
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
					// Jika parameter adalah nomorDO string, cari order
					let target = null;
					if (typeof order === 'string') {
						target = this.orders.find(x => x.nomorDO === order) || null;
					} else if (order && order.nomorDO) {
						// find in orders by nomorDO to get canonical record
						target = this.orders.find(x => x.nomorDO === order.nomorDO) || order;
					} else {
						target = null;
					}

					if (target) {
						this._activeOrderIndex = this.orders.findIndex(x => x.nomorDO === target.nomorDO);
						this.detailOrder = JSON.parse(JSON.stringify(target));
					} else {
						this._activeOrderIndex = -1;
						this.detailOrder = null;
					}

					this.newHistoryNote = '';
					this.showDetailModal = !!this.detailOrder;
				},

				// Tutup modal detail order
				closeDetail() {
					this.showDetailModal = false;
					this.detailOrder = null;
					this._activeOrderIndex = -1;
					this.newHistoryNote = '';
				},

				// Tambah riwayat perjalanan ke order aktif
				addPerjalanan() {
					if (!this.detailOrder) return;
					const note = (this.newHistoryNote || '').toString().trim();
					if (!note) return; // Jangan tambah jika kosong

					const entry = {
						waktu: new Date().toISOString(),
						keterangan: note
					};

					// Perbarui order kanonis di this.orders jika indeks diketahui
					if (this._activeOrderIndex !== -1 && this.orders[this._activeOrderIndex]) {
						const ord = this.orders[this._activeOrderIndex];
						if (!Array.isArray(ord.perjalanan)) ord.perjalanan = [];
						ord.perjalanan.push(entry);
						ord.status = 'Dalam Perjalanan';
						// Reflect back to detailOrder (copy)
						this.detailOrder.perjalanan = JSON.parse(JSON.stringify(ord.perjalanan));
						this.detailOrder.status = ord.status;
					} else {
						// If for some reason index unknown, mutate detailOrder and try to merge later
						if (!Array.isArray(this.detailOrder.perjalanan)) this.detailOrder.perjalanan = [];
						this.detailOrder.perjalanan.push(entry);
						this.detailOrder.status = 'Dalam Perjalanan';
					}

					this.newHistoryNote = '';
				},

				// Tandai order selesai: sembunyikan form dan tombol
				markSelesai() {
					if (this._activeOrderIndex !== -1 && this.orders[this._activeOrderIndex]) {
						this.orders[this._activeOrderIndex].status = 'Selesai';
						// update detailOrder as well
						if (this.detailOrder) this.detailOrder.status = 'Selesai';
					}
					// Bersihkan newHistoryNote untuk menyembunyikan efek form
					this.newHistoryNote = '';
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

				// Helper untuk build derived paket list dari dataBahanAjar
				_buildDerivedPaketFromItems() {
					if (Array.isArray(window.dataBahanAjar) && !this.paketList) {
						// Group items by kode as paket with single item each (fallback)
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
						// Ignore (mis. SSR)
					}
				},

				// Helper untuk mendapatkan nama paket berdasarkan kode paket
				_getPaketNama(kode) {
					if (!kode) return '';
					const paket = this.allPaketList.find(p => p.kode === kode);
					return paket ? (paket.nama || paket.title || paket.label || kode) : kode;
				},
			},

			// Pantau perubahan pada form input paketKode dan nim
			watch: {
				// Jika paket dipilih, isi detail paket akan otomatis muncul (side-effect: nothing needed, paketDetail computed sudah update)
				'form.paketKode'(nv, ov) {
					// Jika paket diganti, set tanggal default jika kosong
					if (!this.form.tanggalKirim) {
						this.form.tanggalKirim = this._formatDateISO(new Date());
					}
				},

				// Jika NIM diganti, otomatis trim dan (opsional) autofill nama dari dataBahanAjar (jika ada mapping)
				'form.nim'(nv, ov) {
					this.form.nim = (nv || '').trim();
					if (!this.form.nim) {
						this.form.nama = '';
						return;
					}

					// Cari di this.orders (sudah dinormalisasi pada mounted)
					if (Array.isArray(this.orders) && this.orders.length) {
						const found = this.orders.find(o => (o.nim || '').toString().trim().toLowerCase() === this.form.nim.toString().trim().toLowerCase());
						if (found && found.nama) {
							this.form.nama = found.nama;
							return;
						}
					}

					// Cari di dummyTrackingData (bisa berbentuk object atau array dengan nested objects)
					const searchInDummy = (data) => {
						if (!data) return null;

						// Array shape
						if (Array.isArray(data)) {
							for (const el of data) {
								if (!el || typeof el !== 'object') continue;
								const keys = Object.keys(el);
								if (keys.length === 1 && el[keys[0]] && typeof el[keys[0]] === 'object') {
									const rec = el[keys[0]];
									if ((rec.nim && rec.nim.toString().trim().toLowerCase() === this.form.nim.toString().trim().toLowerCase()) || (rec.nomorDO && rec.nomorDO.toString().trim().toLowerCase() === this.form.nim.toString().trim().toLowerCase())) return rec;
								} else {
									if ((el.nim && el.nim.toString().trim().toLowerCase() === this.form.nim.toString().trim().toLowerCase()) || (el.nomorDO && el.nomorDO.toString().trim().toLowerCase() === this.form.nim.toString().trim().toLowerCase())) return el;
								}
							}
							return null;
						}

						// Object keyed by DO
						if (typeof data === 'object') {
							for (const k of Object.keys(data)) {
								const rec = data[k];
								if (!rec || typeof rec !== 'object') continue;
								if ((rec.nim && rec.nim.toString().trim().toLowerCase() === this.form.nim.toString().trim().toLowerCase()) || (rec.nomorDO && rec.nomorDO.toString().trim().toLowerCase() === this.form.nim.toString().trim().toLowerCase())) return rec;
							}
						}
						return null;
					};

					let rec = null;
					if (this.dummyTrackingData) rec = searchInDummy(this.dummyTrackingData);

					// Fallback ke window.dataTracking jika ada
					if (!rec && typeof window.dataTracking === 'object' && window.dataTracking !== null) {
						rec = searchInDummy(window.dataTracking);
					}

					if (rec && rec.nama) {
						this.form.nama = rec.nama;
					}
				},

				// Modal edit
				showDetailModal() {
					this.toggleBodyClass();
				}
			},

			mounted() {
				// Inisiasi form dan menambahkan nomor DO dan tanggal
				this.newDO();

				// Ambil data dari ApiService menggunakan axios
				if (typeof ApiService === 'undefined') {
					console.error('Terjadi kesalahan pada API service.');
					Swal.fire({
						icon: 'error',
						title: 'Oops...',
						text: 'Terjadi kesalahan pada API service.'
					});

					// Perilaku fallback yang ada di window.dataTracking
					this._buildDerivedPaketFromItems();
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
					}
				} else {
					// Ambil semua data yang dibutuhkan secara paralel
					Promise.all([
						ApiService.getPaket(),
						ApiService.getPengirimanList(),
						ApiService.getUpbjjList(),
						ApiService.getTracking()
					]).then(([paket, pengiriman, upbjj, tracking]) => {
						this.paketList = paket || [];
						this.pengirimanList = pengiriman || [];
						this.upbjjList = upbjj || [];
						this.dummyTrackingData = tracking || null;

						// Normalisasikan pelacakan ke dalam this.orders (mendukung dalam bentuk bentuk objek atau array)
						const normalizeTracking = (data) => {
							const out = [];
							if (!data) return out;

							// Jika data adalah array, ulangi elemennya
							if (Array.isArray(data)) {
								data.forEach(el => {
									if (el && typeof el === 'object') {
										const keys = Object.keys(el);

										// Jika elemen adalah objek dengan single key (nested object)
										if (keys.length === 1 && el[keys[0]] && typeof el[keys[0]] === 'object') {
											const rec = el[keys[0]];
											const paketNama = this._getPaketNama(rec.paket || '');
											out.push({
												nomorDO: rec.nomorDO || keys[0],
												nim: rec.nim || rec.namaN || '',
												nama: rec.nama || rec.namaPenerima || '',
												paketKode: rec.paket || '',
												paketNama: paketNama || rec.namaPaket || rec.paket || '',
												ekspedisi: rec.ekspedisi || '',
												tanggalKirim: rec.tanggalKirim || rec.tanggal || '',
												total: rec.total || rec.totalPembayaran || 0,
												status: rec.status || 'Dalam Proses',
												perjalanan: Array.isArray(rec.perjalanan) ? rec.perjalanan : []
											});
										} else {
											// Elemen telah direkam
											const rec = el;
											const paketNama = this._getPaketNama(rec.paket || '');
											out.push({
												nomorDO: rec.nomorDO || (rec.id || ''),
												nim: rec.nim || rec.namaN || '',
												nama: rec.nama || rec.namaPenerima || '',
												paketKode: rec.paket || '',
												paketNama: paketNama || rec.namaPaket || rec.paket || '',
												ekspedisi: rec.ekspedisi || '',
												tanggalKirim: rec.tanggalKirim || rec.tanggal || '',
												total: rec.total || rec.totalPembayaran || 0,
												status: rec.status || 'Dalam Proses',
												perjalanan: Array.isArray(rec.perjalanan) ? rec.perjalanan : []
											});
										}
								}
								});
								return out;
							}

							// Jika data adalah objek yang dikunci oleh DO
							if (typeof data === 'object') {
								Object.keys(data).forEach(k => {
									const rec = data[k];
									if (rec && typeof rec === 'object') {
										const paketNama = this._getPaketNama(rec.paket || '');
										out.push({
											nomorDO: rec.nomorDO || k,
											nim: rec.nim || rec.namaN || '',
											nama: rec.nama || rec.namaPenerima || '',
											paketKode: rec.paket || '',
											paketNama: paketNama || rec.namaPaket || rec.paket || '',
											ekspedisi: rec.ekspedisi || '',
											tanggalKirim: rec.tanggalKirim || rec.tanggal || '',
											total: rec.total || rec.totalPembayaran || 0,
											status: rec.status || 'Dalam Proses',
											perjalanan: Array.isArray(rec.perjalanan) ? rec.perjalanan : []
										});
								}
								});
							}
							return out;
						};

						// Jika paket kosong, build derived dari stok
						if ((!Array.isArray(this.paketList) || this.paketList.length === 0) && typeof ApiService !== 'undefined') {
							ApiService.getStok().then(stok => {
								this.derivedPaketFromItems = (stok || []).map(it => ({
									kode: it.kode || ('PKT-' + Math.random().toString(36).slice(2,7)),
									nama: it.judul || it.nama || ('Paket ' + (it.kode || '')),
									isi: [ it.judul || '' ],
									harga: it.harga || 0
								}));
								this.$nextTick(() => {});
							});
						}

						// Masukkan tracking ke orders agar reaktif (normalize berbagai shape)
						if (this.dummyTrackingData) {
							this.orders = normalizeTracking(this.dummyTrackingData);
						}
					}).catch(err => {
						console.warn('Gagal mengambil data dari API Service', err);
					});
				}

				// Global handler: Tombol Esc untuk mereset input pencarian
				this._escHandler = (e) => {
					if (e.key === 'Escape' || e.key === 'Esc') {
						this.clearSearch();
					}
				};
				window.addEventListener('keydown', this._escHandler);
			},

			unmounted() {
				try {
					window.removeEventListener('keydown', this._escHandler);
				} catch (e) {
					// Ignore
				}
			}
		};
	});
});