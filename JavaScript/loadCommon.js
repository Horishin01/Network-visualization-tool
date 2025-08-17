// ‹¤’Ê•”•i‚Ì“Ç‚Ýž‚Ýˆ—
function loadHTML(id, file) {
    fetch(file)
        .then(response => {
            if (!response.ok) {
                throw new Error(`${file} ‚Ì“Ç‚Ýž‚Ý‚ÉŽ¸”s‚µ‚Ü‚µ‚½`);
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
