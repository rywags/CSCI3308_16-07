DROP TABLE IF EXISTS users CASCADE;
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    display_name VARCHAR(255) NOT NULL,
    username VARCHAR(255) UNIQUE,
    email VARCHAR(255) UNIQUE,
    password VARCHAR(512),
    bio TEXT DEFAULT '-bio-',
    profile_picture VARCHAR(2000) DEFAULT 'https://surgassociates.com/wp-content/uploads/610-6104451_image-placeholder-png-user-profile-placeholder-image-png.jpg',
    followers INT DEFAULT 0,
    following INT DEFAULT 0,
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
    likes INT DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    CONSTRAINT fk_user_id
        FOREIGN KEY(user_id) 
        REFERENCES users (user_id) ON DELETE CASCADE
);

DROP TABLE IF EXISTS comments CASCADE;
CREATE TABLE comments (
    comment_id SERIAL PRIMARY KEY,
    user_id INT,
    post_id INT,
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_id
        FOREIGN KEY(user_id) 
        REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT fk_post_id
        FOREIGN KEY(post_id) 
        REFERENCES posts (post_id) ON DELETE CASCADE
);

DROP TABLE IF EXISTS follows CASCADE;
CREATE TABLE follows (
    follow_id SERIAL PRIMARY KEY,
    follower_id INT,
    following_id INT,
    CONSTRAINT fk_follower_id
        FOREIGN KEY(follower_id) 
        REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT fk_following_id
        FOREIGN KEY(following_id) 
        REFERENCES users (user_id) ON DELETE CASCADE
);

DROP TABLE IF EXISTS likes CASCADE;
CREATE TABLE likes (
    like_id SERIAL PRIMARY KEY,
    user_id INT,
    post_id INT,
    CONSTRAINT fk_user_id
        FOREIGN KEY(user_id) 
        REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT fk_post_id
        FOREIGN KEY(post_id) 
        REFERENCES posts (post_id) ON DELETE CASCADE
);
