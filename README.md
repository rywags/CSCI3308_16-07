# CSCI3308_16-07
CSCI 3308 Group Project

Brief Application description

### Contributors
- Eric Fithian: Eric-Fithian
- Owen Vangermeersch: owva7393
- Ryan Wagster: rywags
- Yuhe Zou: YuheZou

## Technology Stack used for the project:
- EJS Templating
- Node.js
- Express
- PostgreSQL

## Prerequisites to run the application:
- Docker
- Spotify Developer Account Api Set up

## Instructions on how to run the application locally:

### 1. **Create a Spotify Account**
- If you don't have a Spotify account, sign up at [Spotify's Website](https://www.spotify.com/).

### 2. **Register an App**
- Navigate to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/).
- Log in and click **Create an App**.
- Fill in the application details and accept the terms.
- Click **Create**.

### 3. **Note Down Your Client ID and Client Secret**
- After app creation, you'll be redirected to your app dashboard.
- Note your **Client ID** and **Client Secret**.

### 4. **Set the Redirect URI**
- In your app settings, click **Edit Settings**.
- Add the Redirect URI 'http://localhost:3000/callback' and save changes.

### 5. **Create .env**
- Under the All Project Code & Components directory create a .env file
- Fill out the .env as specified below:
  ```
  # database credentials
  POSTGRES_USER="<user>"
  POSTGRES_PASSWORD="<password>"
  POSTGRES_DB="<dbname>"
  
  # Node vars
  SESSION_SECRET="<some secret>"
  
  # Spotify vars
  SPOTIFY_CLIENT_ID="<your spotify client id>"
  SPOTIFY_CLIENT_SECRET="<your spotify client secret>"
  ```

### 6. **Run App**
- Finally run `docker compose up`
- The website should be running at http://localhost:3000/

## How to run the tests
- simply `docker compose up`

## Link to the deployed application
