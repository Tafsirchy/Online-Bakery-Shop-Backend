const Coupon = require('../models/Coupon');
const GlobalSettings = require('../models/GlobalSettings');

// @desc    Get all coupons
// @route   GET /api/coupons
// @access  Private (Admin/Manager)
exports.getCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find();
    res.status(200).json({ success: true, data: coupons });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc    Get active coupons for public UI
// @route   GET /api/coupons/public
// @access  Public
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

// @desc    Create coupon
// @route   POST /api/coupons
// @access  Private (Admin)
exports.createCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.create(req.body);
    res.status(201).json({ success: true, data: coupon });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc    Validate coupon
// @route   POST /api/coupons/validate
// @access  Private
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

// @desc    Update coupon
// @route   PUT /api/coupons/:id
// @access  Private (Admin)
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

// @desc    Delete coupon
// @route   DELETE /api/coupons/:id
// @access  Private (Admin)
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
