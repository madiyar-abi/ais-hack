const express = require('express');
const app = express();

// This middleware is CRUCIAL: It automatically parses the incoming JSON data
app.use(express.json());

// This is the endpoint your bot will send data to
app.post('/api/whatsapp-webhook', (req, res) => {

    // 1. Parse the message out of the request body
    const incomingData = req.body;

    console.log('Received a message from:', incomingData.groupName);
    console.log('Message text:', incomingData.text);

    // 2. THIS IS WHERE YOU SAVE TO THE DATABASE
    // Example: Database.save({ group: incomingData.groupName, message: incomingData.text })

    // 3. Always send a success response back to the bot, or the bot will think it failed!
    res.status(200).send({ status: 'success', message: 'Data received and saved' });
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Website backend is running on http://localhost:${PORT}`);
});