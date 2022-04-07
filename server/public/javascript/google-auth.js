// Declare globals to hide eslint no-undef error:
/* global gapi */

// Initialise the Google authentication API, since the signin button is on a different page.
function onOpenIdLoad() {
    gapi.load('auth2', function() {
        gapi.auth2.init();
    });
}