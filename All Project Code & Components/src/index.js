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
    username: undefined,
    id: undefined
}

let accessToken = null;
let tokenExpirationTime = null;

//TODO: Implement Endpoints
app.get('/', (req, res) => {
    res.redirect('/discovery/10');
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
                user.id = data.user_id;
                req.session.user = user;
                req.session.save();
                // res.json({ message: "Logged in successfully" });
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
    if (!req.body.username || !req.body.email || !req.body.password1 || !req.body.password2 || !req.body.spotifyUserID) {
        res.render('pages/register', {
            message: "Missing fields.",
            error: true
        });
    }
    if (req.body.password1 !== req.body.password2) {
        res.render('pages/register', {
            message: "Passwords do not match.",
            error: true
        });
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
        const hash = await bcrypt.hash(req.body.password1, 10);
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

app.delete('/delete/:username', (req, res) => {
    db.none('DELETE FROM users WHERE username = $1;', req.params.username)
        .then(() => {
            res.json({ message: "User deleted successfully" });
        }).catch((error) => {
            console.error(error);
            res.json({ message: "User deletion failed" });
        });
});

const auth = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
};

app.get('/logout', auth, (req, res) => {
    user.username = undefined;
    req.session.destroy();
    res.render('pages/login', { message: "Logged out Successfully" });
});

app.get('/create_post', auth, (req, res) => {
    res.render('pages/create_song_post');
});

app.post('/create_post', auth, async (req, res) => {

    try {
        const { songUrl, description } = req.body;
        const trackInfo = await getTrackInfo(songUrl);
        const postInfo = {
            user_id: req.session.user.id,
            song_name: trackInfo.name,
            artist: trackInfo.artists[0].name,
            description: description,
            song_url: songUrl,
            song_duration: trackInfo.duration_ms,
            explicit: trackInfo.explicit,
            img_url: trackInfo.album.images[0].url,
        };
        const sql = `INSERT INTO posts (user_id, img_url, song_name, artist, song_url, song_duration, explicit, description) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`;
        const values = [postInfo.user_id, postInfo.img_url, postInfo.song_name, postInfo.artist, postInfo.song_url, postInfo.song_duration, postInfo.explicit, postInfo.description];

        await db.none(sql, values);
        res.redirect('/');
    } catch (error) {
        console.error(error);
        res.render('pages/home', {
            message: "Post creation failed",
            error: true
        });
    }
});

async function getTrackInfo(trackURL) {
    try {
        const currentTime = new Date();
        if (!accessToken || currentTime > tokenExpirationTime) {
            const tokenData = await getAccessToken();
            if (tokenData === null) {
                throw new Error('Failed to get access token');
            }
            accessToken = tokenData.token;
            tokenExpirationTime = new Date(currentTime.getTime() + tokenData.expires_in * 1000);
        }
        const trackID = trackURL.split('?')[0].split('track/')[1];
        const response = await axios.get(`https://api.spotify.com/v1/tracks/${trackID}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        return response.data;
    } catch (error) {
        console.error(error);
    }
}

async function getAccessToken() {
    const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
    const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

    console.log("Spotify Client ID: " + SPOTIFY_CLIENT_ID);
    console.log("Spotify Client Secret: " + SPOTIFY_CLIENT_SECRET);




    // Encode the credentials in base64
    // const credentials = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`, 'utf-8').toString('base64');

    try {
        const response = await axios.post(
            'https://accounts.spotify.com/api/token',
            `grant_type=client_credentials&client_id=${SPOTIFY_CLIENT_ID}&client_secret=${SPOTIFY_CLIENT_SECRET}`,
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );
        console.log("Response from Spotify");
        console.log(response.data);
        return {
            token: response.data.access_token,
            expires_in: response.data.expires_in
        };
    } catch (error) {
        console.error(error);
        return null;
    }
}

app.get('/discovery/:amount', auth, async (req, res) => {
    const amount = req.params.amount;
    const posts = await db.any(`SELECT * FROM posts ORDER BY post_id DESC LIMIT $1;`, [amount])
        .then((data) => {
            res.render('pages/home', { posts: data });
        }).catch((error) => {
            res.render('pages/home', {
                message: "Failed to get posts",
                error: true
            });
            console.error(error);
        });
});

app.get('/profile', auth, async (req, res) => {
    res.render('pages/profile');


});

// starting the server and keeping the connection open to listen for more requests
module.exports = app.listen(3000);
console.log('Server is listening on port 3000');