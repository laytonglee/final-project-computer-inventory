const mongoose = require('mongoose');

const ApiKeySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Key name is required'],
    trim: true,
    maxlength: [100, 'Key name cannot exceed 100 characters'],
  },
  keyHash: {
    type: String,
    required: true,
    select: false,   // never returned in queries by default
  },
  prefix: {
    type: String,    // first 8 chars of the raw key (for display/identification)
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

module.exports = mongoose.model('ApiKey', ApiKeySchema);
