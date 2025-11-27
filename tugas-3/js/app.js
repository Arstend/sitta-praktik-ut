const { createApp, ref } = Vue;

const app = createApp({
	setup() {
		const tab = ref('dashboard');

		const state = ref({
			stok: [],
			tracking: [],
			paket: [],
			pengirimanList: []
		});

		function handleNewDO(newOrder) {
			// Handle / tangani logika pesanan baru di sini
			console.log('New order received:', newOrder);
		}
		
		function changeTab(newTab) {
			tab.value = newTab;
		}

		return {
			tab,
			state,
			handleNewDO,
			changeTab
		};
	}
});

// Daftarkan komponen
app.component('dashboard', Dashboard);
app.component('ba-stock-table', Stok);
app.component('do-tracking', Tracking);

// Helper global: Format angka ke Rupiah tersedia untuk semua komponen melalui this.$formatRupiah
function formatRupiah(value) {
	const n = Number(value) || 0;
	return n.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
}

// Lampirkan ke globalProperties agar komponen dapat memanggil this.$formatRupiah(...)
app.config.globalProperties.$formatRupiah = formatRupiah;

app.mount('#app');