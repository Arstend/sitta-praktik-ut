const Dashboard = Vue.defineAsyncComponent(() => {
	// Muat file templates/dashboard.html
	return fetch('templates/dashboard.html').then(response => response.text()).then(template => {
		return {
			template: template,
			// Tambahkan data untuk menyimpan stok
			data() {
				return {
					stok: []
				};
			},
			computed: {
				// Ucapan berdasarkan waktu hari ini
				greeting() {
					const hour = new Date().getHours();
					if (hour >= 5 && hour < 12) {
						return 'pagi';
					} else if (hour >= 12 && hour < 18) {
						return 'siang';
					} else {
						return 'malam';
					}
				},

				// Tanggal hari ini
				todayDate() {
					const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
					const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
					const now = new Date();
					return `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
				},

				// Total stok semua bahan ajar (jumlah qty)
				totalStok() {
					return this.stok.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
				},

				// Jumlah item yang stoknya menipis atau kosong (qty < safety atau qty === 0)
				lowStockCount() {
					return this.stok.filter(item => {
						const qty = Number(item.qty) || 0;
						const safety = Number(item.safety) || 0;
						return qty === 0 || qty < safety;
					}).length;
				}
			},

			// Ambil data stok saat component dimount
			mounted() {
				if (typeof ApiService === 'undefined') {
					console.error('Terjadi kesalahan pada API service.');
					Swal.fire({
						icon: 'error',
						title: 'Oops...',
						text: 'Terjadi kesalahan pada API service.'
					});
				} else {
					ApiService.getStok().then(stok => {
						this.stok = stok || [];
					}).catch(err => {
						console.warn('Gagal mengambil stok:', err);
					});
				}
			}
		};
	});
});