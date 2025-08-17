// ���ʕ��i�̓ǂݍ��ݏ���
function loadHTML(id, file) {
    fetch(file)
        .then(response => {
            if (!response.ok) {
                throw new Error(`${file} �̓ǂݍ��݂Ɏ��s���܂���`);
            }
            return response.text();
        })
        .then(data => {
            document.getElementById(id).innerHTML = data;
        })
        .catch(error => {
            console.error(error);
        });
}

document.addEventListener("DOMContentLoaded", function () {
    loadHTML("header-placeholder", "header.html");
    loadHTML("footer-placeholder", "footer.html");
});
