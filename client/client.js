// file: client.js
const io = require('socket.io-client');
const readline = require('readline');

// Replace with your actual server URL
const SOCKET_URL = 'http://localhost:3000'; // wss:// if using TLS

let socket;
let username = '';  // The user's username
let agent = '';     // The agent: "desktop", "phone", or "tablet"

// Command-line interface setup
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// ---------------------------------
//      CONNECT TO SERVER
// ---------------------------------
function connectToServer(_username, _agent) {
  username = _username;
  agent = _agent;

  socket = io(SOCKET_URL, {
    transports: ['websocket'],  // ensure WebSocket transport
    pingInterval: 25000,
    pingTimeout: 20000,
    upgradeTimeout: 10000,
  });

  socket.on('connect', () => {
    console.log(`Connected to server with socket ID: ${socket.id}`);

    // Let the server know we're online with a specific agent + status
    // Defaulting status to "available" here; you can prompt for it too
    socket.emit('user-online', { username, status: 'available' });

    console.log(`User "${username}" with agent="${agent}" is now online.`);
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from server.');
  });

  // Listen for incoming messages
  socket.on('receive-message', (message) => {
    // message contains { senderId, recipientId, content, recipientAgent, ... }
    console.log(`\n[MSG] From=${message.senderId} | Content="${message.content}" | Agent="${message.recipientAgent}"\n`);
    promptUser(); // re-show prompt after message
  });

  // Listen for status change notifications (both global or agent-level)
  socket.on('status-changed', (data) => {
    // data might have { username, agent, status } or { userId, status }
    if (data.agent) {
      console.log(`\n[STATUS] ${data.username}'s agent="${data.agent}" is now "${data.status}"\n`);
    } else {
      console.log(`\n[STATUS] ${data.userId || data.username} is now "${data.status}"\n`);
    }
    promptUser();
  });

  // Handle connection error
  socket.on('connect_error', (error) => {
    console.error(`Connection Error: ${error.message}`);
  });

  socket.on('error', (error) => {
    console.error(`Socket Error: ${error.message}`);
  });
}

// ---------------------------------
//      SEND A MESSAGE
// ---------------------------------
function sendMessage() {
  if (!socket || !socket.connected) {
    console.error('Socket is not connected. Unable to send message.');
    promptUser();
    return;
  }

  rl.question('Recipient username? ', (recipientUsername) => {
    rl.question('Recipient agent? (desktop/phone/tablet) ', (recipientAgent) => {
      rl.question('Message content? ', (content) => {

        // On the server side, you'd have to map "recipientUsername" back to a userId
        // or simply store messages by username. For now, let's assume the server can handle it.
        socket.emit('send-message', {
          // If your server expects Mongo _id’s for sender and recipient, you’d fetch them first.
          // But let's assume it can handle 'senderId' as username or it does the mapping.
          senderId: username, // or actual userId if your server expects IDs
          recipientId: recipientUsername,
          recipientAgent,
          content,
        });

        console.log(`\nSent message from "${username}" to "${recipientUsername}-${recipientAgent}" -> ${content}\n`);
        promptUser();
      });
    });
  });
}

// ---------------------------------
//      CHANGE AGENT STATUS
// ---------------------------------
function changeAgentStatus() {
  if (!socket || !socket.connected) {
    console.error('Socket is not connected. Unable to update status.');
    promptUser();
    return;
  }

  rl.question('Which agent to update? (desktop/phone/tablet) ', (targetAgent) => {
    rl.question('New status? (available/busy/away/etc.) ', (newStatus) => {
      socket.emit('agent-status-update', {
        username,
        agent: targetAgent,
        status: newStatus,
      });
      console.log(`\nAgent-status-update: user="${username}" agent="${targetAgent}" => status="${newStatus}"\n`);
      promptUser();
    });
  });
}

// ---------------------------------
//      BRING USER ONLINE AGAIN
// ---------------------------------
function userOnlineAgain() {
  if (!socket || !socket.connected) {
    console.error('Socket is not connected. Unable to go online.');
    promptUser();
    return;
  }

  // Re-emit user-online to the server if you want to fetch offline messages again
  socket.emit('user-online', { username, status: 'available' });
  console.log(`\nUser "${username}" rejoined => offline messages (if any) will be delivered.\n`);
  promptUser();
}

// ---------------------------------
//      CLI MAIN PROMPT
// ---------------------------------
function promptUser() {
  rl.question(
    '\nChoose an action:\n'
    + '(1) Connect with username & agent\n'
    + '(2) Send Message\n'
    + '(3) Change Agent Status\n'
    + '(4) Go Online (fetch offline msgs)\n'
    + '(5) Exit\n'
    + 'Your choice: ',
    (choice) => {
      switch (choice.trim()) {
        case '1':
          rl.question('Enter username: ', (uName) => {
            rl.question('Enter agent (desktop/phone/tablet): ', (uAgent) => {
              connectToServer(uName, uAgent);
              promptUser();
            });
          });
          break;

        case '2':
          sendMessage();
          break;

        case '3':
          changeAgentStatus();
          break;

        case '4':
          userOnlineAgain();
          break;

        case '5':
          console.log('Exiting...');
          if (socket) {
            socket.close();
          }
          rl.close();
          break;

        default:
          console.log('Invalid option.');
          promptUser();
          break;
      }
    }
  );
}

// Start CLI prompt
promptUser();
