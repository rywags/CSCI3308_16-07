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

const user = {
    username: undefined
}

//TODO: Implement Endpoints
app.get('/', (req, res) => {
    res.redirect('/discovery');
});

app.get('/login', (req, res) => {
    res.render('pages/login');
});

app.post('/login', async (req, res) => {
    await db.one('SELECT * FROM users WHERE username = $1;', req.body.username)
        .then(async (data) => {
            const match = await bcrypt.compare(req.body.password, data.password);
            if (match) {
                user.username = req.body.username;
                req.session.user = user;
                req.session.save();
                res.redirect('/');
            } else {
                res.render('pages/login', {
                    message: "Incorrect username or password.",
                    error: true
                });
            }
        }).catch((error) => {
            res.render('pages/login', {
                message: "User not found. Please check your username.",
                error: true
            });
        });
});

app.get('/register', (req, res) => {
    res.render('pages/register');
});

app.post('/register', async (req, res) => {
    if (!req.body.username || !req.body.email || !req.body.password || !req.body.spotifyUserID) {
        res.render('pages/register', { message: "Missing fields.", error: true });
    }
    else {
        const username = req.body.username.trim().toLowerCase();
        const email = req.body.email.trim().toLowerCase();
        const existingUser = await db.oneOrNone('SELECT * FROM users WHERE LOWER(username) = $1 OR LOWER(email) = $2;', [username, email]);
        if (existingUser) {
            res.render('pages/register', {
                message: "Username or email already exists.",
                error: true
            });
            return;
        }
        const hash = await bcrypt.hash(req.body.password, 10);
        const addUser = 'INSERT INTO users (username, email, password, spotify_user_id) VALUES ($1, $2, $3, $4)';
        const userInfo = [req.body.username.trim(), req.body.email.trim(), hash, req.body.spotifyUserID];
        await db.none(addUser, userInfo)
            .then(() => {
                res.redirect('/login');
            }).catch((error) => {
                console.error(error);
                res.render('pages/register', {
                    message: "Registration failed",
                    error: true
                });
            })
    }
});

const auth = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
}; // middleware to check if the user is logged in

app.use(auth);

app.get('/discovery', async (req, res) => {
    res.render('pages/home');
});

app.get('/logout', (req, res) => {
    user.username = undefined;
    req.session.destroy();
    res.render('pages/login', { message: "Logged out Successfully" });
});

// starting the server and keeping the connection open to listen for more requests
app.listen(3000);
console.log('Server is listening on port 3000');