const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    vcard: {
        firstName: String,
        lastName: String,
        bio: String,
        avatar: String
    },
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    socketId: { type: String, default: null },
});

module.exports = mongoose.model('User', userSchema);
