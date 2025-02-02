import { Schema, model } from 'mongoose';

// Define the schema
const userSchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true, // Ensures that the email is unique in the collection
    trim: true,
    lowercase: true
  },
  userProfile: {
    type: Object, // You can adjust the structure based on the user profile data you want to store
    required: true
  },
  topArtists: [{
    type: Object, // You can define a more detailed schema for artists if needed
    required: true
  }],
  topTracks: [{
    type: Object, // You can define a more detailed schema for tracks if needed
    required: true
  }],
  savedTracks: [{
    type: Object, // You can define a more detailed schema for saved tracks if needed
    required: true
  }],
});

// Create an index for unique email
// userSchema.index({ email: 1 }, { unique: true });

// Create a model from the schema
const User = model('User', userSchema);

export default User;
