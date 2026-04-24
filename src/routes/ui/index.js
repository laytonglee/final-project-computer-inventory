const express  = require('express');
const path     = require('path');
const crypto   = require('crypto');
const bcrypt   = require('bcryptjs');
const router   = express.Router();

const { authenticateUI }  = require('../../middleware/auth');
const { requireRole }     = require('../../middleware/rbac');
const upload              = require('../../middleware/upload');
const { uiLogin, logout } = require('../../controllers/authController');

const User        = require('../../models/User');
const Item        = require('../../models/Item');
const ApiKey      = require('../../models/ApiKey');
const Transaction = require('../../models/Transaction');

// ── Auth ──────────────────────────────────────────────────────────────────────
router.get('/login',  (req, res) => res.render('login', { layout: 'auth', pageTitle: 'Login' }));
router.post('/login', uiLogin);
router.get('/logout', logout);

// Protect all routes below
router.use(authenticateUI);

// ── Dashboard ─────────────────────────────────────────────────────────────────
router.get(['/', '/dashboard'], async (req, res) => {
  try {
    const [total, available, inUse, maintenance, retired, recentTx] = await Promise.all([
      Item.countDocuments({ isDeleted: false }),
      Item.countDocuments({ isDeleted: false, status: 'Available' }),
      Item.countDocuments({ isDeleted: false, status: 'In-Use' }),
      Item.countDocuments({ isDeleted: false, status: 'Maintenance' }),
      Item.countDocuments({ isDeleted: false, status: 'Retired' }),
      Transaction.find()
        .populate('item',       'itemId model brand')
        .populate('performedBy','username')
        .populate('assignedTo', 'username')
        .sort({ createdAt: -1 })
        .limit(8).lean(),
    ]);

    res.render('dashboard', {
      pageTitle: 'Dashboard',
      stats: { total, available, inUse, maintenance, retired },
      recentTx,
    });
  } catch (err) {
    console.error('[UI dashboard]', err);
    req.flash('error', 'Could not load dashboard data.');
    res.render('dashboard', { pageTitle: 'Dashboard', stats: {}, recentTx: [] });
  }
});

// ── Items ─────────────────────────────────────────────────────────────────────
router.get('/items', async (req, res) => {
  try {
    const filter  = { isDeleted: false };
    const { status, category, search } = req.query;
    if (status)   filter.status   = status;
    if (category) filter.category = category;

    let query = Item.find(filter).populate('assignedTo', 'username').lean();
    if (search) {
      const re = new RegExp(search, 'i');
      query = Item.find({ ...filter, $or: [{ itemId: re }, { model: re }, { brand: re }, { serialNumber: re }] })
        .populate('assignedTo', 'username').lean();
    }

    const items = await query.sort({ createdAt: -1 });
    res.render('items/index', {
      pageTitle: 'Inventory',
      items,
      filter: { status, category, search },
      isAdmin: req.user.role === 'Admin',
    });
  } catch (err) {
    console.error('[UI items list]', err);
    req.flash('error', 'Could not load items.');
    res.redirect('/dashboard');
  }
});

router.get('/items/new', (req, res) => {
  res.render('items/form', { pageTitle: 'Add Item', isNew: true });
});

router.post('/items', async (req, res) => {
  try {
    const { serialNumber, model, brand, category, subtype, status, dateAcquired, notes } = req.body;
    await Item.create({ serialNumber, model, brand, category, subtype, status, dateAcquired, notes });
    req.flash('success', 'Item added to inventory.');
    res.redirect('/items');
  } catch (err) {
    req.flash('error', err.message || 'Could not create item.');
    res.redirect('/items/new');
  }
});

router.get('/items/:id/edit', async (req, res) => {
  try {
    const item = await Item.findOne({ _id: req.params.id, isDeleted: false }).lean();
    if (!item) { req.flash('error', 'Item not found.'); return res.redirect('/items'); }
    res.render('items/form', { pageTitle: 'Edit Item', item, isNew: false });
  } catch (err) {
    req.flash('error', 'Item not found.');
    res.redirect('/items');
  }
});

router.post('/items/:id/edit', async (req, res) => {
  try {
    const { serialNumber, model, brand, category, subtype, status, dateAcquired, notes } = req.body;
    const item = await Item.findOne({ _id: req.params.id, isDeleted: false });
    if (!item) { req.flash('error', 'Item not found.'); return res.redirect('/items'); }
    Object.assign(item, { serialNumber, model, brand, category, subtype, status, dateAcquired, notes });
    await item.save();
    req.flash('success', 'Item updated.');
    res.redirect('/items');
  } catch (err) {
    req.flash('error', err.message || 'Could not update item.');
    res.redirect(`/items/${req.params.id}/edit`);
  }
});

router.post('/items/:id/delete', requireRole('Admin'), async (req, res) => {
  try {
    await Item.findByIdAndUpdate(req.params.id, { isDeleted: true });
    req.flash('success', 'Item removed from inventory.');
    res.redirect('/items');
  } catch (err) {
    req.flash('error', 'Could not delete item.');
    res.redirect('/items');
  }
});

router.get('/items/:id/history', async (req, res) => {
  try {
    const item = await Item.findOne({ _id: req.params.id, isDeleted: false })
      .populate('assignedTo', 'username email').lean();
    if (!item) { req.flash('error', 'Item not found.'); return res.redirect('/items'); }

    const history = await Transaction.find({ item: req.params.id })
      .populate('performedBy', 'username')
      .populate('assignedTo',  'username email')
      .sort({ createdAt: -1 }).lean();

    res.render('items/history', {
      pageTitle: `History – ${item.itemId}`,
      item,
      history,
    });
  } catch (err) {
    req.flash('error', 'Could not load item history.');
    res.redirect('/items');
  }
});

// ── Transactions (Checkout / Checkin) ─────────────────────────────────────────
router.get('/transactions', async (req, res) => {
  try {
    const [availableItems, inUseItems, users, recentTx] = await Promise.all([
      Item.find({ isDeleted: false, status: 'Available' }).sort('model').lean(),
      Item.find({ isDeleted: false, status: 'In-Use' })
        .populate('assignedTo', 'username')
        .sort('model').lean(),
      User.find({ isActive: true }).sort('username').lean(),
      Transaction.find()
        .populate('item',        'itemId model brand')
        .populate('performedBy', 'username')
        .populate('assignedTo',  'username email')
        .sort({ createdAt: -1 })
        .limit(20).lean(),
    ]);

    res.render('transactions/index', {
      pageTitle:      'Check In / Out',
      availableItems,
      inUseItems,
      users,
      recentTx,
    });
  } catch (err) {
    console.error('[UI transactions]', err);
    req.flash('error', 'Could not load transaction data.');
    res.redirect('/dashboard');
  }
});

router.post('/transactions/checkout', upload.single('document'), async (req, res) => {
  try {
    const { itemId, assignedToId, notes } = req.body;
    const item = await Item.findOne({ _id: itemId, isDeleted: false, status: 'Available' });
    if (!item) {
      req.flash('error', 'Item is not available for checkout.');
      return res.redirect('/transactions');
    }

    await Transaction.create({
      item:                item._id,
      performedBy:         req.user.id,
      assignedTo:          assignedToId,
      type:                'checkout',
      documentPath:        req.file?.filename || null,
      documentOriginalName: req.file?.originalname || null,
      notes,
    });

    item.status     = 'In-Use';
    item.assignedTo = assignedToId;
    await item.save();

    req.flash('success', `Item ${item.itemId} checked out.`);
    res.redirect('/transactions');
  } catch (err) {
    console.error('[UI checkout]', err);
    req.flash('error', 'Checkout failed. ' + err.message);
    res.redirect('/transactions');
  }
});

router.post('/transactions/checkin', upload.single('document'), async (req, res) => {
  try {
    const { itemId, notes } = req.body;
    const item = await Item.findOne({ _id: itemId, isDeleted: false, status: 'In-Use' });
    if (!item) {
      req.flash('error', 'Item is not currently checked out.');
      return res.redirect('/transactions');
    }

    await Transaction.create({
      item:                item._id,
      performedBy:         req.user.id,
      assignedTo:          item.assignedTo,
      type:                'checkin',
      documentPath:        req.file?.filename || null,
      documentOriginalName: req.file?.originalname || null,
      notes,
    });

    item.status     = 'Available';
    item.assignedTo = null;
    await item.save();

    req.flash('success', `Item ${item.itemId} checked in.`);
    res.redirect('/transactions');
  } catch (err) {
    console.error('[UI checkin]', err);
    req.flash('error', 'Check-in failed. ' + err.message);
    res.redirect('/transactions');
  }
});

// ── Users (Admin only) ────────────────────────────────────────────────────────
router.get('/users', requireRole('Admin'), async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 }).lean();
    res.render('users/index', {
      pageTitle: 'User Management',
      users,
    });
  } catch (err) {
    req.flash('error', 'Could not load users.');
    res.redirect('/dashboard');
  }
});

router.get('/users/new', requireRole('Admin'), (req, res) => {
  res.render('users/form', { pageTitle: 'Create User', isNew: true });
});

router.post('/users', requireRole('Admin'), async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    const exists = await User.findOne({ $or: [{ username }, { email }] });
    if (exists) {
      req.flash('error', 'Username or email already in use.');
      return res.redirect('/users/new');
    }
    const hashed = await bcrypt.hash(password, 12);
    await User.create({ username, email, password: hashed, role });
    req.flash('success', `User "${username}" created.`);
    res.redirect('/users');
  } catch (err) {
    req.flash('error', err.message || 'Could not create user.');
    res.redirect('/users/new');
  }
});

router.post('/users/:id/role', requireRole('Admin'), async (req, res) => {
  try {
    const { role } = req.body;
    await User.findByIdAndUpdate(req.params.id, { role });
    req.flash('success', 'Role updated.');
    res.redirect('/users');
  } catch (err) {
    req.flash('error', 'Could not update role.');
    res.redirect('/users');
  }
});

router.post('/users/:id/status', requireRole('Admin'), async (req, res) => {
  try {
    if (String(req.params.id) === String(req.user.id)) {
      req.flash('error', 'You cannot change your own account status.');
      return res.redirect('/users');
    }
    const isActive = req.body.isActive === 'true';
    await User.findByIdAndUpdate(req.params.id, { isActive });
    if (!isActive) {
      await ApiKey.updateMany({ createdBy: req.params.id }, { isActive: false });
    }
    req.flash('success', `User ${isActive ? 'enabled' : 'disabled'}.`);
    res.redirect('/users');
  } catch (err) {
    req.flash('error', 'Could not update user status.');
    res.redirect('/users');
  }
});

// ── API Keys (Admin only) ─────────────────────────────────────────────────────
router.get('/keys', requireRole('Admin'), async (req, res) => {
  try {
    const keys = await ApiKey.find()
      .populate('createdBy', 'username')
      .sort({ createdAt: -1 }).lean();

    const newKey = req.session.newApiKey || null;
    delete req.session.newApiKey;

    res.render('keys/index', {
      pageTitle: 'API Key Management',
      keys,
      newKey,
    });
  } catch (err) {
    req.flash('error', 'Could not load API keys.');
    res.redirect('/dashboard');
  }
});

router.post('/keys', requireRole('Admin'), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) {
      req.flash('error', 'Key name is required.');
      return res.redirect('/keys');
    }
    const rawKey  = crypto.randomBytes(32).toString('hex');
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const prefix  = rawKey.slice(0, 8);

    await ApiKey.create({ name: name.trim(), keyHash, prefix, createdBy: req.user.id });

    // Store raw key in session so it's shown ONCE on redirect
    req.session.newApiKey = { name: name.trim(), rawKey };
    req.flash('success', 'API key generated. Copy it now — it will not be shown again.');
    res.redirect('/keys');
  } catch (err) {
    req.flash('error', 'Could not generate key.');
    res.redirect('/keys');
  }
});

router.post('/keys/:id/revoke', requireRole('Admin'), async (req, res) => {
  try {
    await ApiKey.findByIdAndDelete(req.params.id);
    req.flash('success', 'API key revoked.');
    res.redirect('/keys');
  } catch (err) {
    req.flash('error', 'Could not revoke key.');
    res.redirect('/keys');
  }
});

// ── Reports ───────────────────────────────────────────────────────────────────
router.get('/reports', async (req, res) => {
  try {
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

    const [statusSummary, agingItems, users] = await Promise.all([
      Item.aggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Item.find({ isDeleted: false, dateAcquired: { $lte: threeYearsAgo } })
        .populate('assignedTo', 'username')
        .sort({ dateAcquired: 1 }).lean(),
      User.find({ isActive: true }).sort('username').lean(),
    ]);

    // User audit (if userId query param provided)
    let userAssets = null;
    let auditUser  = null;
    if (req.query.userId) {
      [userAssets, auditUser] = await Promise.all([
        Item.find({ isDeleted: false, assignedTo: req.query.userId, status: 'In-Use' })
          .populate('assignedTo', 'username email').lean(),
        User.findById(req.query.userId).lean(),
      ]);
    }

    const byStatus = {};
    statusSummary.forEach(s => { byStatus[s._id] = s.count; });
    const totalItems = Object.values(byStatus).reduce((a, b) => a + b, 0);

    res.render('reports/index', {
      pageTitle:   'Reports',
      byStatus,
      totalItems,
      statusAvailable:   byStatus['Available']   || 0,
      statusInUse:       byStatus['In-Use']       || 0,
      statusMaintenance: byStatus['Maintenance']  || 0,
      statusRetired:     byStatus['Retired']      || 0,
      agingItems,
      users,
      userAssets:  userAssets || null,
      auditUser:   auditUser  || null,
      selectedUserId: req.query.userId || '',
    });
  } catch (err) {
    console.error('[UI reports]', err);
    req.flash('error', 'Could not generate reports.');
    res.redirect('/dashboard');
  }
});

// ── Serve uploaded documents (protected) ──────────────────────────────────────
router.get('/uploads/:filename', (req, res) => {
  const safeName = path.basename(req.params.filename); // prevent path traversal
  const filePath = path.join(__dirname, '../../../uploads', safeName);
  res.sendFile(filePath, err => {
    if (err) res.status(404).send('File not found.');
  });
});

module.exports = router;
