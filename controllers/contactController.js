const Contact = require('../models/contact');

exports.addContact = async (req, res) => {
    const { userId, friendId } = req.body;
    try {
        const contact = new Contact({ userId, friendId, status: 'pending' });
        await contact.save();
        res.status(201).json(contact);
    } catch (error) {
        res.status(500).json({ error: 'Error adding contact' });
    }
};

exports.removeContact = async (req, res) => {
    const { userId, friendId } = req.body;
    try {
        await Contact.deleteOne({ userId, friendId });
        res.status(200).json({ message: 'Contact removed' });
    } catch (error) {
        res.status(500).json({ error: 'Error removing contact' });
    }
};
