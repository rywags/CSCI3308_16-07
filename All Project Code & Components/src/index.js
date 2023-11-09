const express = require('express'); // To build an application server or API
const app = express();
const pgp = require('pg-promise')(); // To connect to the Postgres DB from the node server
const bodyParser = require('body-parser');
const session = require('express-session'); // To set the session object. To store or access session data, use the `req.session`, which is (generally) serialized as JSON by the store.
const bcrypt = require('bcrypt'); //  To hash passwords
const axios = require('axios'); // To make HTTP requests from our server.

// database configuration
const dbConfig = {
    host: 'db', // the database server
    port: 5432, // the database port
    database: process.env.POSTGRES_DB, // the database name
    user: process.env.POSTGRES_USER, // the user account to connect with
    password: process.env.POSTGRES_PASSWORD, // the password of the user account
};

const db = pgp(dbConfig);

// test your database
db.connect()
    .then(obj => {
        console.log('Database connection successful'); // you can view this message in the docker compose logs
        obj.done(); // success, release the connection;
    })
    .catch(error => {
        console.log('ERROR:', error.message || error);
    });

app.set('view engine', 'ejs'); // set the view engine to EJS
app.use(bodyParser.json()); // specify the usage of JSON for parsing request body.

// initialize session variables
app.use(
    session({
        secret: process.env.SESSION_SECRET,
        saveUninitialized: false,
        resave: false,
    })
);

app.use(
    bodyParser.urlencoded({
        extended: true,
    })
);

//TODO: Implement Endpoints
app.get('/', (req, res) => {
    res.render('pages/home');
});

app.get('/login', (req, res) => {
    res.render('pages/login');
});

app.post('/login', async (req, res) => {
    const user = await db.oneOrNone('SELECT * FROM users WHERE username = $1;', req.body.username);
    if (!user) {
        res.render('pages/login', { message: "User not found. Please check your username." });
    } else {
        const match = await bcrypt.compare(req.body.password, user.password);
        if (!match) {
            res.render('pages/login', { message: "Incorrect password. Please try again." });
        } else {
            req.session.user = user;
            req.session.save();
            res.redirect('/discover');
        }
    }
});

app.get('/register', (req, res) => {
    res.render('pages/register');
});

app.post('/register', async (req, res) => {
    if (!req.body.username || !req.body.password) {
        res.render('pages/register', { error: "Username and password are required." });
    }
    const existingUser = await db.oneOrNone('SELECT * FROM users WHERE username = $1;', req.body.username);
    if (existingUser) {
        res.render('pages/register', { error: "Username already exists. Please choose a different one." });
    }
    const hash = await bcrypt.hash(req.body.password, 10);
    const addUser = 'INSERT INTO users (username, password) VALUES ($1, $2)';
    const userInfo = [req.body.username, hash];
    try {
        await db.none(addUser, userInfo);
        res.redirect('/login');
    } catch (error) {
        console.error(error);
        res.render('pages/register', { message: "An error occurred during registration. Please try again." });
    }
});



app.get('/logout', (req, res) => {
    req.session.destroy();
    res.render('pages/login', { message: "Logged out Successfully" });
});

// starting the server and keeping the connection open to listen for more requests
app.listen(3000);
console.log('Server is listening on port 3000');