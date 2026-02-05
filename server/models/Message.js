const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema(
  {
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    patientId: { type: String, required: true, index: true },
    providerId: { type: String, required: true, index: true },
    senderType: { type: String, enum: ['provider', 'patient'], required: true },
    senderName: { type: String, required: true },
    text: { type: String, required: true, maxlength: 2000 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Message', MessageSchema);
