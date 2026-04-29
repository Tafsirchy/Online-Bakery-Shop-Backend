const Coupon = require('../models/Coupon');
const GlobalSettings = require('../models/GlobalSettings');

// Get all coupons
exports.getCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find();
    res.status(200).json({ success: true, data: coupons });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// Get active coupons
exports.getPublicCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find({
      isActive: true,
      expiryDate: { $gt: new Date() },
    }).sort('-createdAt');

    res.status(200).json({ success: true, data: coupons });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// Create coupon
exports.createCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.create(req.body);
    res.status(201).json({ success: true, data: coupon });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// Validate coupon
exports.validateCoupon = async (req, res) => {
  try {
    const { code, totalAmount } = req.body;
    const cleanCode = String(code || '').trim();
    if (!cleanCode) {
      return res.status(400).json({ success: false, message: 'Please provide a coupon code' });
    }

    const escapedCode = cleanCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const codeRegex = new RegExp(`^${escapedCode}$`, 'i');

    // 1. Check primary Coupon collection
    let appliedDiscount = 0;
    let requiredMinPurchase = 0;
    let isExpired = false;

    const coupon = await Coupon.findOne({ 
      code: { $regex: codeRegex }, 
      isActive: true 
    });

    if (coupon) {
      appliedDiscount = coupon.discount;
      requiredMinPurchase = coupon.minPurchase;
      isExpired = new Date() > coupon.expiryDate;
    } else {
      // 2. Check GlobalSettings Offers
      const settings = await GlobalSettings.findOne();
      const offer = settings?.offers?.find(o => 
        o.isActive && o.couponCode && codeRegex.test(o.couponCode)
      );

      if (offer) {
        appliedDiscount = offer.discount || 0;
        requiredMinPurchase = offer.minPurchase || 0;
        // Offers don't have explicit expiry in this schema yet, assuming active = valid
        isExpired = false; 
      } else {
        return res.status(400).json({ success: false, message: 'Invalid or inactive coupon' });
      }
    }

    if (isExpired) {
      return res.status(400).json({ success: false, message: 'Coupon has expired' });
    }

    if (totalAmount < requiredMinPurchase) {
      return res.status(400).json({
        success: false, 
        message: `Minimum purchase of ৳${requiredMinPurchase} required for this coupon` 
      });
    }

    console.log('Coupon Validation Success:', { code: cleanCode, discount: appliedDiscount });
    res.status(200).json({
      success: true,
      discount: appliedDiscount,
      message: 'Coupon applied successfully'
    });
  } catch (err) {
    console.error('Coupon Validation Error:', err.message);
    res.status(400).json({ success: false, message: err.message });
  }
};

// Update coupon
exports.updateCoupon = async (req, res) => {
  try {
    let coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({ success: true, data: coupon });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// Delete coupon
exports.deleteCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    await coupon.deleteOne();

    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};
