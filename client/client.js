'use strict';

const io = require('socket.io-client');
const readline = require('readline');

// Update to your server endpoint
const SOCKET_URL = 'http://localhost:3000';

let socket;
let username = '';
let platform = ''; // 'phone', 'desktop', or 'tablet'

// Create a CLI interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// ------------------------------------------------------------
//  STEP 1: ASK FOR USERNAME & PLATFORM, THEN CONNECT
// ------------------------------------------------------------
function askUserInfo() {
  rl.question('Enter username: ', (uName) => {
    username = uName.trim();
    if (!username) {
      console.log('Username cannot be empty.');
      return askUserInfo();
    }
    console.log('\nSelect your platform:');
    console.log('(1) phone');
    console.log('(2) desktop');
    console.log('(3) tablet');
    rl.question('Your choice: ', (choice) => {
      switch (choice.trim()) {
        case '1':
          platform = 'phone';
          break;
        case '2':
          platform = 'desktop';
          break;
        case '3':
          platform = 'tablet';
          break;
        default:
          console.log('Invalid choice. Defaulting to "phone".');
          platform = 'phone';
          break;
      }
      // Now we have username + platform, connect to the server
      connectToServer(username, platform);
    });
  });
}

// ------------------------------------------------------------
//  STEP 2: CONNECT TO SERVER & EMIT "platform-status-update"
// ------------------------------------------------------------
function connectToServer(username, platform) {
  socket = io(SOCKET_URL, {
    transports: ['websocket'],
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => {
    console.log(`\nConnected to server with socket ID: ${socket.id}`);

    // Immediately tell the server our current platform and status
    socket.emit('platform-status-update', {
      username,
      platform,
      status: 'online',
    });

    console.log(`\n[INFO] platform-status-update => username="${username}" platform="${platform}" status="online".`);
    showMainMenu();
  });

  socket.on('disconnect', () => {
    console.log('[INFO] Disconnected from server.');
  });

  // ------------------------------------------------------------
  //  Handle incoming messages
  // ------------------------------------------------------------
  socket.on('receive-message', (message) => {
    // message object => { senderId, recipientId, content, recipientAgent, ... }
    const { senderId, content } = message;
    console.log('\n=================================================');
    console.log(`[MSG RECEIVED]: From "${senderId}" -> "${content}"`);
    console.log('=================================================');
    showMainMenu();
  });

  // ------------------------------------------------------------
  //  Handle status changes (server might broadcast "status-changed")
  // ------------------------------------------------------------
  socket.on('status-changed', (data) => {
    // data => { username, platform, status }
    console.log(`\n[STATUS] user="${data.username}", platform="${data.platform}" => "${data.status}"`);
    showMainMenu();
  });

  // ------------------------------------------------------------
  //  Handle meeting updates (server might broadcast "in-meeting-updated")
  // ------------------------------------------------------------
  socket.on('in-meeting-updated', (data) => {
    // data => { username, platform, isInMeeting }
    console.log(`\n[INFO] in-meeting-updated => user="${data.username}", platform="${data.platform}", isInMeeting=${data.isInMeeting}`);
    showMainMenu();
  });

  // Handle errors
  socket.on('connect_error', (err) => {
    console.error('[ERROR] Connection error:', err.message);
  });
  socket.on('error', (err) => {
    console.error('[ERROR] Socket error:', err.message);
  });
}

// ------------------------------------------------------------
//  STEP 3: SHOW CLI MENU (send message, change status, in-meeting, exit)
// ------------------------------------------------------------
function showMainMenu() {
  console.log('\n======== MAIN MENU ========');
  console.log('(1) Send Message');
  console.log('(2) Change My Status');
  console.log('(3) Toggle My "inMeeting" Status');
  console.log('(4) Exit');
  rl.question('Your choice: ', (choice) => {
    switch (choice.trim()) {
      case '1':
        sendMessage();
        break;
      case '2':
        changePlatformStatus();
        break;
      case '3':
        updateInMeetingStatus();
        break;
      case '4':
        console.log('Exiting...');
        if (socket) socket.close();
        rl.close();
        break;
      default:
        console.log('Invalid choice. Try again.');
        showMainMenu();
        break;
    }
  });
}

// -------------------------------------------
//        SEND MESSAGE
// -------------------------------------------
function sendMessage() {
  if (!socket || !socket.connected) {
    console.log('[ERROR] Socket not connected.');
    return showMainMenu();
  }
  // Ask for recipient username
  rl.question('Recipient username? ', (recipientUsername) => {
    if (!recipientUsername.trim()) {
      console.log('Recipient username cannot be empty.');
      return showMainMenu();
    }

    // Let user pick the recipient’s platform numerically
    console.log('\nSelect recipient platform:');
    console.log('(1) phone');
    console.log('(2) desktop');
    console.log('(3) tablet');
    rl.question('Your choice: ', (pChoice) => {
      let recipientAgent = 'phone';
      switch (pChoice.trim()) {
        case '1':
          recipientAgent = 'phone';
          break;
        case '2':
          recipientAgent = 'desktop';
          break;
        case '3':
          recipientAgent = 'tablet';
          break;
        default:
          console.log('Invalid choice. Defaulting to "phone".');
          recipientAgent = 'phone';
          break;
      }

      // Finally, ask for message content
      rl.question('Message content? ', (content) => {
        const payload = {
          senderId: username,
          recipientId: recipientUsername.trim(),
          recipientAgent,
          content: content.trim(),
        };
        socket.emit('send-message', payload);
        console.log(`\n[INFO] Sent message =>`, payload);
        showMainMenu();
      });
    });
  });
}

// -------------------------------------------
//        CHANGE MY PLATFORM STATUS
// -------------------------------------------
function changePlatformStatus() {
  if (!socket || !socket.connected) {
    console.log('[ERROR] Socket not connected.');
    return showMainMenu();
  }

  rl.question('New status? (online/offline/busy/away) ', (newStatus) => {
    const finalStatus = newStatus.trim() || 'online';
    socket.emit('platform-status-update', {
      username,
      platform,
      status: finalStatus,
    });
    console.log(`\n[INFO] platform-status-update => user="${username}" platform="${platform}" status="${finalStatus}"`);
    showMainMenu();
  });
}

// -------------------------------------------
//        TOGGLE "inMeeting" FOR SELECTED PLATFORM
// -------------------------------------------
function updateInMeetingStatus() {
  if (!socket || !socket.connected) {
    console.log('[ERROR] Socket not connected.');
    return showMainMenu();
  }

  console.log('\nSelect a platform to update in-meeting status:');
  console.log('(1) phone');
  console.log('(2) desktop');
  console.log('(3) tablet');
  rl.question('Your choice: ', (pChoice) => {
    let targetPlatform = 'phone';
    switch (pChoice.trim()) {
      case '1':
        targetPlatform = 'phone';
        break;
      case '2':
        targetPlatform = 'desktop';
        break;
      case '3':
        targetPlatform = 'tablet';
        break;
      default:
        console.log('Invalid choice. Defaulting to "phone".');
        targetPlatform = 'phone';
        break;
    }

    rl.question('Are you in a meeting? (yes/no) ', (answer) => {
      const isInMeeting = (answer.trim().toLowerCase() === 'yes');
      // Emit the new "in-meeting-update" event
      socket.emit('in-meeting-update', {
        username,
        platform: targetPlatform,
        isInMeeting
      });

      console.log(`\n[INFO] in-meeting-update => user="${username}" platform="${targetPlatform}" isInMeeting="${isInMeeting}"`);
      showMainMenu();
    });
  });
}

// Start the process
askUserInfo();
