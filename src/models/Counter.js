const mongoose = require('mongoose');

const CounterSchema = new mongoose.Schema({
  prefix: { type: String, required: true, unique: true },
  seq:    { type: Number, default: 0 },
});

CounterSchema.statics.nextSeq = async function (prefix) {
  const doc = await this.findOneAndUpdate(
    { prefix },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return doc.seq;
};

module.exports = mongoose.model('Counter', CounterSchema);
