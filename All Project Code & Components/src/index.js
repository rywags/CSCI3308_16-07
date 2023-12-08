const express = require('express'); // To build an application server or API
const app = express();
const pgp = require('pg-promise')(); // To connect to the Postgres DB from the node server
const bodyParser = require('body-parser');
const session = require('express-session'); // To set the session object. To store or access session data, use the `req.session`, which is (generally) serialized as JSON by the store.
const bcrypt = require('bcrypt'); //  To hash passwords
const axios = require('axios'); // To make HTTP requests from our server.
const SpotifyWebApi = require('spotify-web-api-node'); // To make requests to the Spotify API

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

// serve static files from the "resources" directory
app.use(express.static('resources'));

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

let user = {
    username: undefined,
    id: undefined,
    spotify_access_token: undefined,
    spotify_refresh_token: undefined,
    tokenExpirationTime: undefined
}

const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: 'http://localhost:3000/callback'
});

const scopes = ['user-read-private', 'user-read-email', 'user-top-read'];
const state = "some-state-of-my-choice";

// Middleware functions

const getTrackInfo = async (req, res, next) => {
    try {
        const trackURL = req.body.songUrl;
        spotifyApi.setAccessToken(req.session.user.spotify_access_token);

        const trackID = trackURL.split('?')[0].split('track/')[1];

        const data = await spotifyApi.getTrack(trackID);
        res.locals.trackInfo = data.body;
        next();
    } catch (error) {
        console.error('Error in getTrackInfo:', JSON.stringify(error, null, 2));
        res.render('pages/home', {
            message: "Failed to get track info from song link",
            error: true
        });
    }
};

// Sets new access token in the session if the current one is expired or it hasn't been set yet
const setSessionAccessToken = async (req, res, next) => {
    console.log("setting session access token");
    try {
        const currentTime = new Date().getTime();
        if (!req.session.user.spotify_access_token || currentTime > req.session.user.tokenExpirationTime) {
            spotifyApi.setRefreshToken(req.session.user.spotify_refresh_token);
            data = await spotifyApi.refreshAccessToken();

            user = {
                username: req.session.user.username,
                id: req.session.user.id,
                spotify_access_token: data.body['access_token'],
                spotify_refresh_token: req.session.user.spotify_refresh_token,
                tokenExpirationTime: new Date().getTime() + data.body['expires_in'] * 1000
            };

            req.session.user = user;
            req.session.save();
        } else {
            console.log('The session access token did not need to be refreshed.');
        }
        
        next();
    } catch (error) {
        console.log(error);
        res.render('pages/home', {
            message: "Failed to refresh access token",
            error: true
        });
    }
};


const updateFromSpotifyProfile = async (req, res, next) => {
    let profile_picture = "https://surgassociates.com/wp-content/uploads/610-6104451_image-placeholder-png-user-profile-placeholder-image-png.jpg";
    if (res.locals.spotify_user_info.images.length !== 0) {
        profile_picture = res.locals.spotify_user_info.images[0].url;
    }
    const tracks = res.locals.tracks;
    const artists = res.locals.artists;
    db.none('UPDATE users SET top_songs = $1, top_artists = $2, profile_picture = $3 WHERE username = $4;', [tracks, artists, profile_picture, req.session.user.username])
        .then(() => {
            next();
        }).catch((error) => {
            console.error(error);
            res.render('pages/home', {
                message: "Failed to update profile",
                error: true
            });
        });
};

const getSpotifyInfo = async (req, res, next) => {
    try {
        spotifyApi.setAccessToken(req.session.user.spotify_access_token);
        const data = await spotifyApi.getMe();
        res.locals.spotify_user_info = data.body;
        next();
    } catch (error) {
        console.error('Error in getSpotifyInfo:', JSON.stringify(error, null, 2));
        res.render('pages/home', {
            message: "Failed to get spotify user info",
            error: true
        });
    }
};

const getTopTracks = async (req, res, next) => {
    try {
        spotifyApi.setAccessToken(req.session.user.spotify_access_token);

        const options = {
            limit: 3,
            time_range: 'short_term'
        }

        const data = await spotifyApi.getMyTopTracks(options);
        res.locals.tracks = data.body;
        next();
    } catch (error) {
        console.error('Error in getTopTracks:', JSON.stringify(error, null, 2));
        res.render('pages/home', {
            message: "Failed to get top tracks",
            error: true
        });
    }
};

const getTopArtists = async (req, res, next) => {
    try {
        spotifyApi.setAccessToken(req.session.user.spotify_access_token);

        const options = {
            limit: 3,
            time_range: 'short_term'
        }

        const data = await spotifyApi.getMyTopArtists(options);
        res.locals.artists = data.body;
        next();
    } catch (error) {
        console.error('Error in getTopArtists:', JSON.stringify(error, null, 2));
        res.render('pages/home', {
            message: "Failed to get top artists",
            error: true
        });
    }
};

const login = async (req, res, next) => {
    await db.one('SELECT * FROM users WHERE username = $1;', req.body.username)
        .then(async (data) => {
            const match = await bcrypt.compare(req.body.password, data.password);
            if (match) {
                user = {
                    username: data.username,
                    spotify_refresh_token: data.spotify_refresh_token,
                    id: data.user_id
                };
                req.session.user = user;
                req.session.save();
                next();
            } else {
                res.render('pages/login', {
                    message: "Incorrect username or password.",
                    error: true
                });
            }
        }).catch((error) => {
            console.log(error);
            res.render('pages/login', {
                message: "User not found. Please check your username.",
                error: true
            });
        });
};

//TODO: Implement Endpoints
app.get('/', (req, res) => {
    res.redirect('/home/10');
});

app.get('/login', (req, res) => {
    res.render('pages/login');
});

app.post('/login', login, setSessionAccessToken, getTopTracks, getTopArtists, getSpotifyInfo, updateFromSpotifyProfile, (req, res) => {
    res.redirect('/');
});

app.get('/register', (req, res) => {
    res.render('pages/register');
});

app.post('/register', async (req, res) => {
    if (!req.body.username || !req.body.displayName || !req.body.email || !req.body.password1 || !req.body.password2) {
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
        const addUser = 'INSERT INTO users (display_name, username, email, password) VALUES ($1, $2, $3, $4)';
        const userInfo = [req.body.displayName.trim(), req.body.username.trim(), req.body.email.trim(), hash];
        await db.none(addUser, userInfo)
            .then(() => {
                user = {
                    username: req.body.username.trim(),
                    spotify_refresh_token: undefined,
                    id: undefined,
                    tokenExpirationTime: undefined
                }
                req.session.user = user;
                req.session.save();
                res.redirect(spotifyApi.createAuthorizeURL(scopes, state));
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
};

app.get('/logout', auth, (req, res) => {
    user.username = undefined;
    user.id = undefined;
    user.spotify_access_token = undefined;
    user.spotify_refresh_token = undefined;
    user.tokenExpirationTime = undefined;
    spotifyApi.resetAccessToken();
    spotifyApi.resetRefreshToken();
    req.session.destroy();
    res.render('pages/login', { message: "Logged out Successfully" });
});

app.get('/search', auth, (req, res) => {
    res.render('pages/search');
});

app.post('/search', auth, (req, res) => {
    const username = '%' + req.body.username + '%';
    const query = `select * from users where username like $1`;
    db.manyOrNone(query, [username])
        .then((data) => {
            res.render('pages/search', { users: data });
        })
        .catch((err) => {
            console.log(err);
            redirect('/search');
        })
});

app.get('/create_post', auth, (req, res) => {
    res.render('pages/create_post');
});

app.post('/create_post', auth, setSessionAccessToken, getTrackInfo, async (req, res) => {

    try {
        const description = req.body.description;
        const songUrl = req.body.songUrl;
        const trackInfo = res.locals.trackInfo;
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

app.get('/home/:amount', auth, async (req, res) => {
    const amount = req.params.amount;
    const current_user_id = req.session.user.id;

    db.any(`
        SELECT posts.*, users.*, comments.*, posts.post_id AS post_post_id, comments.post_id AS comment_post_id,
        CASE WHEN likes.user_id IS NOT NULL THEN TRUE ELSE FALSE END AS user_liked
        FROM posts
        INNER JOIN users ON users.user_id = posts.user_id
        LEFT JOIN (
            SELECT *, ROW_NUMBER() OVER (PARTITION BY post_id ORDER BY created_at DESC) as rn
            FROM comments
        ) comments ON comments.post_id = posts.post_id AND comments.rn = 1
        LEFT JOIN likes ON likes.post_id = posts.post_id AND likes.user_id = $1
        WHERE posts.user_id IN (
            SELECT following_id FROM follows WHERE follower_id = $1
        )
        ORDER BY posts.post_id DESC
        LIMIT $2;
    `, [current_user_id, amount])
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
    db.one('SELECT * FROM users WHERE username = $1;', req.session.user.username)
        .then(async (data) => {
            const postData = await db.any(`
            SELECT posts.*, users.*, comments.*, posts.post_id AS post_post_id, comments.post_id AS comment_post_id,
            CASE WHEN likes.user_id IS NOT NULL THEN TRUE ELSE FALSE END AS user_liked
            FROM posts
            INNER JOIN users ON users.user_id = posts.user_id
            LEFT JOIN (
                SELECT *, ROW_NUMBER() OVER (PARTITION BY post_id ORDER BY created_at DESC) as rn
                FROM comments
            ) comments ON comments.post_id = posts.post_id AND comments.rn = 1
            LEFT JOIN likes ON likes.post_id = posts.post_id AND likes.user_id = $1
            WHERE posts.user_id = $1
            ORDER BY posts.post_id DESC;`, [req.session.user.id]);
            res.render('pages/profile', { user: data, topTracks: data.top_songs, topArtists: data.top_artists, ownProfile: true, edit: false, posts: postData });
        }).catch((error) => {
            console.error(error);
            res.render('pages/home', {
                message: "Failed to get profile",
                error: true
            });
        });
});

app.get('/profile/edit', auth, async (req, res) => {
    db.one('SELECT * FROM users WHERE username = $1;', req.session.user.username)
        .then(async (data) => {
            const postData = await db.any(`
            SELECT posts.*, users.*, comments.*, posts.post_id AS post_post_id, comments.post_id AS comment_post_id,
            CASE WHEN likes.user_id IS NOT NULL THEN TRUE ELSE FALSE END AS user_liked
            FROM posts
            INNER JOIN users ON users.user_id = posts.user_id
            LEFT JOIN (
                SELECT *, ROW_NUMBER() OVER (PARTITION BY post_id ORDER BY created_at DESC) as rn
                FROM comments
            ) comments ON comments.post_id = posts.post_id AND comments.rn = 1
            LEFT JOIN likes ON likes.post_id = posts.post_id AND likes.user_id = $1
            WHERE posts.user_id = $1
            ORDER BY posts.post_id DESC;`, [req.session.user.id]);
            res.render('pages/profile', { user: data, topTracks: data.top_songs, topArtists: data.top_artists, ownProfile: true, edit: true, posts: postData });
        }).catch((error) => {
            console.error(error);
            res.render('pages/home', {
                message: "Failed to get profile",
                error: true
            });
        });
});

app.post('/profile/edit', auth, async (req, res) => {
    const display_name = req.body.displayName;
    const bio = req.body.bio;

    db.none('UPDATE users SET display_name = $1, bio = $2 WHERE username = $3;', [display_name, bio, req.session.user.username])
        .then(() => {
            res.redirect('/profile');
        }
        ).catch((error) => {
            console.error(error);
            res.render('pages/home', {
                message: "Failed to update profile",
                error: true
            });
        });
});

app.get('/profile/:user_id', auth, async (req, res) => {
    const user_id = req.params.user_id;
    const current_user_id = req.session.user.id;
    if (user_id == current_user_id) {
        res.redirect('/profile');
        return;
    }

    const postData = await db.any(`
                    SELECT posts.*, users.*, comments.*, posts.post_id AS post_post_id, comments.post_id AS comment_post_id,
                    CASE WHEN likes.user_id IS NOT NULL THEN TRUE ELSE FALSE END AS user_liked
                    FROM posts
                    INNER JOIN users ON users.user_id = posts.user_id
                    LEFT JOIN (
                        SELECT *, ROW_NUMBER() OVER (PARTITION BY post_id ORDER BY created_at DESC) as rn
                        FROM comments
                    ) comments ON comments.post_id = posts.post_id AND comments.rn = 1
                    LEFT JOIN likes ON likes.post_id = posts.post_id AND likes.user_id = $1
                    WHERE posts.user_id = $1
                    ORDER BY posts.post_id DESC;`, [user_id]);

    db.one('SELECT * FROM users WHERE user_id = $1;', user_id)
        .then(async (data) => {
            db.oneOrNone('SELECT * FROM follows WHERE follower_id = $1 AND following_id = $2;', [current_user_id, user_id])
                .then((followData) => {
                    let isfollowing = false;
                    if (followData) {
                        isfollowing = true;
                    }
                    res.render('pages/profile', { user: data, topTracks: data.top_songs, topArtists: data.top_artists, ownProfile: false, isfollowing: isfollowing, posts: postData });
                }).catch((error) => {
                    console.error(error);
                    res.render('pages/home', {
                        message: "Failed to get follow data",
                        error: true
                    });
                });
        }).catch((error) => {
            console.error(error);
            res.render('pages/home', {
                message: "Failed to get profile",
                error: true
            });
        });
});

// The callback after the user has authenticated
app.get('/callback', function (req, res) {
    const error = req.query.error;
    const code = req.query.code;
    const state = req.query.state;

    if (error) {
        console.error('Callback Error:', error);
        res.send(`Callback Error: ${error}`);
        return;
    }

    spotifyApi.authorizationCodeGrant(code).then(
        function (data) {
            const access_token = data.body['access_token'];
            const refresh_token = data.body['refresh_token'];
            const expires_in = data.body['expires_in'];

            // necessary?
            user = {
                username: req.session.user.username,
                spotify_access_token: access_token,
                spotify_refresh_token: refresh_token,
                tokenExpirationTime: new Date().getTime() + expires_in * 1000
            }

            req.session.user = user;
            req.session.save();

            db.none('UPDATE users SET spotify_refresh_token = $1 WHERE username = $2;', [refresh_token, req.session.user.username])
                .catch((error) => {
                    throw error;
                });

            res.redirect('/login');
        }).catch(
            function (err) {
                console.error('Error getting Tokens:', err);
                // delete user from database
                db.none('DELETE FROM users WHERE username = $1;', req.session.user.username)
                res.render('pages/register', {
                    message: "Failed to authenticate",
                    error: true
                });
            }
        );
});

app.get('/post/comments/:post_id', auth, async (req, res) => {
    const post_id = req.params.post_id;

    try {
        // First, fetch the post data
        const postData = await db.one(`
            SELECT posts.*, users.* 
            FROM posts 
            INNER JOIN users ON users.user_id = posts.user_id 
            WHERE posts.post_id = $1;
        `, [post_id]);

        // Then, fetch the comments data
        const commentsData = await db.any(`
            SELECT * FROM comments 
            INNER JOIN users ON users.user_id = comments.user_id 
            WHERE post_id = $1 
            ORDER BY comment_id DESC;
        `, [post_id]);

        // Render the comments page with both comments and post data
        res.render('pages/comments', {
            post: postData,
            comments: commentsData
        });
    } catch (error) {
        console.error(error);
        res.render('pages/comments', {
            message: "Failed to get post or comments",
            error: true
        });
    }
});

app.post('/post/comments/:post_id', auth, async (req, res) => {
    const post_id = req.params.post_id;
    const comment = req.body.comment;
    const sql = `INSERT INTO comments (user_id, post_id, comment) VALUES ($1, $2, $3)`;
    const values = [req.session.user.id, post_id, comment];

    if (comment.trim() === '') {
        res.redirect(`/post/comments/${post_id}`);
        return;
    }

    await db.none(sql, values);
    res.redirect(`/post/comments/${post_id}`);
});

app.post('/user/follow/:user_id', auth, async (req, res) => {
    const user_id = req.params.user_id;
    const sql = `INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)`;
    const values = [req.session.user.id, user_id];

    await db.none(sql, values);

    const updateFollowersSql = `UPDATE users SET followers = followers + 1 WHERE user_id = $1`;
    await db.none(updateFollowersSql, [user_id]);

    const updateFollowingSql = `UPDATE users SET following = following + 1 WHERE user_id = $1`;
    await db.none(updateFollowingSql, [req.session.user.id]);

    res.redirect(`/profile/${user_id}`);
});

app.post('/user/unfollow/:user_id', auth, async (req, res) => {
    const user_id = req.params.user_id;
    const sql = `DELETE FROM follows WHERE follower_id = $1 AND following_id = $2`;
    const values = [req.session.user.id, user_id];

    await db.none(sql, values);

    const updateFollowersSql = `UPDATE users SET followers = followers - 1 WHERE user_id = $1`;
    await db.none(updateFollowersSql, [user_id]);

    const updateFollowingSql = `UPDATE users SET following = following - 1 WHERE user_id = $1`;
    await db.none(updateFollowingSql, [req.session.user.id]);

    res.redirect(`/profile/${user_id}`);
});

//should not redirect - should just update the likes
app.post('/post/like/:post_id', auth, async (req, res) => {
    const post_id = req.params.post_id;
    const user_id = req.session.user.id;
    const checkSql = `SELECT * FROM likes WHERE user_id = $1 AND post_id = $2`;
    const insertSql = `INSERT INTO likes (user_id, post_id) VALUES ($1, $2)`;
    const updateLikesSql = `UPDATE posts SET likes = likes + 1 WHERE post_id = $1`;

    try {
        const existingLike = await db.oneOrNone(checkSql, [user_id, post_id]);

        if (existingLike) {
            return res.status(400).send("Post already liked");
        }

        await db.none(insertSql, [user_id, post_id]);
        await db.none(updateLikesSql, [post_id]);

        res.status(200).send("Liked post");
    } catch (error) {
        console.error(error);
        res.status(500).send("Failed to like post");
    }
});

//should not redirect - should just update the likes
app.post('/post/unlike/:post_id', auth, async (req, res) => {
    const post_id = req.params.post_id;
    const user_id = req.session.user.id;
    const checkSql = `SELECT * FROM likes WHERE user_id = $1 AND post_id = $2`;
    const deleteSql = `DELETE FROM likes WHERE user_id = $1 AND post_id = $2`;
    const updateLikesSql = `UPDATE posts SET likes = likes - 1 WHERE post_id = $1`;

    try {
        const existingLike = await db.oneOrNone(checkSql, [user_id, post_id]);

        if (!existingLike) {
            return res.status(400).send("Post not liked yet");
        }

        await db.none(deleteSql, [user_id, post_id]);
        await db.none(updateLikesSql, [post_id]);

        res.status(200).send("Unliked post");
    } catch (error) {
        console.error(error);
        res.status(500).send("Failed to unlike post");
    }
});

app.post('/post/delete/:post_id', auth, async (req, res) => {
    const post_id = req.params.post_id;
    const user_id = req.session.user.id;
    const sql = `DELETE FROM posts WHERE post_id = $1 AND user_id = $2`;

    try {
        await db.none(sql, [post_id, user_id]);
        res.redirect('/profile');
    } catch (error) {
        console.log(error);
        res.status(500).send("Failed to delete post");
    }
});

app.post('/profile/delete', auth, async (req, res) => {
    const user_id = req.session.user.id;
    const sql = `DELETE FROM users WHERE user_id = $1`;

    try {
        await db.none(sql, [user_id]);
        user.username = undefined;
        user.id = undefined;
        user.spotify_access_token = undefined;
        user.spotify_refresh_token = undefined;
        user.tokenExpirationTime = undefined;
        spotifyApi.resetAccessToken();
        spotifyApi.resetRefreshToken();
        req.session.destroy();
        res.render('pages/login', { message: "Account Successfully Deleted" });
    } catch (error) {
        console.error(error);
        res.redirect('/profile');
    }
});






// starting the server and keeping the connection open to listen for more requests
module.exports = app.listen(3000);

console.log('Server is listening on port 3000');