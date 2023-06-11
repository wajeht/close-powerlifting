import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name: { type: String, require: true },
  password: { type: String, require: false },
  email: { type: String, unique: true, require: true },
  api_call_count: { type: Number, require: false },
  key: { type: String, require: false },
  admin: { type: Boolean, default: false },
  deleted: { type: Boolean, require: true, default: false },
  verification_token: { type: String, unique: true, require: false },
  verified: { type: Boolean, require: true, default: false },
  verified_at: { type: Date, require: false, default: '' },
  created_at: { type: String, require: false, default: new Date().toISOString() },
});

export const User = mongoose.model('users', UserSchema);
