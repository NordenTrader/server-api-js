const IONPlatform = require('../index');

const shortid = require('shortid');
shortid.characters('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$@');

// Minimal configuration parameters
const url = 'example.host:8080'; // Host and port for the ION platform
const name = 'ion-example'; // Platform name
const token = 'YOUR_TOKEN'; // Authentication token

// Initialize the IONPlatform with minimal parameters
const platform = new IONPlatform(url, name, {}, null, null, token);

// For example, we use setTimeout, but in real-case use event 'connect'
// Wait for connection to be established
setTimeout(async () => {
    if (!platform.connected) {
        console.error('Not connected yet. Try again later.');
        return;
    }

    const data = {
        "group": "TestGroup",
        "name": "John Test",
        "password": "securepass123",
        "leverage": 100,
        "enable": 1,
        "email": "john_test@example.com",
        "country": "USA",
        "city": "New York",
        "address": "123 Main Street",
        "phone": "+1234567890",
        "comment": "Premium user"
    };

    try {
        // Send AddUser command using dynamic method
        const response = await platform.AddUser(data);
        console.log('Received response for AddUser:', response);
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        // Close connection
        platform.destroy();
    }

    console.log('AddUser command sent. Waiting for response...');
}, 2000);