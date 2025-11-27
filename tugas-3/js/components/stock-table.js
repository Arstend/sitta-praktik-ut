const Stok = Vue.defineAsyncComponent(() => {
	// Muat template HTML dari templates/stock-table.html
	return fetch('templates/stock-table.html').then(response => response.text()).then(template => {
		return {
			template: template,
			data() {
				return {
					items: [],

					// Untuk dropdown filter
					filter: '',

					// Untuk kategori dan upbjj akan diisi dari ApiService (dataBahanAjar.json)
					kategoriList: [],
					upbjjList: [],

					// Untuk form tambah / edit
					newItem: {
						kode: '',
						judul: '',
						kategori: '',
						upbjj: '',
						lokasiRak: '',
						harga: '',
						qty: 0,
						safety: 0,
						catatanHTML: ''
					},

					// Untuk form edit
					currentItem: {},
					originalKode: '',

					// Kontrol modal
					showAddModal: false,
					showEditModal: false,

					// Untuk popover
					_popovers: [],

					// Untuk filter / sort
					selectedUpbjj: '', // Filter UT-Daerah
					selectedKategori: '', // Filter Kategori (dependent)
					filterLowStock: false, // Checkbox untuk filter berdasarkan stok rendah / habis
					sortBy: '', // Radio untuk sort berdasarkan judul, qty, harga
				};
			},

			computed: {
				// Daftar item yang sudah difilter dan disortir
				filteredItems() {
					let filtered = this.items.filter(item => {
						// Filter pencarian teks (yang sudah ada)
						const matchesSearch = !this.filter || item.judul.toLowerCase().includes(this.filter.toLowerCase()) || item.kode.toLowerCase().includes(this.filter.toLowerCase());
						// Filter UT-Daerah
						const matchesUpbjj = !this.selectedUpbjj || item.upbjj === this.selectedUpbjj;
						// Filter Kategori (hanya jika selectedUpbjj ada)
						const matchesKategori = !this.selectedKategori || item.kategori === this.selectedKategori;
						// Filter stok rendah / habis
						const matchesLowStock = !this.filterLowStock || item.qty < item.safety || item.qty === 0;
						return matchesSearch && matchesUpbjj && matchesKategori && matchesLowStock;
					});

					// Sort berdasarkan pilihan
					if (this.sortBy) {
						filtered.sort((a, b) => {
							if (this.sortBy === 'judul') {
								return a.judul.localeCompare(b.judul);
							} else if (this.sortBy === 'qty') {
								return a.qty - b.qty;
							} else if (this.sortBy === 'harga') {
								return a.harga - b.harga;
							}
							return 0;
						});
					}
					return filtered;
				}
			},

			methods: {
				// Method reset filter / sort
				resetFilters() {
					this.selectedUpbjj = '';
					this.selectedKategori = '';
					this.filterLowStock = false;
					this.sortBy = '';
					this.filter = ''; // Reset pencarian teks
				},

				// Format angka dengan pemisah ribuan (ID locale) agar mudah dibaca
				formatNumber(value) {
					const n = Number(value);
					if (Number.isNaN(n)) return '';
					return n.toLocaleString('id-ID');
				},

				// Status dalam bentuk badge HTML
				statusBadge(item) {
					if (!item) return '<span class="badge bg-secondary"><i class="fas fa-question-circle"></i> N/A</span>';
					if (item.qty === 0) return '<span class="badge bg-danger"><i class="fas fa-exclamation-circle"></i> Kosong</span>';
					if (item.qty < item.safety) return '<span class="badge bg-warning"><i class="fas fa-exclamation-triangle"></i> Menipis</span>';
					return '<span class="badge bg-success"><i class="fas fa-check-circle"></i> Aman</span>';
				},

				// Ubah qty atau safety pada form newItem atau currentItem
				changeQty(obj, field, delta) {
					if (!obj[field]) obj[field] = 0;
					obj[field] = Math.max(0, obj[field] + delta);
				},

				// Inisialisasi popover catatanHTML
				initPopovers() {
					try {
						// Hapus popover lama
						if (Array.isArray(this._popovers)) {
							this._popovers.forEach(p => {
								try { p.dispose(); } catch (e) {}
							});
						}
						this._popovers = [];

						// Inisiasi popover baru
						const els = Array.from(document.querySelectorAll('[data-bs-toggle="popover"]'));

						// Loop dan inisiasi masing-masing
						els.forEach(el => {
							const p = new bootstrap.Popover(el, {
								html: true,
								content: el.getAttribute('data-bs-content') || '',
								title: el.getAttribute('data-bs-title') || '',
								placement: el.getAttribute('data-bs-placement') || 'right',
								trigger: el.getAttribute('data-bs-trigger') || 'focus'
							});

							// Simpan referensi untuk nanti pembersihan
							this._popovers.push(p);
						});
					} catch (err) {
						console.warn('Popover init error: ', err);
					}
				},

				// Validasi form add / edit
				validateForm(item, formType) {
					let isValid = true;
					const prefix = formType === 'add' ? '-add' : '-edit';
					const fields = ['kode', 'judul', 'kategori', 'upbjj', 'lokasiRak', 'harga'];
					fields.forEach(field => {
						const feedback = document.getElementById(`${field}${prefix}-msg`);
						const input = document.getElementById(`${field}${prefix}`);
						const value = item[field];
						// Reset class dan pesan sebelumnya
						if (input) input.classList.remove('is-invalid');
						if (feedback) feedback.textContent = '';
						// Validasi umum : tidak kosong
						if (!value || value === '') {
							isValid = false;
							if (input) input.classList.add('is-invalid');
							if (feedback) feedback.textContent = `${field.charAt(0).toUpperCase() + field.slice(1)} harus diisi`;
						} else {
							// Validasi spesifik untuk kategori dan upbjj
							if (field === 'kategori' && !this.kategoriList.includes(value)) {
								isValid = false;
								if (input) input.classList.add('is-invalid');
								if (feedback) feedback.textContent = 'Kategori tidak valid (harus dari daftar kategori)';
							}
							if (field === 'upbjj' && !this.upbjjList.includes(value)) {
								isValid = false;
								if (input) input.classList.add('is-invalid');
								if (feedback) feedback.textContent = 'UPBJJ tidak valid (harus dari daftar UPBJJ)';
							}
							// Validasi harga
							if (field === 'harga' && (isNaN(value) || parseFloat(value) <= 0)) {
								isValid = false;
								if (input) input.classList.add('is-invalid');
								if (feedback) feedback.textContent = 'Harga harus berupa angka positif';
							}
						}
					});

					return isValid;
				},

				// Reset feedback dan is-invalid
				resetValidation(formType) {
					const prefix = formType === 'add' ? '-add' : '-edit';
					const fields = ['kode', 'judul', 'kategori', 'upbjj', 'lokasiRak', 'harga'];
					fields.forEach(field => {
						const input = document.getElementById(`${field}${prefix}`);
						const feedback = document.getElementById(`${field}${prefix}-msg`);
						if (input) input.classList.remove('is-invalid');
						if (feedback) feedback.textContent = '';
					});
				},

				// Tambah item baru
				addItem() {
					if (!this.validateForm(this.newItem, 'add')) return;
					const exists = this.items.some(i => i.kode.toLowerCase() === this.newItem.kode.toLowerCase()); // Case-insensitive
					const kodeFeedback = document.getElementById('kode-add-msg');
					const kodeInput = document.getElementById('kode-add');
					if (exists) {
						if (kodeInput) kodeInput.classList.add('is-invalid');
						if (kodeFeedback) kodeFeedback.textContent = 'Kode sudah terdaftar, harap gunakan kode yang berbeda.';
						return;
					}
					this.items.push({ ...this.newItem });
					this.resetForm();
					this.resetValidation('add');
					this.showAddModal = false;
					this.$nextTick(() => this.initPopovers());
				},

				// Buka modal edit
				editItem(item) {
					this.currentItem = JSON.parse(JSON.stringify(item));
					this.originalKode = item.kode;
					this.resetValidation('edit');
					this.showEditModal = true;
				},

				// Update item
				updateItem() {
					if (!this.validateForm(this.currentItem, 'edit')) return;
					const kodeFeedback = document.getElementById('kode-edit-msg');
					const kodeInput = document.getElementById('kode-edit');
					if (this.currentItem.kode.toLowerCase() !== this.originalKode.toLowerCase()) {
						const exists = this.items.some(i => i.kode.toLowerCase() === this.currentItem.kode.toLowerCase()); // Case-insensitive
						if (exists) {
							if (kodeInput) kodeInput.classList.add('is-invalid');
							if (kodeFeedback) kodeFeedback.textContent = 'Kode sudah terdaftar, harap gunakan kode yang berbeda.';
							return;
						}
					}
					const idx = this.items.findIndex(i => i.kode === this.originalKode);
					if (idx !== -1) this.items[idx] = { ...this.currentItem };
					this.resetValidation('edit');
					this.showEditModal = false;
					this.$nextTick(() => this.initPopovers());
				},

				// Hapus item
				deleteItem(item) {
					/* if (confirm(`Yakin ingin menghapus bahan ajar dengan kode ${item.kode}?`)) {
						this.items = this.items.filter(i => i !== item);
						this.$nextTick(() => this.initPopovers());
					} */
					Swal.fire({
						title: 'Are you sure?',
						text: `Yakin ingin menghapus bahan ajar dengan kode ${item.kode}? Tindakan ini tidak dapat dibatalkan.`,
						icon: 'warning',
						showCancelButton: true,
						confirmButtonColor: '#3085d6',
						cancelButtonColor: '#d33',
						confirmButtonText: 'Ya, hapus saja!',
						cancelButtonText: 'Batal'
					}).then((result) => {
						if (result.isConfirmed) {
							this.items = this.items.filter(i => i !== item);
							this.$nextTick(() => this.initPopovers());
						}
					});
				},

				// Reset form addItem
				resetForm() {
					this.newItem = {
						kode: '',
						judul: '',
						kategori: '',
						upbjj: '',
						lokasiRak: '',
						harga: '',
						qty: 0,
						safety: 0,
						catatanHTML: ''
					};
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
				}
			},

			// Pantau perubahan showAddModal dan showEditModal untuk mengelola class body
			watch: {
				// Modal tambah
				showAddModal() {
					this.toggleBodyClass();
					// Lakukan inisiasi ulang popovers jika modal muncul / tertutup
					this.$nextTick(this.initPopovers);
				},

				// Modal edit
				showEditModal() {
					this.toggleBodyClass();
					// Lakukan inisiasi ulang popovers jika modal muncul / tertutup
					this.$nextTick(this.initPopovers);
				}
			},

			mounted() {
				// Ambil data dari ApiService menggunakan axios
				if (typeof ApiService === 'undefined') {
					console.error('Terjadi kesalahan pada API service.');
					Swal.fire({
						icon: 'error',
						title: 'Oops...',
						text: 'Terjadi kesalahan pada API service.'
					});
				} else {
					Promise.all([
						ApiService.getStok(),
						ApiService.getKategoriList(),
						ApiService.getUpbjjList()
					]).then(([stok, kategori, upbjj]) => {
						this.items = stok || [];
						this.kategoriList = kategori || [];
						this.upbjjList = upbjj || [];
						this.$nextTick(() => this.initPopovers());
					}).catch(err => {
						console.warn('Gagal mengambil data dari API Service:', err);
					});
				}
			},

			updated() {
				// Inisiasi ulang popover setiap ada update DOM (misalnya perubahan data)
				this.$nextTick(() => this.initPopovers());
			}
		};
	});
});