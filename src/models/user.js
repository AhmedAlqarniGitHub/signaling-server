// file: models/user.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // Basic user info
  username: { type: String, required: true, unique: true },
  email:    { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String },
  isDesktopEnabled: { type: Boolean, default: false },
  isPhoneEnabled:   { type: Boolean, default: false },
  isTabletEnabled:  { type: Boolean, default: false },
  phoneProfile: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserProfile',
    default: null
  },
  desktopProfile: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserProfile',
    default: null
  },
  tabletProfile: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserProfile',
    default: null
  },
  socketId: { type: String, default: null },
}, {
  timestamps: true  // optional
});

module.exports = mongoose.model('User', userSchema);
