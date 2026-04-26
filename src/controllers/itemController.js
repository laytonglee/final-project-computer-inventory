const Item        = require('../models/Item');
const Transaction = require('../models/Transaction');

// GET /api/items
const listItems = async (req, res) => {
  try {
    const filter = { isDeleted: false };

    // Optional query filters
    if (req.query.status)   filter.status   = req.query.status;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.subtype)  filter.subtype  = req.query.subtype;

    const items = await Item.find(filter)
      .populate('assignedTo', 'username email')
      .sort({ createdAt: -1 });

    res.json({ count: items.length, items });
  } catch (err) {
    console.error('[itemController.listItems]', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// GET /api/items/:id
const getItem = async (req, res) => {
  try {
    const item = await Item.findOne({ _id: req.params.id, isDeleted: false })
      .populate('assignedTo', 'username email');
    if (!item) return res.status(404).json({ error: 'Item not found.' });
    res.json({ item });
  } catch (err) {
    console.error('[itemController.getItem]', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// POST /api/items
const createItem = async (req, res) => {
  try {
    const { serialNumber, model, brand, category, subtype, status, dateAcquired, notes } = req.body;
    if (!model || !brand || !category || !subtype || !dateAcquired) {
      return res.status(400).json({ error: 'model, brand, category, subtype, and dateAcquired are required.' });
    }

    const item = await Item.create({ serialNumber, model, brand, category, subtype, status, dateAcquired, notes });
    res.status(201).json({ message: 'Item created.', item });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error('[itemController.createItem]', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// PUT /api/items/:id
const updateItem = async (req, res) => {
  try {
    const { serialNumber, model, brand, category, subtype, status, dateAcquired, notes } = req.body;
    const item = await Item.findOne({ _id: req.params.id, isDeleted: false });
    if (!item) return res.status(404).json({ error: 'Item not found.' });

    // Prevent checking out maintenance/retired items via status update — enforce via transactions
    Object.assign(item, { serialNumber, model, brand, category, subtype, status, dateAcquired, notes });
    await item.save();

    res.json({ message: 'Item updated.', item });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error('[itemController.updateItem]', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// DELETE /api/items/:id  (soft delete — Admin only)
const deleteItem = async (req, res) => {
  try {
    const item = await Item.findOne({ _id: req.params.id, isDeleted: false });
    if (!item) return res.status(404).json({ error: 'Item not found.' });

    item.isDeleted = true;
    await item.save();

    res.json({ message: 'Item removed (soft deleted).' });
  } catch (err) {
    console.error('[itemController.deleteItem]', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// GET /api/items/:id/history
const getItemHistory = async (req, res) => {
  try {
    const item = await Item.findOne({ _id: req.params.id, isDeleted: false })
      .populate('assignedTo', 'username email');
    if (!item) return res.status(404).json({ error: 'Item not found.' });

    const history = await Transaction.find({ item: req.params.id })
      .populate('performedBy', 'username')
      .populate('assignedTo',  'username email')
      .sort({ createdAt: -1 });

    res.json({ item, history });
  } catch (err) {
    console.error('[itemController.getItemHistory]', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

module.exports = { listItems, getItem, createItem, updateItem, deleteItem, getItemHistory };
