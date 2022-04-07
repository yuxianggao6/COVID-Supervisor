var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var session = require('express-session');
var mysql = require('mysql');

// Setup routes for each account type:
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var managersRouter = require('./routes/managers');
var adminsRouter = require('./routes/admins');

// Setup the database connection:
var dbConnectionPool = mysql.createPool({
    host: 'localhost',
    database: 'covid'
});

var app = express();

// Make the database accessible to all middleware and routes:
app.use(function(req, res, next) {
    req.pool = dbConnectionPool;
    next();
});

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Initialise server sessions:
app.use(session({
    secret: "My Secret",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// Setup routes:
app.use('/', indexRouter);
app.use(express.static(path.join(__dirname, 'public')));

app.use('/user', usersRouter);

app.use('/manager', managersRouter);

app.use('/admin', adminsRouter);

module.exports = app;
