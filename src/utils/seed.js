/**
 * Seed Script — creates the initial Admin user and sample data.
 * Run with: npm run seed
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const User = require('../models/User');
const Item = require('../models/Item');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('[SEED] Connected to MongoDB');

  // ── Admin user ──────────────────────────────────────────────────────────────
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminEmail    = process.env.ADMIN_EMAIL    || 'admin@company.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123!';

  const existing = await User.findOne({ username: adminUsername });
  if (!existing) {
    const hashed = await bcrypt.hash(adminPassword, 12);
    await User.create({ username: adminUsername, email: adminEmail, password: hashed, role: 'Admin' });
    console.log(`[SEED] Admin user created → username: ${adminUsername} | password: ${adminPassword}`);
  } else {
    console.log(`[SEED] Admin user already exists (${adminUsername})`);
  }

  // ── Technician user ─────────────────────────────────────────────────────────
  const techExists = await User.findOne({ username: 'tech1' });
  if (!techExists) {
    const hashed = await bcrypt.hash('Tech@1234!', 12);
    await User.create({ username: 'tech1', email: 'tech1@company.com', password: hashed, role: 'Technician' });
    console.log('[SEED] Technician user created → username: tech1 | password: Tech@1234!');
  }

  // ── Sample inventory items ──────────────────────────────────────────────────
  const itemCount = await Item.countDocuments();
  if (itemCount === 0) {
    await Item.create([
      { model: 'Latitude 5540',   brand: 'Dell',    category: 'Computer',   subtype: 'Laptop',   status: 'Available',   dateAcquired: new Date('2023-03-15') },
      { model: 'EliteBook 840',   brand: 'HP',      category: 'Computer',   subtype: 'Laptop',   status: 'Available',   dateAcquired: new Date('2022-06-01') },
      { model: 'OptiPlex 7090',   brand: 'Dell',    category: 'Computer',   subtype: 'Desktop',  status: 'Available',   dateAcquired: new Date('2021-01-10') },
      { model: 'PowerEdge R740',  brand: 'Dell',    category: 'Computer',   subtype: 'Server',   status: 'In-Use',      dateAcquired: new Date('2020-05-20') },
      { model: 'U2722D UltraSharp', brand: 'Dell',  category: 'Peripheral', subtype: 'Monitor',  status: 'Available',   dateAcquired: new Date('2021-08-12') },
      { model: 'MX Keys S',         brand: 'Logitech', category: 'Peripheral', subtype: 'Keyboard', status: 'Available', dateAcquired: new Date('2022-11-05') },
      { model: 'MX Master 3S',      brand: 'Logitech', category: 'Peripheral', subtype: 'Mouse',    status: 'In-Use',   dateAcquired: new Date('2020-02-28') },
      { model: 'ThinkPad X1 Carbon', brand: 'Lenovo', category: 'Computer',   subtype: 'Laptop',   status: 'Maintenance', dateAcquired: new Date('2019-07-14') },
    ]);
    console.log('[SEED] Sample items created.');
  } else {
    console.log(`[SEED] Items already exist (${itemCount} found), skipping.`);
  }

  console.log('[SEED] Done.');
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('[SEED] Error:', err.message);
  process.exit(1);
});
