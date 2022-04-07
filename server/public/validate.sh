echo "Validating HTML and CSS..."
vnu --errors-only --also-check-css --filterpattern ".*v-.*" *.html *.css stylesheets/*.css
#vnu http://localhost:8080/routes.html
echo "Validating JavaScript..."
eslint javascripts/*.js
echo "Validation complete."