const Item        = require('../models/Item');
const Transaction = require('../models/Transaction');

// POST /api/transactions/checkout  (multipart/form-data)
const checkout = async (req, res) => {
  try {
    const { itemId, assignedToId, notes } = req.body;
    if (!itemId || !assignedToId) {
      return res.status(400).json({ error: 'itemId and assignedToId are required.' });
    }

    const item = await Item.findOne({ _id: itemId, isDeleted: false });
    if (!item) return res.status(404).json({ error: 'Item not found.' });

    // Business Rule: only Available items can be checked out
    if (item.status !== 'Available') {
      return res.status(422).json({
        error: `Item cannot be checked out. Current status: ${item.status}. Only Available items are eligible.`,
      });
    }

    const transaction = await Transaction.create({
      item:         item._id,
      performedBy:  req.user.id,
      assignedTo:   assignedToId,
      type:         'checkout',
      documentPath: req.file ? req.file.filename : null,
      documentOriginalName: req.file ? req.file.originalname : null,
      notes,
    });

    // Update item status and assignment
    item.status     = 'In-Use';
    item.assignedTo = assignedToId;
    await item.save();

    const populated = await transaction.populate([
      { path: 'performedBy', select: 'username' },
      { path: 'assignedTo',  select: 'username email' },
      { path: 'item',        select: 'itemId model brand' },
    ]);

    res.status(201).json({ message: 'Item checked out.', transaction: populated });
  } catch (err) {
    console.error('[transactionController.checkout]', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// POST /api/transactions/checkin  (multipart/form-data)
const checkin = async (req, res) => {
  try {
    const { itemId, notes } = req.body;
    if (!itemId) {
      return res.status(400).json({ error: 'itemId is required.' });
    }

    const item = await Item.findOne({ _id: itemId, isDeleted: false });
    if (!item) return res.status(404).json({ error: 'Item not found.' });

    if (item.status !== 'In-Use') {
      return res.status(422).json({
        error: `Item is not currently checked out. Current status: ${item.status}.`,
      });
    }

    const transaction = await Transaction.create({
      item:         item._id,
      performedBy:  req.user.id,
      assignedTo:   item.assignedTo, // record who returned it
      type:         'checkin',
      documentPath: req.file ? req.file.filename : null,
      documentOriginalName: req.file ? req.file.originalname : null,
      notes,
    });

    // Revert item status
    item.status     = 'Available';
    item.assignedTo = null;
    await item.save();

    const populated = await transaction.populate([
      { path: 'performedBy', select: 'username' },
      { path: 'assignedTo',  select: 'username email' },
      { path: 'item',        select: 'itemId model brand' },
    ]);

    res.status(201).json({ message: 'Item checked in.', transaction: populated });
  } catch (err) {
    console.error('[transactionController.checkin]', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

module.exports = { checkout, checkin };
