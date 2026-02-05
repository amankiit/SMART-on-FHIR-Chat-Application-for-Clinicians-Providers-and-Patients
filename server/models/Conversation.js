const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema(
  {
    patientId: { type: String, required: true, index: true },
    patientName: { type: String, required: true },
    providerId: { type: String, required: true, index: true },
    providerName: { type: String, required: true },
    joinCode: { type: String, required: true, unique: true }
  },
  { timestamps: true }
);

ConversationSchema.index({ patientId: 1, providerId: 1 }, { unique: true });

module.exports = mongoose.model('Conversation', ConversationSchema);
