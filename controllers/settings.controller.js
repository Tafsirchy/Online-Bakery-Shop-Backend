const GlobalSettings = require('../models/GlobalSettings');
const connectDB = require('../config/db');

// Get global settings
exports.getSettings = async (req, res) => {
  try {
    await connectDB();
    let settings = await GlobalSettings.findOne();
    
    if (!settings) {
      settings = await GlobalSettings.create({ showOfferSlider: false, offers: [] });
    }

    res.status(200).json({
      success: true,
      data: settings
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// Update global settings
exports.updateSettings = async (req, res) => {
  try {
    await connectDB();
    let settings = await GlobalSettings.findOne();
    
    if (!settings) {
      settings = await GlobalSettings.create(req.body);
    } else {
      settings = await GlobalSettings.findByIdAndUpdate(settings._id, req.body, {
        new: true,
        runValidators: true
      });
    }

    res.status(200).json({
      success: true,
      data: settings
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};
