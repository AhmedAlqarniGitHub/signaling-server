// file: controllers/contactController.js
const Contact = require('../models/contact');
const User = require('../models/user');

/**
 * Add a new contact request using usernames.
 */
exports.addContact = async (req, res) => {
    const { username, friendUsername } = req.body;

    try {
        // Validate that both usernames are provided
        if (!username || !friendUsername) {
            return res.status(400).json({ error: 'Both username and friendUsername are required.' });
        }

        // Prevent a user from adding themselves
        if (username === friendUsername) {
            return res.status(400).json({ error: 'You cannot add yourself as a contact.' });
        }

        // Find the user and the friend by their usernames
        const user = await User.findOne({ username: username.trim() });
        const friend = await User.findOne({ username: friendUsername.trim() });

        if (!user) {
            return res.status(404).json({ error: `User '${username}' not found.` });
        }

        if (!friend) {
            return res.status(404).json({ error: `Friend '${friendUsername}' not found.` });
        }

        // Check if a contact request already exists in either direction
        const existingContact = await Contact.findOne({
            $or: [
                { userId: user._id, friendId: friend._id },
                { userId: friend._id, friendId: user._id }
            ]
        });

        if (existingContact) {
            if (existingContact.status === 'pending') {
                return res.status(400).json({ error: 'A contact request is already pending.' });
            } else if (existingContact.status === 'accepted') {
                return res.status(400).json({ error: 'You are already contacts.' });
            }
        }

        // Create a new contact request
        const contact = new Contact({ userId: user._id, friendId: friend._id, status: 'pending' });
        await contact.save();
        res.status(201).json({
            message: 'Contact request sent.',
            contact: {
                userId: username,
                friendId: friendUsername,
                status: 'pending'
            }
        });
    } catch (error) {
        console.error('Error adding contact:', error);
        res.status(500).json({ error: 'Error adding contact.' });
    }
};
/**
 * Remove an existing contact using usernames.
 */
exports.removeContact = async (req, res) => {
    const { username, friendUsername } = req.body;

    try {
        // Validate that both usernames are provided
        if (!username || !friendUsername) {
            return res.status(400).json({ error: 'Both username and friendUsername are required.' });
        }

        // Find the user and the friend by their usernames
        const user = await User.findOne({ username: username.trim() });
        const friend = await User.findOne({ username: friendUsername.trim() });

        if (!user) {
            return res.status(404).json({ error: `User '${username}' not found.` });
        }

        if (!friend) {
            return res.status(404).json({ error: `Friend '${friendUsername}' not found.` });
        }

        // Attempt to delete the contact in either direction
        const contact = await Contact.findOneAndDelete({
            $or: [
                { userId: user._id, friendId: friend._id },
                { userId: friend._id, friendId: user._id }
            ]
        });

        if (!contact) {
            return res.status(404).json({ error: 'Contact not found.' });
        }

        res.status(200).json({ message: 'Contact removed successfully.' });
    } catch (error) {
        console.error('Error removing contact:', error);
        res.status(500).json({ error: 'Error removing contact.' });
    }
};

/**
 * Accept a contact request using usernames.
 */
exports.acceptContact = async (req, res) => {
    const { username, friendUsername } = req.body;

    try {
        // Validate that both usernames are provided
        if (!username || !friendUsername) {
            return res.status(400).json({ error: 'Both username and friendUsername are required.' });
        }

        // Find the user and the friend by their usernames
        const user = await User.findOne({ username: username.trim() });
        const friend = await User.findOne({ username: friendUsername.trim() });

        if (!user) {
            return res.status(404).json({ error: `User '${username}' not found.` });
        }

        if (!friend) {
            return res.status(404).json({ error: `Friend '${friendUsername}' not found.` });
        }

        // Find the pending contact request where friend has requested to be user's contact
        const contact = await Contact.findOne({
            userId: friend._id,
            friendId: user._id,
            status: 'pending'
        });

        if (!contact) {
            return res.status(404).json({ error: 'No pending contact request found.' });
        }

        // Update the status to 'accepted'
        contact.status = 'accepted';
        await contact.save();

        res.status(200).json({
            message: 'Contact request accepted.',
            contact: {
                userId: username,
                friendId: friendUsername,
                status: 'accepted'
            }
        });
    } catch (error) {
        console.error('Error accepting contact:', error);
        res.status(500).json({ error: 'Error accepting contact request.' });
    }
};
