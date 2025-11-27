// API Service: simple client-side service that loads dataBahanAjar.json via axios
// Provides methods to retrieve specific lists
const ApiService = (function () {
	// Cache loaded data to avoid repeated network calls
	let _cache = null;

	function loadData() {
		if (_cache) return Promise.resolve(_cache);

		// Ambil file data dummy
		return axios.get('data/dataBahanAjar.json')
			.then(resp => {
				_cache = resp.data || {};
				return _cache;
			})
			.catch(err => {
				// Menampilkan error
				console.error('API Service: gagal memuat file dataBahanAjar.json', err);
				Swal.fire({
					icon: 'error',
					title: 'Oops...',
					text: 'Terjadi kesalahan pada API service.',
					footer: err
				});

				// Return empty default shape to avoid runtime errors in callers
				_cache = {
					upbjjList: [],
					kategoriList: [],
					pengirimanList: [],
					paket: [],
					stok: [],
					tracking: []
				};
				return _cache;
			});
	}

	return {
		getData: function () {
			return loadData();
		},
		getUpbjjList: function () {
			return loadData().then(d => d.upbjjList || []);
		},
		getKategoriList: function () {
			return loadData().then(d => d.kategoriList || []);
		},
		getPengirimanList: function () {
			return loadData().then(d => d.pengirimanList || []);
		},
		getPaket: function () {
			return loadData().then(d => d.paket || []);
		},
		getStok: function () {
			return loadData().then(d => d.stok || []);
		},
		getTracking: function () {
			return loadData().then(d => d.tracking || []);
		},

		// Hapus cache untuk lingkungan development / testing
		_clearCache: function () { _cache = null; }
	};
})();

// Expose globally for components to use
window.ApiService = ApiService;
