const User = require('../models/user');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

exports.signup = async (req, res) => {
    const {
        username,
        email,
        password,
        phone,
        country,
        phoneExtension,
        picture,
        department,
        city,
        company,
        descruption,
        firstName,
        lastName
    } = req.body;

    try {
        const user = new User({
            username,
            email,
            password,
            phone,
            country,
            phoneExtension,
            picture,
            department,
            city,
            company,
            descruption,
            firstName,
            lastName
        });

        await user.save();
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Error creating user', details: error.message });
    }
};

exports.login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ token, userId: user._id });
    } catch (error) {
        res.status(500).json({ error: 'Error logging in' });
    }
};
