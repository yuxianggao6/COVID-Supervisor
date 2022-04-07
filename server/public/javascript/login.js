// Declare globals to hide eslint no-undef error:
/* global Vue */
/* global gapi */

var vm = new Vue({
    el: '#app',
    data: {
        venue_owner: false, // Is the user registering as a venue owner?
        user: { // Registration details about the user.
            givenName: "",
            familyName: "",
            email: "",
            phone: "",
            password: ""
        },
        venue: {    // Details about the venue being created, if the user is registering as a venue owner.
            name: "",
            streetNo: "",
            streetName: "",
            city: "",
            postcode: ""
        },
        page: "",   // The current page to display.
        open_id: false, // Is the user logging in with OpenID?
        admin_code: "", // The admin code, if the user is registering as an admin (emailed to new admin).
        health_official: false, // Is the user registering as a health official/admin?
        reset_email: "",    // The email address to send the forgot password code to.
        reset_code_sent: false, // Has a password reset code been sent?
        reset_code_verified: false, // Has the password reset code been verified?
        reset_code: "", // The password reset code.
        new_password: ""    // The user's new password, after following the password reset instructions.
    }
});

// Return the user back to the login page.
function back() {
    var auth2 = gapi.auth2.getAuthInstance();
    auth2.signOut().then(function () {
        window.location.href = "#";
    });
}

// Send the details entered by the user, to create their account.
function register() {
    // Append the venue details if the user is registering as a venue owner:
    if (vm.venue_owner) {
        vm.user.venue = vm.venue;
    }

    // Append the admin code (as emailed) if the user is registering as a health official:
    if (vm.health_official) {
        vm.user.adminCode = vm.admin_code;
    }

    var xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            // Notify the user that their account was created successfully, and redirect them to the login page, to log in:
            alert("Account created successfully. You will be redirected to the login page.");
            window.location.href = '/login.html';
        }
    };

    xhttp.open("POST", "/register", true);
    xhttp.setRequestHeader('Content-type', 'application/json');
    xhttp.send(JSON.stringify(vm.user));

    return false;
}

// Function the ensure the registration password and confirm password match.
function validateRegisterPassword() {
    var password = document.getElementById("register-password");
    var confirmPassword = document.getElementById("register-password-confirm");

    if (String(password.value) != String(confirmPassword.value)) {
        confirmPassword.setCustomValidity("Passwords must match.");
    } else {
        confirmPassword.setCustomValidity("");
    }
}

// Send the user's login details to the server, to log them in.
function validateLogin() {
    // Obtain details from the login form:
    let user = {
        email: document.getElementById('email').value,
        password: document.getElementById('password').value,
        remember: document.getElementById('remember').checked
    };

    var xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = function() {
        if (this.readyState == 4) {
            // Notify the user if their login was unsuccessful. Otherwise log them in.
            if (this.status == 200) {
                let userData = JSON.parse(this.responseText);
                document.cookie = "userType=" + userData.account_type + ";path=/";
                window.location.href = "/";
            } else if (this.status == 400) {
                alert("Incorrect login details. Please check that your email and password are correct.");
            }
        }
    };

    xhttp.open("POST", "/login", true);
    xhttp.setRequestHeader('Content-type', 'application/json');
    xhttp.send(JSON.stringify(user));

    return false;
}

// Called when a user successfully signs in with their Google account.
function onSignIn(googleUser) {
    var profile = googleUser.getBasicProfile();

    // Get the user's details from their Google profile:
    vm.user.givenName = profile.getGivenName();
    vm.user.familyName = profile.getFamilyName();
    vm.user.email = profile.getEmail();
    vm.open_id = true;

    var id_token = googleUser.getAuthResponse().id_token;
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            let userData = JSON.parse(this.responseText);
            document.cookie = "userType=" + userData.account_type + ";path=/";
            window.location.href = "/";
        } else if (this.readyState == 4 && this.status == 400) {
            // The user has not registered an account, so direct them to the registration page:
            window.location.href = "#register";
        }
    };
    xhr.open('POST', '/login', true);
    xhr.setRequestHeader('Content-type', 'application/json');
    xhr.send(JSON.stringify({token: id_token}));
}

// Function that is called when the page is changed.
function pageChanged() {
    // Get the name of the page from the url hash:
    vm.page = location.hash.slice(1);
    let queryIndex = vm.page.indexOf('?', 0);
    if (queryIndex != -1) {
        vm.page = vm.page.slice(0, queryIndex);
    }

    // If the register page is active, check the url query parameters:
    if (vm.page == 'register') {
        let queryIndex = window.location.href.indexOf('?');
        if (queryIndex != -1) {
            let query = window.location.href.slice(queryIndex);
            let params = new URLSearchParams(query);
            if (params.has('code')) {
                vm.admin_code = params.get('code');
            }
            if (params.has('email')) {
                vm.user.email = params.get('email');
            }
            vm.health_official = true;
        }
    }
}

// Call the initial page change:
window.onhashchange = pageChanged;
pageChanged();

// Requests a password reset for the email address that has been entered.
function sendPasswordResetCode() {
    var xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            vm.reset_code_sent = true;
        } else if (this.readyState == 4) {
            // No account exists with the supplied email address:
            alert("Failed to send password reset email. Make sure you enter a valid email address.");
        }
    };

    xhttp.open("POST", "/password-reset", true);
    xhttp.setRequestHeader('Content-type', 'application/json');
    xhttp.send(JSON.stringify({ email: vm.reset_email }));

    return false;
}

// Verify the reset password code entered by the user.
function verifyPasswordResetCode() {
    var xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            vm.reset_code_verified = true;
        } else if (this.readyState == 4) {
            // The supplied code does not match the code for the user's email address:
            alert("Failed to reset your password. Make sure the code you entered is correct.");
        }
    };

    xhttp.open("POST", "/password-reset-verify", true);
    xhttp.setRequestHeader('Content-type', 'application/json');
    xhttp.send(JSON.stringify({ email: vm.reset_email, code: vm.reset_code }));

    return false;
}

// Function to ensure the new password supplied by the user matches the confirm password field.
function validateResetPassword() {
    var password = document.getElementById("reset-password");
    var confirmPassword = document.getElementById("reset-password-confirm");

    if (String(password.value) != String(confirmPassword.value)) {
        confirmPassword.setCustomValidity("Passwords must match.");
    } else {
        confirmPassword.setCustomValidity("");
    }
}

// Sends the user's updated password to the server, updating their account details.
function resetPassword() {
    var xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            alert("Your password has been updated successfully.");
            vm.page = "";
        }
    };

    xhttp.open("POST", "/password-reset-apply", true);
    xhttp.setRequestHeader('Content-type', 'application/json');
    xhttp.send(JSON.stringify({ email: vm.reset_email, code: vm.reset_code, password: vm.new_password }));

    return false;
}