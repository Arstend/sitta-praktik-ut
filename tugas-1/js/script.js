// Sembunyikan feedback pada input
function hideErrMsg(classid){
	// Hapus pesan pada feedback
	$('#'+classid+'-msg').html('');
	// Hapus class is-invalid pada input
	$('#'+classid).removeClass('is-invalid');
}

// Menampilkan feedback pada input
function showErrMsg(classid, msg = null){
	// Jika msg tersedia
	if(msg){
		// Maka tampilkan pesan pada feedback
		$('#'+classid+'-msg').html('<b>'+msg+'</b>');
	}
	// Tambahkan class is-invalid pada input
	$('#'+classid).addClass('is-invalid');
}