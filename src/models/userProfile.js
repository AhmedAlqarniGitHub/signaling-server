// file: models/userProfile.js
const mongoose = require('mongoose');

const baseProfileOptions = {
  timestamps: true,
  discriminatorKey: 'type',
};

// Base schema shared by all profile types:
const userProfileSchema = new mongoose.Schema({
  country: { type: String },
  picture: { type: String },      // Base64 encoded or URL
  department: { type: String },
  city: { type: String },
  company: { type: String },
  description: { type: String, maxlength: 1000 },
  firstName: { type: String },
  lastName: { type: String },
  type: {
    type: String,
    required: true,
    enum: ['phone', 'desktop', 'tablet'],
  },
}, baseProfileOptions);

// The base model:
const BaseUserProfile = mongoose.model('UserProfile', userProfileSchema);

// -----------------------------
//  Phone Sub-Schema
// -----------------------------
const phoneProfileSchema = new mongoose.Schema({
  phoneExtension: { type: Number },
});

const PhoneProfile = BaseUserProfile.discriminator('phone', phoneProfileSchema);

// -----------------------------
//  Desktop Sub-Schema
// -----------------------------
const desktopProfileSchema = new mongoose.Schema({});
const DesktopProfile = BaseUserProfile.discriminator('desktop', desktopProfileSchema);

// -----------------------------
//  Tablet Sub-Schema
// -----------------------------
const tabletProfileSchema = new mongoose.Schema({});
const TabletProfile = BaseUserProfile.discriminator('tablet', tabletProfileSchema);

module.exports = {
  // The base model is often used if you need to query across all subtypes.
  UserProfile: BaseUserProfile,

  // If you need to create or query specifically phone profiles, import this:
  PhoneProfile,
  DesktopProfile,
  TabletProfile,
};
