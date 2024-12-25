const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String, required: false },
    country: { type: String, required: false },
    phoneExtension: { type: String, required: false },
    picture: { type: String, required: false }, // Base64 encoded picture
    department: { type: String, required: false },
    city: { type: String, required: false },
    company: { type: String, required: false },
    descruption: { type: String, required: false, maxlength: 1000 },
    firstName: { type: String, required: false },
    lastName: { type: String, required: false },
    socketId: { type: String, default: null },
});

module.exports = mongoose.model('User', userSchema);


