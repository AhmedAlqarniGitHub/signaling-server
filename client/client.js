const io = require('socket.io-client');
const readline = require('readline');

// Replace with the actual URL of your server
const SOCKET_URL = 'http://localhost:3000';  // Or use wss:// if TLS is enabled

let socket;
let userId = '';  // Stores the user's ID for connecting and sending messages

// Command-line interface setup
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

// Function to handle connection to the server
function connectToServer(id) {
    userId = id;
    socket = io(SOCKET_URL, {
        transports: ['websocket'],  // Ensure WebSocket is used as the transport
        pingInterval: 25000,
        pingTimeout: 20000,
        upgradeTimeout: 10000,
    });

    socket.on('connect', () => {
        console.log(`Connected to server with socket ID: ${socket.id}`);
        // Inform server that the user is online
        socket.emit('status-update', { userId, status: 'online' });
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server.');
    });

    // Listen for incoming messages
    socket.on('receive-message', (message) => {
        console.log(`New message received from ${message.senderId}: ${message.content}`);
    });

    // Listen for status change notifications
    socket.on('status-changed', (data) => {
        console.log(`User ${data.userId} is now ${data.status}`);
    });

    // Handle connection error
    socket.on('connect_error', (error) => {
        console.error(`Connection Error: ${error.message}`);
    });

    socket.on('error', (error) => {
        console.error(`Socket Error: ${error.message}`);
    });
}

// Function to send a message
function sendMessage(senderId, recipientId, content) {
    socket.emit('send-message', {
        senderId,
        recipientId,
        content,
    });
    console.log(`Message sent from ${senderId} to ${recipientId}: ${content}`);
}

// Function to simulate user coming back online to receive offline messages
function userOnline(userId) {
    socket.emit('user-online', userId);
    console.log(`User ${userId} is back online and requesting offline messages.`);
}

// Command-line prompt for actions
function promptUser() {
    rl.question('Choose an action: (1) Connect (2) Send Message (3) Go Online (4) Exit\n', (choice) => {
        switch (choice.trim()) {
            case '1':
                rl.question('Enter your user ID: ', (id) => {
                    connectToServer(id);
                    promptUser();
                });
                break;
            case '2':
                rl.question('Enter sender ID: ', (senderId) => {
                    rl.question('Enter recipient ID: ', (recipientId) => {
                        rl.question('Enter message content: ', (content) => {
                            sendMessage(senderId, recipientId, content);
                            promptUser();
                        });
                    });
                });
                break;
            case '3':
                rl.question('Enter your user ID to go online: ', (id) => {
                    userOnline(id);
                    promptUser();
                });
                break;
            case '4':
                console.log('Exiting...');
                socket.close();
                rl.close();
                break;
            default:
                console.log('Invalid option.');
                promptUser();
                break;
        }
    });
}

// Start the prompt
promptUser();
