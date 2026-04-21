const mongoose = require('mongoose');

const SUBTYPE_PREFIX = {
  Laptop:   'LAP',
  Desktop:  'DSK',
  Server:   'SRV',
  Monitor:  'MON',
  Keyboard: 'KBD',
  Mouse:    'MOU',
  Printer:  'PRN',
  Other:    'OTH',
};

const ItemSchema = new mongoose.Schema({
  itemId: {
    type: String,
    unique: true,
    trim: true,
  },
  serialNumber: {
    type: String,
    trim: true,
  },
  model: {
    type: String,
    required: [true, 'Model is required'],
    trim: true,
  },
  brand: {
    type: String,
    required: [true, 'Brand is required'],
    trim: true,
  },
  category: {
    type: String,
    enum: ['Computer', 'Peripheral'],
    required: [true, 'Category is required'],
  },
  subtype: {
    type: String,
    enum: ['Laptop', 'Desktop', 'Server', 'Monitor', 'Keyboard', 'Mouse', 'Printer', 'Other'],
    required: [true, 'Subtype is required'],
  },
  status: {
    type: String,
    enum: ['Available', 'In-Use', 'Maintenance', 'Retired'],
    default: 'Available',
  },
  dateAcquired: {
    type: Date,
    required: [true, 'Date acquired is required'],
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  notes: {
    type: String,
    trim: true,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

// Auto-generate itemId before first save
ItemSchema.pre('save', async function (next) {
  if (this.itemId) return next();
  try {
    const Counter = require('./Counter');
    const prefix = SUBTYPE_PREFIX[this.subtype] || 'ITM';
    const seq = await Counter.nextSeq(prefix);
    this.itemId = `${prefix}-${String(seq).padStart(4, '0')}`;
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model('Item', ItemSchema);
