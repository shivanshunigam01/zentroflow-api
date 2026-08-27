import mongoose from 'mongoose';

/** Tracks Smartflo bulk lead upload runs and per-batch results. */
const batchResultSchema = new mongoose.Schema({
  batch_index: { type: Number, required: true },
  batch_id: { type: String, default: null },
  status: { type: String, enum: ['success', 'failed', 'processing'], required: true },
  uploaded_count: { type: Number, default: 0 },
  failed_count: { type: Number, default: 0 },
  lead_count: { type: Number, default: 0 },
  smartflo_response: { type: mongoose.Schema.Types.Mixed },
  batch_status_response: { type: mongoose.Schema.Types.Mixed },
  error: { type: String },
}, { _id: false });

const smartfloSyncLogSchema = new mongoose.Schema({
  sync_id: { type: String, required: true, unique: true, index: true },
  sync_type: {
    type: String,
    enum: ['legacy', 'dialer_all', 'dialer_selected', 'dialer_retry'],
    default: 'dialer_all',
  },
  status: { type: String, enum: ['running', 'completed', 'partial', 'processing'], default: 'running' },
  total_leads: { type: Number, default: 0 },
  eligible: { type: Number, default: 0 },
  uploaded: { type: Number, default: 0 },
  failed: { type: Number, default: 0 },
  skipped: { type: Number, default: 0 },
  already_synced: { type: Number, default: 0 },
  invalid: { type: Number, default: 0 },
  batch_results: [batchResultSchema],
  created_by: { type: String, default: 'System' },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

export default mongoose.model('SmartfloSyncLog', smartfloSyncLogSchema);
