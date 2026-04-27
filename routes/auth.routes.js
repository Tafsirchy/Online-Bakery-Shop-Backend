const express = require('express');
const { 
  register, 
  login, 
  getMe, 
  forgotPassword, 
  resetPassword, 
  googleLogin, 
  updateDetails, 
  updatePassword, 
  getWishlist, 
  toggleWishlist,
  getUsers,
  updateUserRole,
  deleteUser
} = require('../controllers/auth.controller');

const { protect, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.post('/forgotpassword', forgotPassword);
router.put('/resetpassword/:resettoken', resetPassword);
router.post('/google', googleLogin);
router.put('/updatedetails', protect, updateDetails);
router.put('/updatepassword', protect, updatePassword);
router.get('/wishlist', protect, getWishlist);
router.post('/wishlist/:productId', protect, toggleWishlist);

// Admin and Manager routes
router.get('/users', protect, authorize('admin', 'manager'), getUsers);
router.put('/users/:id/role', protect, authorize('admin', 'manager'), updateUserRole);
router.delete('/users/:id', protect, authorize('admin', 'manager'), deleteUser);

module.exports = router;
