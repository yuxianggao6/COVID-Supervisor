// Declare globals to hide eslint no-undef error:
/* global QRCode */

// Generate the check-in page for a venue:
var xhttp = new XMLHttpRequest();

xhttp.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
        let data = JSON.parse(this.responseText);

        // Set the url displayed using the QR code:
        var qr = new QRCode(document.getElementById('qr'), window.location.hostname + "/#/check-in?code=" + data.code);

        // Correctly position the QR code:
        document.getElementById('qr').getElementsByTagName('img')[0].classList.add("centred");
        document.getElementById('qr').getElementsByTagName('img')[0].classList.add("full-width");

        // Display additional venue information on the page:
        document.getElementById('code').innerText = data.code;
        document.getElementById('venue-name').innerText = data.name;
        document.getElementById('venue-address').innerText = data.address;
    }
};

xhttp.open("GET", "/manager/check-in-printable", true);
xhttp.send();