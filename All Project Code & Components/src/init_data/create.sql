DROP TABLE IF EXISTS users CASCADE;
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE,
    email VARCHAR(255) UNIQUE,
    password VARCHAR(512),
    profile_picture VARCHAR(2000),
    follows INT,
    following INT,
    top_songs JSONB,
    top_artists JSONB,
    spotify_refresh_token VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

DROP TABLE IF EXISTS posts CASCADE;
CREATE TABLE posts (
    post_id SERIAL PRIMARY KEY,
    user_id INT,
    img_url VARCHAR(2000),
    song_name VARCHAR(255),
    artist VARCHAR(255),
    song_url VARCHAR(2000),
    song_duration INT, -- ms
    explicit BOOLEAN,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    CONSTRAINT fk_user_id
        FOREIGN KEY(user_id) 
        REFERENCES users (user_id) ON DELETE CASCADE
);

