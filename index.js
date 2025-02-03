import express from "express";
import cookieParser from "cookie-parser";
import SpotifyWebApi from "spotify-web-api-node";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url"; 

dotenv.config();
const app = express();
const PORT = 8888;

// ✅ Define __dirname manually for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Middleware
app.use(cookieParser());
app.set("view engine", "ejs"); // Use EJS for rendering HTML
app.set("views", path.join(__dirname, "views"));

// Serve static files (if needed for styling)
app.use(express.static(path.join(__dirname, 'public')));

// Route to render the home page
app.get('/', (req, res) => {
  res.render('index'); // Render 'index.ejs' from the views folder
});

import mongoose from "mongoose";

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.CONN_URI, { // Replace with your connection string
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('Error connecting to MongoDB:', err);
  }
};

connectDB();


async function createIndexes() {
  try {
    await User.createIndexes(); // This will ensure the unique index is created in MongoDB
    console.log('Indexes created');
  } catch (error) {
    console.error('Error creating indexes:', error);
  }
}

// Call this function when your application starts
// createIndexes();

import User from "./schema.js";

async function saveUserData(email, userProfile, topArtists, topTracks, savedTracks) {
  const user = new User({
    email,
    userProfile,
    topArtists,
    topTracks,
    savedTracks
  });

  try {
    await user.save(); // Attempt to save the user data to the database
    console.log('User data saved successfully');
    return "User data saved successfully"
  } catch (error) {
    if (error.code === 11000) {
      console.error('Error: Duplicate email'); // Handle duplicate email
      return "data already saved"
    } else {
      console.error('Error saving user data:', error);
      return "Error saving user data:"+ error + "\npls contact developer"
    }
  }
}




// Spotify API Setup
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.SPOTIFY_REDIRECT_URI,
});

const generateRandomString = (length) => {
  return [...Array(length)]
    .map(() => Math.random().toString(36)[2])
    .join("");
};

const stateKey = "spotify_auth_state";

// 🔹 Step 1: Login Route (Redirect to Spotify)
app.get("/login", (req, res) => {
  const state = generateRandomString(16);
  res.cookie(stateKey, state);

  const authorizeURL = spotifyApi.createAuthorizeURL(
    [
      "user-read-private",  // user subscription
      "user-read-email", // user email
      "user-top-read",  // top artist and tracks
      "user-library-read", // Access liked songs
    ],
    state
  );

  res.redirect(authorizeURL);
});

async function getTopArtists(spotifyApi,timeRange = 'medium_term') {
  let allArtists = [];
  let limit = 50;  // Maximum limit per request
  let offset = 0;  // Starting point
  let totalFetched = 0;
  console.log("getting top artists");
  

  // Fetch two pages of 50 artists each (total 100 records)
  while (totalFetched < 100) {
    const response = await spotifyApi.getMyTopArtists({ limit, offset ,time_range: timeRange});
    // console.log(response.body);
    
    allArtists = allArtists.concat(response.body.items);  // Concatenate the results
    if(response.body.next == null) break;
    totalFetched += response.body.items.length;
    offset += limit;  // Move the offset for the next page
    await delay(1000);
  }

  return allArtists;  // Return the complete list of 100 top artists
}
async function getTopTracks(spotifyApi,timeRange = 'medium_term') {
  let allTracks = [];
  let limit = 50;  // Maximum limit per request
  let offset = 0;  // Starting point
  let totalFetched = 0;
  console.log("getting top tracks");
  

  // Fetch two pages of 50 tracks each (total 100 records)
  while (totalFetched < 100) {
    const response = await spotifyApi.getMyTopTracks({ limit, offset ,time_range: timeRange});
    // console.log(response.body);
    
    allTracks = allTracks.concat(response.body.items);  // Concatenate the results
    if(response.body.next == null) break;
    totalFetched += response.body.items.length;
    offset += limit;  // Move the offset for the next page
    await delay(1000);
  }

  return allTracks;  // Return the complete list of 100 top tracks
}

async function getSavedTracks(spotifyApi) {
  let allSavedTracks = [];
  let limit = 50;  // Maximum limit per request
  let offset = 0;  // Starting point
  let totalFetched = 0;
  console.log("getting saved tracks");
  

  // Fetch two pages of 50 savedTracks each (total 100 records)
  while (totalFetched < 100) {
    const response = await spotifyApi.getMySavedTracks({ limit, offset});
    // console.log(response.body);
    
    allSavedTracks = allSavedTracks.concat(response.body.items);  // Concatenate the results
    if(response.body.next == null) break;
    totalFetched += response.body.items.length;
    offset += limit;  // Move the offset for the next page
    await delay(1000);
  }

  return allSavedTracks;  // Return the complete list of 100 saved tracks
}

// 🔹 Step 2: Callback Route (Exchange Code for Access Token)
app.get("/callback", async (req, res) => {
  const code = req.query.code || null;
  const state = req.query.state || null;
  const storedState = req.cookies ? req.cookies[stateKey] : null;

  if (!state || state !== storedState) {
    res.redirect("/#error=state_mismatch");
  } else {
    res.clearCookie(stateKey);
    console.log("here");
    

    try {
      const data = await spotifyApi.authorizationCodeGrant(code);
      const { access_token, refresh_token } = data.body;

      // Set tokens
      spotifyApi.setAccessToken(access_token);
      spotifyApi.setRefreshToken(refresh_token);

      // Redirect to dashboard page
      res.redirect(`/dashboard?access_token=${access_token}`);
    } catch (error) {
      console.error("Error exchanging code:", error);
      res.redirect("/#error=invalid_token");
    }
  }
});

// 🔹 Step 3: Fetch User Data (Top Artists, Tracks, Liked Songs)
app.get("/dashboard", async (req, res) => {
  const access_token = req.query.access_token;
  if (!access_token) {
    return res.redirect("/login");
  }

  spotifyApi.setAccessToken(access_token);
  
  try {
    // Fetch user profile
    const userProfile = await spotifyApi.getMe();
    // console.log(userProfile.body);
    

    // Fetch top artists
    // const topArtists = await spotifyApi.getMyTopArtists({ limit: 5 });
    const topArtists1 = await getTopArtists(spotifyApi,'long_term');
    // console.log(topArtists1.length);
    

    // Fetch top tracks
    // const topTracks = await spotifyApi.getMyTopTracks({ limit: 5 ,time_range:"long_term"});
    const topTracks = await getTopTracks(spotifyApi,'short_term');

    // Fetch liked songs
    // const likedSongs = await spotifyApi.getMySavedTracks({ limit: 5 });
    const likedSongs = await getSavedTracks(spotifyApi)

    const saveMsg = await saveUserData(userProfile.body.email,userProfile.body,topArtists1,topTracks,likedSongs)

    // Render dashboard page with data
    res.render("dashboard", {
      msg: saveMsg,
      user: userProfile.body,
      topArtists: topArtists1,
      topTracks: topTracks,
      likedSongs: likedSongs,
    });
  } catch (error) {
    console.error("Error fetching user data:", error);
    res.redirect("/login");
  }
  console.log("done");
  
});



// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
