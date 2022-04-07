// Declare globals to hide eslint no-undef error:
/* global Vue */
/* global mapboxgl */
/* global gapi */

var vm = new Vue({
   el: '#app',
   data: {
        // User properties:
        page: 'dashboard',  // The active page
        user: { // Details about the logged-in user.
            accountType: ''
        },
        old_user: {},   // Previous user details (so the user can revert changes).

        cases: [],  // Information about current COVID-19 cases, to display on the dashboard.
        deaths: [], // Information about current COVID-19 deaths, to display on the dashboard.
        info: [ // Links to government COVID-19 resources, to display on the dashboard.
            {state: "ACT", url: "https://www.covid19.act.gov.au/"},
            {state: "NSW", url: "https://www.nsw.gov.au/covid-19"},
            {state: "NT", url: "https://coronavirus.nt.gov.au/"},
            {state: "QLD", url: "https://www.covid19.qld.gov.au/"},
            {state: "SA", url: "https://www.covid-19.sa.gov.au/"},
            {state: "TAS", url: "https://coronavirus.tas.gov.au/"},
            {state: "VIC", url: "https://www.dhhs.vic.gov.au/coronavirus"},
            {state: "WA", url: "https://www.wa.gov.au/government/covid-19-coronavirus"}
        ],
        hotspot_visit: -1,  // Has the user been to an active hotspot?
        settings: {},   // The user's preferences.
        old_settings: {},   // Previous user preferences, so the user can revert changes.

        code: '',   // The current check-in code.
        checkin_status: -1, // The progress/success of the user's check-in.
        checkin: {},    // Details about the check-in the user just completed.
        pending_checkin: {},    // Details about the check-in, for the user to confirm.

        checkins: [],   // The check-in history for the logged-in user.

        hotspot_venues: [], // Hotspot venues that are displayed on the hotspot map.
        hotspot_areas: [],  // Hotspot areas that are displayed on the hotspot map.

        // Venue manager properties:
        venue: {},  // Details about the venue owned by the current user.
        old_venue: {},  // Previous details about the venue owned by the current user, so the user can revert changes.

        // Health official properties:
        areas: false,   // Is the health official managing hotspot areas or venues?
        manage_hotspot_venues: [],  // The hotspot venues being managed by the health official.
        manage_hotspot_areas: [],   // The hotspot areas that are being managed by the health official.

        users: [],  // Users being managed by the health official.
        search_data_user: { // Search data for the user management page.
            term: "",
            by: ""
        },
        search_data_venue: {    // Search data for the venue management page.
            term: "",
            by: ""
        },
        search_data_hotspot: {  // Search data for the hotspot management page.
            term: "",
            by: ""
        },
        pg: 1,  // The page of users/venues/hotspots being viewed.
        input_page: 1,  // The page input by the user (pre-validation).
        page_size: 10,  // The number of results to display on the page at once.
        managing_user: false,   // Is the health official manging a user?
        viewing_checkins: false,    // Is the health official viewing a user's check-ins?
        checkin_history: [],    // The check-in history for the selected user.
        venues: [], // The venues being managed by the health official.
        managing_venue: false,  // Is the health official managing a venue's details.
        viewing_owner: false,   // Is the health official viewing the owner of the selected venue?
        owner: {},  // The owner of the selected venue.
        active_user: {},    // The user currently being managed by the health official.
        active_venue: {},   // The venue currently being managed by the health official.
        active_hotspot: {}, // The hotspot currently being managed by the health official.

        creating_hotspot_venue: false,  // Is the health official currently creating a new hotspot venue?
        updating_hotspot: false,    // Is the health official currently updating the timeframe for a hotspot?
        hotspot_venue_details: {    // Details about the hotspot venue being created.
            venue: "",
            start_date: "",
            start_time: "",
            end_date: "",
            end_time: ""
        },
        hotspot_area_details: { // Details about the hotspot area being created.
            state: "",
            city: "",
            start_date: "",
            start_time: "",
            end_date: "",
            end_time: ""
        },
        hotspot_update: {   // Details about the hotspot being updated.
            id: "",
            is_venue: false,
            start_date: "",
            start_time: "",
            end_date: "",
            end_time: ""
        },

        pending: [],    // Pending health official registrations.
        admin_email: "" // The email that new health official registration instructions will be sent to.
   },
   methods: {
        // Manage the given user.
        manage_user: function(i) {
            vm.managing_user = true;
            vm.active_user = JSON.parse(JSON.stringify(vm.users[i]));
        },
        // View the check-in history for the given user.
        view_checkin_history: function(i) {
            var xhttp = new XMLHttpRequest();

            xhttp.onreadystatechange = function() {
                if (this.readyState == 4 && this.status == 200) {
                    vm.checkin_history = JSON.parse(this.responseText);
                    vm.viewing_checkins = true;
                    for (let hotspot of vm.checkin_history) {
                        hotspot.date = hotspot.date.slice(0, 10);
                    }
                }
            };

            xhttp.open("GET", `/admin/user-check-in-history?id=${encodeURIComponent(i)}`, true);
            xhttp.send();
        },
        // Manage the given venue.
        manage_venue: function(i) {
            vm.active_venue = JSON.parse(JSON.stringify(vm.venues[i]));
            vm.managing_venue = true;
        },
        // View the check-in history for the given venue.
        view_venue_checkin_history: function(i) {
            var xhttp = new XMLHttpRequest();

            xhttp.onreadystatechange = function() {
                if (this.readyState == 4 && this.status == 200) {
                    vm.checkin_history = JSON.parse(this.responseText);
                    vm.viewing_checkins = true;
                    for (let hotspot of vm.checkin_history) {
                        hotspot.date = hotspot.date.slice(0, 10);
                    }
                }
            };

            xhttp.open("GET", `/admin/venue-check-in-history?id=${encodeURIComponent(i)}`, true);
            xhttp.send();
        },
        // View details about the owner for the given venue.
        view_owner: function(i) {
            var xhttp = new XMLHttpRequest();

            xhttp.onreadystatechange = function() {
                if (this.readyState == 4 && this.status == 200) {
                    vm.owner = JSON.parse(this.responseText);
                    vm.viewing_owner = true;
                }
            };

            xhttp.open("GET", `/admin/venue-owner?id=${encodeURIComponent(i)}`, true);
            xhttp.send();
        },
        // Revoke a pending health official registration.
        cancelPendingRegistration: function(email) {
            var xhttp = new XMLHttpRequest();

            xhttp.onreadystatechange = function() {
                if (this.readyState == 4 && this.status == 200) {
                    vm.pending = JSON.parse(this.responseText);
                }
            };

            xhttp.open("POST", "/admin/cancel-pending", true);
            xhttp.setRequestHeader('Content-type', 'application/json');
            xhttp.send(JSON.stringify({email: email}));
        },
        // Delete an existing hotspot area declaration.
        removeHotspotArea: function(id) {
            var xhttp = new XMLHttpRequest();

            xhttp.onreadystatechange = function() {
                if (this.readyState == 4 && this.status == 200) {
                    vm.manage_hotspot_areas = JSON.parse(this.responseText);
                    for (let hotspot of vm.manage_hotspot_areas) {
                        hotspot.start_date = hotspot.start_date.slice(0, 10);
                        hotspot.end_date = hotspot.end_date.slice(0, 10);
                    }
                }
            };

            xhttp.open("POST", "/admin/remove-hotspot-area", true);
            xhttp.setRequestHeader('Content-type', 'application/json');
            xhttp.send(JSON.stringify({id: id}));
        },
        // Delete an existing hotspot venue declaration.
        removeHotspotVenue: function(id) {
            var xhttp = new XMLHttpRequest();

            xhttp.onreadystatechange = function() {
                if (this.readyState == 4 && this.status == 200) {
                    vm.manage_hotspot_venues = JSON.parse(this.responseText);
                    for (let hotspot of vm.manage_hotspot_venues) {
                        hotspot.start_date = hotspot.start_date.slice(0, 10);
                        hotspot.end_date = hotspot.end_date.slice(0, 10);
                    }
                }
            };

            xhttp.open("POST", "/admin/remove-hotspot-venue", true);
            xhttp.setRequestHeader('Content-type', 'application/json');
            xhttp.send(JSON.stringify({id: id}));
        },
        // Display the window to create a new hotspot venue declaration.
        create_hotspot_venue: function(id) {
            vm.creating_hotspot_venue = true;
            vm.hotspot_venue_details.venue = id;
        },
        // Display the window to edit the timeframe of an existing hotspot declaration.
        update_hotspot: function(hotspot, isVenue) {
            vm.hotspot_update.id = hotspot.hotspot_id;
            vm.hotspot_update.is_venue = isVenue;
            vm.hotspot_update.start_date = hotspot.start_date;
            vm.hotspot_update.start_time = hotspot.start_time;
            vm.hotspot_update.end_date = hotspot.end_date;
            vm.hotspot_update.end_time = hotspot.end_time;
            vm.active_hotspot = hotspot;
            vm.updating_hotspot = true;
        }
   },
   computed: {
        // Called when the venue check-in history page is loaded.
        getVenueCheckInHistory: function() {
            if (this.page == 'venue-check-in-history') {
                var xhttp = new XMLHttpRequest();

                xhttp.onreadystatechange = function() {
                    if (this.readyState == 4 && this.status == 200) {
                        // Display the check-ins for the active venue:
                        vm.checkins = JSON.parse(this.responseText);
                        for (let c of vm.checkins) {
                            c.date = c.date.slice(0, 10);
                            c.address = `${c.street_number} ${c.street_name}, ${c.city} ${c.postcode} ${c.state}`;
                        }
                    }
                };

                xhttp.open("GET", "/manager/check-in-history", true);
                xhttp.send();
                return true;
            } else {
                return false;
            }
        },
        // Called when the check-in history page is loaded.
        getCheckInHistory: function() {
            if (this.page == 'check-in-history') {
                updateCheckInMap();
                return true;
            } else {
                return false;
            }
        },
        // Called when the current hotspots page is loaded.
        getHotspots: function() {
            if (this.page == 'hotspots') {
                updateHotspotMap();
                return true;
            } else {
                return false;
            }
        },
        // Ensures negative pages cannot be viewed, when managing users or venues.
        viewPage: function() {
            return Math.max(1, parseInt(this.pg));
        },
        // Called when the check-in page is loaded.
        getCheckIn: function() {
            if (this.page == 'check-in') {
                // Check the query parameters in the url. This is required for the QR code check-in to work:
                let queryIndex = window.location.href.indexOf('?');
                if (queryIndex != -1) {
                    let query = window.location.href.slice(queryIndex);
                    let params = new URLSearchParams(query);
                    if (params.has('code')) {
                        // Check the user into the venue represented by the QR code scanned:
                        this.code = params.get('code');
                        checkIn();
                    }
                }
                return true;
            } else {
                return false;
            }
        },
        // Called when the health official registration page is loaded.
        getHealthOfficialRegistration: function() {
            if (this.page == 'register-health-official') {
                var xhttp = new XMLHttpRequest();

                xhttp.onreadystatechange = function() {
                    if (this.readyState == 4 && this.status == 200) {
                        // Load the pending health official registrations:
                        vm.pending = JSON.parse(this.responseText);
                    }
                };

                xhttp.open("GET", "/admin/pending-health-officials", true);
                xhttp.send();
                return true;
            } else {
                return false;
            }
        },
        // Called when the venue details page is loaded.
        getVenueDetails: function() {
            if (this.page == 'venue-details') {
                var xhttp = new XMLHttpRequest();

                xhttp.onreadystatechange = function() {
                    if (this.readyState == 4 && this.status == 200) {
                        // Display the venue's details:
                        vm.venue = JSON.parse(this.responseText);
                    }
                };

                xhttp.open("GET", "/manager/details", true);
                xhttp.send();
                return true;
            } else {
                return false;
            }
        },
        // Called when the hotspot management page is loaded.
        getHotspotManagement: function() {
            if (this.page == 'manage-hotspots') {
                var xhttp = new XMLHttpRequest();

                xhttp.onreadystatechange = function() {
                    if (this.readyState == 4 && this.status == 200) {
                        // Display all hotspots (ensuring dates are displayed correctly):
                        let hotspots = JSON.parse(this.responseText);
                        vm.manage_hotspot_venues = hotspots.venues;
                        vm.manage_hotspot_areas = hotspots.areas;
                        for (let hotspot of vm.manage_hotspot_venues) {
                            hotspot.start_date = hotspot.start_date.slice(0, 10);
                            hotspot.end_date = hotspot.end_date.slice(0, 10);
                        }
                        for (let hotspot of vm.manage_hotspot_areas) {
                            hotspot.start_date = hotspot.start_date.slice(0, 10);
                            hotspot.end_date = hotspot.end_date.slice(0, 10);
                        }
                    }
                };

                xhttp.open("GET", "/admin/hotspots", true);
                xhttp.send();
                return true;
            } else {
                return false;
            }
        }
    }
});

// Setup the hotspot and check-in history maps:
mapboxgl.accessToken = 'pk.eyJ1Ijoid2RjLXByb2plY3QiLCJhIjoiY2tvYzlsNW54MHNqZTMwb3k1ZjJlM3d2YyJ9.uD5DPRQ6JiUzECtpkOw8LA';
var map = new mapboxgl.Map({    // Setup hotspot map
    container: 'hotspot-map',
    style: 'mapbox://styles/mapbox/streets-v11',
    center: [138.602668, -34.920741],
    zoom: 9
});
var checkinMap = new mapboxgl.Map({ // Setup check-in history map
    container: 'check-in-map',
    style: 'mapbox://styles/mapbox/streets-v11',
    center: [138.602668, -34.920741],
    zoom: 9
});

// Store the markers and layers of each map, so these can be cleared before updating the maps:
var hotspot_map_markers = [];
var hotspot_map_layer_ids = [];
var hotspot_map_layer_sources = [];
var check_in_map_markers = [];

// Updates the markers shown on the check-in history map.
function updateCheckInMap() {
    var xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            vm.checkins = JSON.parse(this.responseText);

            // Remove all existing markers from the map:
            for (let existingMarker of check_in_map_markers) {
                existingMarker.remove();
            }
            check_in_map_markers = [];

            // Add all check-ins to the table and map:
            for (let checkin of vm.checkins) {
                checkin.date = checkin.date.slice(0, 10);
                checkin.address = `${checkin.street_number} ${checkin.street_name}, ${checkin.city} ${checkin.postcode} ${checkin.state}`;
                if (!isNaN(checkin.longitude) && !isNaN(checkin.latitude) && Math.abs(checkin.longitude) <= 180 && Math.abs(checkin.latitude) <= 90) {
                    let marker = new mapboxgl.Marker()
                    .setLngLat([checkin.longitude, checkin.latitude])
                    .addTo(checkinMap);
                    check_in_map_markers.push(marker);
                }
            }

            // Resize the check-in history map, so it correctly fills the available space:
            checkinMap.resize();
        }
    };

    xhttp.open("GET", "/user/check-in-history", true);
    xhttp.send();
}

// Update the hotspot markers and areas displayed on the hotspot map.
function updateHotspotMap() {
    var xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            let hotspots = JSON.parse(this.responseText);
            vm.hotspot_venues = hotspots.venues;
            vm.hotspot_areas = hotspots.areas;

            // Ensure all dates are correctly formatted:
            for (let hotspot of vm.hotspot_venues) {
                hotspot.start = new Date(hotspot.start).toLocaleString();
                hotspot.end = new Date(hotspot.end).toLocaleString();
            }
            for (let hotspot of vm.hotspot_areas) {
                hotspot.start_time = new Date(hotspot.start_time).toLocaleString();
                hotspot.end_time = new Date(hotspot.end_time).toLocaleString();
            }

            // Remove all existing markers:
            for (let existingMarker of hotspot_map_markers) {
                existingMarker.remove();
            }
            hotspot_map_markers = [];

            // Mark hotspot venues:
            for (let venue of vm.hotspot_venues) {
                if (!isNaN(venue.longitude) && !isNaN(venue.latitude) && Math.abs(venue.longitude) <= 180 && Math.abs(venue.latitude) <= 90) {
                    let marker = new mapboxgl.Marker({color: '#FF0000'})
                    .setLngLat([venue.longitude, venue.latitude])
                    .addTo(map);
                    hotspot_map_markers.push(marker);
                }
            }

            // Remove existing area layers:
            for (let existingLayerId of hotspot_map_layer_ids) {
                map.removeLayer(existingLayerId);
            }
            hotspot_map_layer_ids = [];
            for (let existingLayerSource of hotspot_map_layer_sources) {
                map.removeSource(existingLayerSource);
            }
            hotspot_map_layer_sources = [];

            // Mark hotspot areas:
            for (let area of vm.hotspot_areas) {
                let id = area.name;
                map.addSource(id, {
                    'type': 'geojson',
                    'data': {
                    'type': 'Feature',
                    'geometry': {
                        'type': 'Polygon',
                        'coordinates': JSON.parse(area.polygon)
                        }
                    }
                });
                hotspot_map_layer_sources.push(id);

                map.addLayer({
                    'id': id,
                    'type': 'fill',
                    'source': id,
                    'layout': {},
                    'paint': {
                        'fill-color': '#ff0000',
                        'fill-opacity': 0.5
                    }
                });
                hotspot_map_layer_ids.push(id);

                map.addLayer({
                    'id': id + ' outline',
                    'type': 'line',
                    'source': id,
                    'layout': {},
                    'paint': {
                        'line-color': '#000000',
                        'line-width': 3
                    }
                });
                hotspot_map_layer_ids.push(id + ' outline');
            }

            // Resize the map, so it correctly fills the available area:
            map.resize();
        }
    };

    xhttp.open("GET", "/user/hotspots", true);
    xhttp.send();
}

// Called when the page is changed, to update the page displayed, without sending any requests to the server.
function pageChanged() {
    // Get the page name from between the hash and query parameter index:
    vm.page = location.hash.slice(2);
    let queryIndex = vm.page.indexOf('?', 0);
    if (queryIndex != -1) {
        vm.page = vm.page.slice(0, queryIndex);
    }

    // Update the navigation menu display, to highlight the active page:
    let nav = document.getElementsByTagName('nav')[0];
    for (let page of nav.children[0].children) {
        if (window.location.href == page.children[0].href) {
            page.children[0].classList.add('current-page');
        } else {
            if (page.children[0].classList.contains('current-page')) {
                page.children[0].classList.remove('current-page');
            }
        }
    }
}

// Refresh the active page:
window.onhashchange = pageChanged;
pageChanged();

// Source to get data from in order to display details on the dashboard page:
var dataURL = "https://raw.githubusercontent.com/covid-19-au/covid-19-au.github.io/prod/src/data/state.json";
var states = ["NSW", "QLD", "VIC", "SA", "WA", "TAS", "ACT", "NT"];

// Retrieves the latest COVID-19 case and death numbers for Australian states:
function getCovidData() {
    var xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            let rawData = JSON.parse(this.responseText);
            let keys = Object.keys(rawData);
            let latest = rawData[keys[keys.length - 1]];
            let lastWeek = rawData[keys[keys.length - 8]];

            let caseData = [];
            for (let s of states) {
                caseData.push({state: s, active: latest[s][4], total: latest[s][0]});
            }

            let deathData = [];
            for (let s of states) {
                deathData.push({state: s, active: latest[s][1] - lastWeek[s][1], total: latest[s][1]});
            }

            vm.cases = caseData;
            vm.deaths = deathData;
        }
    };

    xhttp.open("GET", dataURL, true);

    xhttp.send();
}

getCovidData();

// Load user settings (stored in cookie, since a user may want different settings on their phone vs computer):
var settingsCookie = decodeURIComponent(document.cookie);
var cookieParts = settingsCookie.split(';');
var cookieKey = "settings=";

for (let part of cookieParts) {
    part = part.trim();
    if (part.indexOf(cookieKey) == 0) {
        vm.settings = JSON.parse(part.substring(cookieKey.length + 1, part.length - 1));
    }
}

// Create new settings object:
if (Object.keys(vm.settings).length == 0) {
    vm.settings = {
        dashCases: true,
        dashDeaths: true,
        dashInfo: true
    };
    let expiry = new Date() + new Date(10 * 365 * 24 * 60 * 60 * 1000);
    document.cookie = `settings="${JSON.stringify(vm.settings)}";path=/;expires=${expiry.toString()}`;
}
vm.old_settings = JSON.parse(JSON.stringify(vm.settings));

// Revert the user's preferences to their previous values.
function revertSettings() {
    vm.settings = JSON.parse(JSON.stringify(vm.old_settings));
}

// Update the user's preferences.
function applySettings() {
    let expiry = new Date() + new Date(10 * 365 * 24 * 60 * 60 * 1000);
    document.cookie = `settings="${JSON.stringify(vm.settings)}";path=/;expires=${expiry.toString()}`;
    vm.old_settings = JSON.parse(JSON.stringify(vm.settings));

    return false;
}

// Show the user details about the venue they are about to check-in to, so they can confirm the details.
function checkIn() {
    var xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = function() {
        if (this.readyState == 4) {
            if (this.status == 200) {
                vm.pending_checkin = JSON.parse(this.responseText);
                vm.checkin_status = 1;
            } else {
                vm.checkin_status = 0;
            }
        }
    };

    xhttp.open("POST", "/user/check-in", true);
    xhttp.setRequestHeader('Content-type', 'application/json');
    xhttp.send(JSON.stringify({code: vm.code}));

    return false;
}

// Confirm the check-in at the given venue.
function confirmCheckIn() {
    var xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = function() {
        if (this.readyState == 4) {
            if (this.status == 200) {
                let responseJSON = JSON.parse(this.responseText);

                // Display details about the user's successful check-in to them:
                vm.checkin = {
                    venue: responseJSON.venue,
                    time: new Date(responseJSON.time).toLocaleString(),
                    address: responseJSON.address
                };
                vm.checkin_status = 2;
            } else {
                // The check-in was unsuccessful:
                vm.checkin_status = 0;
            }
        }
    };

    xhttp.open("POST", "/user/confirm-check-in", true);
    xhttp.setRequestHeader('Content-type', 'application/json');
    xhttp.send(JSON.stringify({venue_id: vm.pending_checkin.id}));

    return false;
}

// Search for users, using the given search term.
function search() {
    vm.pg = 1;
    getUsers(vm.page_size, vm.viewPage);
    return false;
}

// Retrieves users from the database, based on the search term supplied.
function getUsers(size, page) {
    var xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            // Update the users being displayed:
            vm.users = JSON.parse(this.responseText);
        }
    };

    xhttp.open("GET", `/admin/users?search_by=${encodeURIComponent(vm.search_data_user.by)}&search_term=${encodeURIComponent(vm.search_data_user.term)}&num=${encodeURIComponent(size)}&page=${encodeURIComponent(page)}`, true);

    xhttp.send();
}

// Set the page of user results to display.
function setPage(delta) {
    vm.pg = Math.max(1, parseInt(vm.pg) + delta);
    getUsers(vm.page_size, vm.viewPage);
}

// Stop managing the details for the selected user.
function stopManagingUser() {
    vm.managing_user = false;
    return false;
}

// Update the account details for the selected user.
function updateUserDetails() {
    // Send POST request to server, containing the updated account details.
    var xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            // Close the user management window:
            vm.managing_user = false;
        }
    };

    xhttp.open("POST", "/admin/update-user", true);
    xhttp.setRequestHeader('Content-type', 'application/json');
    xhttp.send(JSON.stringify(vm.active_user));
    return false;
}

// Stop creating a hotspot venue (close the window used to enter details).
function stopCreatingHotspotVenue() {
    vm.creating_hotspot_venue = false;
    return false;
}

// Submit a new hotspot venue to the server.
function submitHotspotVenue() {
    var xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            vm.manage_hotspot_venues = JSON.parse(this.responseText);
            // Format the dates of each hotspot timeframe:
            for (let hotspot of vm.manage_hotspot_venues) {
                hotspot.start_date = hotspot.start_date.slice(0, 10);
                hotspot.end_date = hotspot.end_date.slice(0, 10);
            }
            stopCreatingHotspotVenue();
        }
    };

    xhttp.open("POST", "/admin/create-hotspot-venue", true);
    xhttp.setRequestHeader('Content-type', 'application/json');
    xhttp.send(JSON.stringify(vm.hotspot_venue_details));

    return false;
}

// Submit a new hotspot area to the server.
function createHotspotArea() {
    var xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            vm.manage_hotspot_areas = JSON.parse(this.responseText);
            // Format the dates of each hotspot timeframe:
            for (let hotspot of vm.manage_hotspot_areas) {
                hotspot.start_date = hotspot.start_date.slice(0, 10);
                hotspot.end_date = hotspot.end_date.slice(0, 10);
            }
        }
    };

    xhttp.open("POST", "/admin/create-hotspot-area", true);
    xhttp.setRequestHeader('Content-type', 'application/json');
    xhttp.send(JSON.stringify(vm.hotspot_area_details));

    return false;
}

// Close the window that displays the check-in history for the selected user.
function stopViewingCheckins() {
    vm.viewing_checkins = false;
    return false;
}

// Search for a hotspot venue.
function searchHotspot() {
    vm.pg = 1;
    getHotspotVenues(vm.page_size, vm.viewPage);
    return false;
}

// Retrieves hotspot venues from the server, using the supplied search term.
function getHotspotVenues(size, page) {
    var xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            vm.manage_hotspot_venues = JSON.parse(this.responseText);
            for (let hotspot of vm.manage_hotspot_venues) {
                hotspot.start_date = hotspot.start_date.slice(0, 10);
                hotspot.end_date = hotspot.end_date.slice(0, 10);
            }
        }
    };

    xhttp.open("GET", `/admin/hotspot-venues?search_by=${encodeURIComponent(vm.search_data_hotspot.by)}&search_term=${encodeURIComponent(vm.search_data_hotspot.term)}&num=${encodeURIComponent(size)}&page=${encodeURIComponent(page)}`, true);

    xhttp.send();
}

// Set the page of hotspot venues that is currently being viewed.
function setHotspotPage(delta) {
    vm.pg = Math.max(1, parseInt(vm.pg) + delta);
    getHotspotVenues(vm.page_size, vm.viewPage);
}

// Close the window used to update the timeframe of a hotspot venue declaration.
function stopUpdatingHotspot() {
    vm.updating_hotspot = false;
    return false;
}

// Update the timeframe for the selected hotspot.
function submitHotspotUpdate() {
    var xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            vm.active_hotspot.start_date = vm.hotspot_update.start_date;
            vm.active_hotspot.start_time = vm.hotspot_update.start_time;
            vm.active_hotspot.end_date = vm.hotspot_update.end_date;
            vm.active_hotspot.end_time = vm.hotspot_update.end_time;
            stopUpdatingHotspot();
        }
    };

    xhttp.open("POST", "/admin/update-hotspot", true);
    xhttp.setRequestHeader('Content-type', 'application/json');
    xhttp.send(JSON.stringify(vm.hotspot_update));

    return false;
}

// Search for venues, using the given search term.
function searchVenue() {
    vm.pg = 1;
    getVenues(vm.page_size, vm.viewPage);
    return false;
}

// Retrieve the venues from the server based on the given search term, and display them in a table.
function getVenues(size, page) {
    var xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            vm.venues = JSON.parse(this.responseText);
        }
    };

    xhttp.open("GET", `/admin/venues?search_by=${encodeURIComponent(vm.search_data_venue.by)}&search_term=${encodeURIComponent(vm.search_data_venue.term)}&num=${encodeURIComponent(size)}&page=${encodeURIComponent(page)}`, true);

    xhttp.send();
}

// Set the page of venues currently being viewed.
function setVenuePage(delta) {
    vm.pg = Math.max(1, parseInt(vm.pg) + delta);
    getVenues(vm.page_size, vm.viewPage);
}

// Close the window used to manage the details for the selected venue.
function stopManagingVenue() {
    vm.managing_venue = false;
    return false;
}

// Update the details of the selected venue.
function updateVenueDetails() {
    // Send POST request to server, containing the updated venue details.
    var xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            vm.managing_venue = false;
        }
    };

    xhttp.open("POST", "/admin/update-venue", true);
    xhttp.setRequestHeader('Content-type', 'application/json');
    xhttp.send(JSON.stringify(vm.active_venue));

    return false;
}

// Close the window used to display the check-in history for the selected venue.
function stopViewingVenueCheckins() {
    vm.viewing_checkins = false;
    return false;
}

// Close the window used to display details about the owner of the selected venue.
function stopViewingOwner() {
    vm.viewing_owner = false;
    return false;
}

// Add an email address to the list of pending health official registrations.
function registerHealthOfficial() {
    var xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            vm.pending = JSON.parse(this.responseText);
        }
    };

    xhttp.open("POST", "/admin/register-health-official", true);
    xhttp.setRequestHeader('Content-type', 'application/json');
    xhttp.send(JSON.stringify({email: vm.admin_email}));

    return false;
}

// Toggle the visibility of the navigation menu (for mobile devices only).
function toggleNavMenu() {
    let navmenu = document.getElementsByTagName('nav')[0];
    if (navmenu.hidden == false) {
        navmenu.hidden = true;
        window.removeEventListener("click", hideNav);
    } else {
        navmenu.hidden = false;
        // Hide the nav menu again, when the user taps the screen:
        window.setTimeout(() => { window.addEventListener("click", hideNav); }, 0);
    }
}

// Toggle the display of the navigation menu, based on the screen's width.
function hideNav(event) {
    let width = window.matchMedia("(max-width: 768px)");
    if (width.matches) {
        toggleNavMenu();
    }
}

// Hide/show the navigation menu on page load, as appropriate for the device type:
hideNav();

// Sign the user out of the web application.
function signOut() {
    // Google sign out:
    var auth2 = gapi.auth2.getAuthInstance();
    auth2.signOut();

    var xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            // The user logged out successfully, so redirect them to the login page:
            document.cookie = "userType=;path=/";
            window.location.href = "/login.html";
        }
    };

    xhttp.open("POST", "/user/logout", true);

    xhttp.send();
}

// Get the account details for the active, logged-in user.
function getUserDetails() {
    var xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            vm.user = JSON.parse(this.responseText);
            vm.old_user = JSON.parse(this.responseText);
        }
    };

    xhttp.open("GET", "/user/details", true);
    xhttp.send();
}

// Revert the user's details to their previous values.
function revertUserDetails() {
    vm.user = JSON.parse(JSON.stringify(vm.old_user));
}

// Update the user's details to their new values.
function applyUserDetails() {
    // Send POST request to server, containing the updated account details.
    var xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            // Refresh the display of the user's details:
            getUserDetails();
        }
    };

    xhttp.open("POST", "/user/details", true);
    xhttp.setRequestHeader('Content-type', 'application/json');
    xhttp.send(JSON.stringify(vm.user));

    return false;
}

// Function to ensure the user's new account password matches the confirm password field.
function validatePassword() {
    var password = document.getElementById("password");
    var confirmPassword = document.getElementById("password-confirm");

    if (String(password.value) != String(confirmPassword.value)) {
        confirmPassword.setCustomValidity("Passwords must match.");
    } else {
        confirmPassword.setCustomValidity("");
    }
}

// Update the account password for the logged-in user.
function applyUserPassword() {
    // Send POST request to server, containing the updated account password.
    let password = document.getElementById('password').value;
    var xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            getUserDetails();
        }
    };

    xhttp.open("POST", "/user/password", true);
    xhttp.setRequestHeader('Content-type', 'application/json');
    xhttp.send(JSON.stringify({password: password}));

    return false;
}

// Get details about the logged-in user on page load.
getUserDetails();

// Get details about the venue owned by the logged-in user.
function getVenueDetails() {
    var xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            vm.venue = JSON.parse(this.responseText);
            vm.old_venue = JSON.parse(this.responseText);
        }
    };

    xhttp.open("GET", "/manager/details", true);
    xhttp.send();
}

// Revert the venue's details to their previous values.
function revertVenueDetails() {
    vm.venue = JSON.parse(JSON.stringify(vm.old_venue));
}

// Update the venue's details to the new values.
function applyVenueDetails() {
    // Send POST request to server, containing the updated venue details.
    var xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            getVenueDetails();
        }
    };

    xhttp.open("POST", "/manager/details", true);
    xhttp.setRequestHeader('Content-type', 'application/json');
    xhttp.send(JSON.stringify(vm.venue));

    return false;
}

// Check if the user has been to an active hotspot.
function hasUserBeenToHotspot() {
    var xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            vm.hotspot_visit = JSON.parse(this.responseText).status;
        }
    };

    xhttp.open("GET", "/user/visit-hotspot", true);
    xhttp.send();
}

// Check if the user has been to an active hotspot on page load:
hasUserBeenToHotspot();