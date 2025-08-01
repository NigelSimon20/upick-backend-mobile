const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const MESSAGES_FILE = path.join(__dirname, 'messages.json');

// Helper to read/write messages
function readMessages() {
  if (!fs.existsSync(MESSAGES_FILE)) return [];
  return JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8'));
}
function writeMessages(messages) {
  fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
}

// Get messages for a user
router.get('/api/messages', (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  const messages = readMessages().filter(m => m.userId === userId);
  res.json(messages);
});

// Post a new message
router.post('/api/messages', (req, res) => {
  const { userId, sender, content } = req.body;
  if (!userId || !sender || !content) return res.status(400).json({ error: 'Missing fields' });
  const messages = readMessages();
  const message = {
    id: Date.now().toString(),
    userId,
    sender, // 'user' or 'upick'
    content,
    timestamp: new Date().toISOString(),
  };
  messages.push(message);
  writeMessages(messages);
  res.json({ success: true, message });
});

module.exports = router; 