// file: routes/userRoutes.js
const express = require('express');
const router = express.Router();

const User = require('../models/user');
const {
  PhoneProfile,
  DesktopProfile,
  TabletProfile
} = require('../models/userProfile');

/**
 * POST /api/users/:username/profile
 * Creates a new profile for the given user, based on `type` in request body.
 */
exports.addUserProfile= async (req,res)=>{
  try {
    const { username } = req.params;
    const {
      type,            // 'phone', 'desktop', or 'tablet'
      country,
      picture,
      department,
      city,
      company,
      description,
      firstName,
      lastName,
      phoneExtension   // only relevant if type === 'phone'
    } = req.body;

    // 1. Find the user
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 2. Check if a profile of this type already exists
    //    If you don't want to allow duplicates, you could block it here.
    let existingProfileId;
    if (type === 'phone') {
      existingProfileId = user.phoneProfile;
    } else if (type === 'desktop') {
      existingProfileId = user.desktopProfile;
    } else if (type === 'tablet') {
      existingProfileId = user.tabletProfile;
    }

    if (existingProfileId) {
      return res.status(400).json({ error: `User already has a ${type} profile. Use PUT to update.` });
    }

    // 3. Create a new profile based on type
    let newProfile;
    if (type === 'phone') {
      newProfile = await PhoneProfile.create({
        type,
        country,
        picture,
        department,
        city,
        company,
        description,
        firstName,
        lastName,
        phoneExtension
      });
      user.phoneProfile = newProfile._id;
    } else if (type === 'desktop') {
      newProfile = await DesktopProfile.create({
        type,
        country,
        picture,
        department,
        city,
        company,
        description,
        firstName,
        lastName
        // no phoneExtension in desktop
      });
      user.desktopProfile = newProfile._id;
    } else if (type === 'tablet') {
      newProfile = await TabletProfile.create({
        type,
        country,
        picture,
        department,
        city,
        company,
        description,
        firstName,
        lastName
      });
      user.tabletProfile = newProfile._id;
    } else {
      return res.status(400).json({ error: 'Invalid type. Must be phone, desktop, or tablet.' });
    }

    // 4. Save changes to the user
    await user.save();

    // 5. Return the newly created profile
    return res.status(201).json({
      message: 'Profile created successfully',
      profile: newProfile
    });
  } catch (error) {
    console.error('Error creating profile:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * PUT /api/users/:username/profile
 * Updates an existing profile for the given user (and type).
 */
exports.updateUserProfile = async (req,res)=>{
  try {
    const { username } = req.params;
    const {
      type,            // 'phone', 'desktop', or 'tablet'
      country,
      picture,
      department,
      city,
      company,
      description,
      firstName,
      lastName,
      phoneExtension   // relevant for phone only
    } = req.body;

    // 1. Find the user
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 2. Determine which existing profile ID to update
    let profileId;
    if (type === 'phone') {
      profileId = user.phoneProfile;
    } else if (type === 'desktop') {
      profileId = user.desktopProfile;
    } else if (type === 'tablet') {
      profileId = user.tabletProfile;
    } else {
      return res.status(400).json({ error: 'Invalid type. Must be phone, desktop, or tablet.' });
    }

    if (!profileId) {
      // If there's no existing profile to update for that type
      return res.status(404).json({ error: `No existing ${type} profile found for user "${username}".` });
    }

    // 3. Update the existing profile
    //    We can do this in one go:
    const Model = (type === 'phone')
      ? PhoneProfile
      : (type === 'desktop') ? DesktopProfile : TabletProfile;

    const updatedProfile = await Model.findByIdAndUpdate(
      profileId,
      {
        country,
        picture,
        department,
        city,
        company,
        description,
        firstName,
        lastName,
        ...(type === 'phone' && { phoneExtension })
      },
      { new: true } // return the updated doc
    );

    if (!updatedProfile) {
      return res.status(404).json({ error: 'Profile not found in DB' });
    }

    return res.status(200).json({
      message: `Profile updated for type="${type}"`,
      profile: updatedProfile
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

