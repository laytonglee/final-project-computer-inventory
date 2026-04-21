const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true,
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  type: {
    type: String,
    enum: ['checkout', 'checkin'],
    required: true,
  },
  documentPath:         { type: String },
  documentOriginalName: { type: String },
  notes:                { type: String, trim: true },
}, { timestamps: true });

module.exports = mongoose.model('Transaction', TransactionSchema);
