// file: models/user.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String },
  country: { type: String },
  phoneExtension: { type: String },
  picture: { type: String }, // Base64 encoded
  department: { type: String },
  city: { type: String },
  company: { type: String },
  descruption: { type: String, maxlength: 1000 },
  firstName: { type: String },
  lastName: { type: String },
  socketId: { type: String, default: null },
  isDesktopEnabled: { type: Boolean, default: false },
  isPhoneEnabled: { type: Boolean, default: false },
  isTabletEnabled: { type: Boolean, default: false },
});

module.exports = mongoose.model('User', userSchema);
