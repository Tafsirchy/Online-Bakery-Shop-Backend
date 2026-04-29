const dotenv = require('dotenv');
const mongoose = require('mongoose');
const connectDB = require('./config/db');

// Load env vars
dotenv.config();

// Load models
const Product = require('./models/Product');
const User = require('./models/User');
const Coupon = require('./models/Coupon');
const Category = require('./models/Category');

// Mock Data
const products = [
  {
    name: 'Classic Sourdough',
    price: 8.50,
    category: 'Bread',
    description: 'Slow-fermented for 24 hours using organic stone-ground flour.',
    stock: 20,
    images: ['https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=800'],
    averageRating: 4.8,
    discountPrice: 6.99,
    ingredients: ['Organic Stone-ground Flour', 'Natural Wild Yeast', 'Filtered Water', 'Sea Salt'],
    healthBenefits: ['Rich in Probiotics', 'Easier to Digest', 'Low Glycemic Index', 'No Preservatives']
  },
  {
    name: 'Velvet Chocolate Cake',
    price: 35.00,
    category: 'Cakes',
    description: 'Triple-layer dark chocolate cake with silky ganache frosting.',
    stock: 5,
    images: ['https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=800'],
    averageRating: 4.9,
    discountPrice: 29.5,
    ingredients: ['70% Dark Cocoa', 'Organic Cane Sugar', 'Grass-fed Butter', 'Free-range Eggs', 'Madagascar Vanilla'],
    healthBenefits: ['High in Antioxidants', 'Mood Enhancer', 'Iron & Magnesium Source']
  },
  {
    name: 'Almond Croissant',
    price: 4.75,
    category: 'Pastries',
    description: 'Flaky layers filled with homemade almond frangipane.',
    stock: 15,
    images: ['https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&q=80&w=800'],
    averageRating: 4.7,
    discountPrice: 0,
    ingredients: ['French Cultured Butter', 'California Almonds', 'Organic Wheat Flour', 'Honey'],
    healthBenefits: ['High Protein Almonds', 'Healthy Fats', 'Energy Booster']
  },
  {
    name: 'Blueberry Muffin',
    price: 3.50,
    category: 'Pastries',
    description: 'Bursting with fresh blueberries and topped with sugar streusel.',
    stock: 25,
    images: ['https://images.unsplash.com/photo-1607958996333-41aef7caefaa?auto=format&fit=crop&q=80&w=800'],
    averageRating: 4.6,
    discountPrice: 0,
  },
  {
    name: 'Artisanal Baguette',
    price: 5.00,
    category: 'Bread',
    description: 'Traditional French style with a crispy crust and soft airy center.',
    stock: 30,
    images: ['https://images.unsplash.com/photo-1597079910443-60c43fc4f729?auto=format&fit=crop&q=80&w=800'],
    averageRating: 4.5,
    discountPrice: 4.25,
  },
  {
    name: 'Strawberry Tart',
    price: 6.50,
    category: 'Cakes',
    description: 'Buttery shortcrust pastry filled with crème pâtissière and glazed strawberries.',
    stock: 10,
    images: ['https://images.unsplash.com/photo-1464305795204-6f5bdee7351a?auto=format&fit=crop&q=80&w=800'],
    averageRating: 4.8,
    discountPrice: 5.5,
  },
  {
    name: 'Butter Cookie Box',
    price: 12.99,
    category: 'Cookies',
    description: 'Crisp, buttery cookies in a gift-ready bakery box.',
    stock: 35,
    images: ['https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&q=80&w=800'],
    averageRating: 4.4,
    discountPrice: 10.99,
  },
  {
    name: 'Cinnamon Roll',
    price: 5.75,
    category: 'Pastries',
    description: 'Soft brioche swirl with cinnamon sugar and cream-cheese glaze.',
    stock: 18,
    images: ['https://images.unsplash.com/photo-1509365465985-25d11c17e812?auto=format&fit=crop&q=80&w=800'],
    averageRating: 4.9,
    discountPrice: 0,
  },
  {
    name: 'Honey Oat Loaf',
    price: 7.95,
    category: 'Bread',
    description: 'Wholegrain loaf sweetened lightly with wildflower honey.',
    stock: 16,
    images: ['https://images.unsplash.com/photo-1608198093002-ad4e005484ec?auto=format&fit=crop&q=80&w=800'],
    averageRating: 4.3,
    discountPrice: 6.95,
  },
  {
    name: 'Caramel Cheesecake Slice',
    price: 9.5,
    category: 'Cakes',
    description: 'Rich baked cheesecake topped with salted caramel drizzle.',
    stock: 12,
    images: ['https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&q=80&w=800'],
    averageRating: 4.8,
    discountPrice: 8.25,
  },
  {
    name: 'Hazelnut Biscotti',
    price: 8.25,
    category: 'Cookies',
    description: 'Twice-baked Italian biscotti with roasted hazelnuts.',
    stock: 40,
    images: ['https://images.unsplash.com/photo-1548365328-9f547fb0953e?auto=format&fit=crop&q=80&w=800'],
    averageRating: 4.2,
    discountPrice: 0,
  },
  {
    name: 'Weekend Special Focaccia',
    price: 11.5,
    category: 'Bread',
    description: 'Rosemary-garlic focaccia baked fresh for limited weekend batches.',
    stock: 14,
    images: ['https://images.unsplash.com/photo-1619531040576-f9416740661f?auto=format&fit=crop&q=80&w=800'],
    averageRating: 4.7,
    discountPrice: 0,
  },
];

const users = [
  {
    name: 'Admin User',
    email: 'admin@cozybakery.com',
    password: 'admin1',
    role: 'admin',
  },
  {
    name: 'Manager User',
    email: 'manager@cozybakery.com',
    password: 'manager123',
    role: 'manager',
  },
  {
    name: 'Customer User',
    email: 'customer@cozybakery.com',
    password: 'customer123',
    role: 'customer',
  },
];

const coupons = [
  {
    code: 'BAKERY10',
    discount: 10,
    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    isActive: true,
    minPurchase: 100,
    description: 'Get 10% off on orders above ৳100'
  },
  {
    code: 'WELCOME20',
    discount: 20,
    expiryDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
    isActive: true,
    minPurchase: 500,
    description: 'Special welcome discount for new customers!'
  }
];

const initialCategories = [
  { 
    name: 'Cakes', 
    description: 'From celebration masterpieces to daily tea-time delights, our cakes are baked with the finest organic cocoa and Madagascan vanilla.', 
    subtitle: 'Divine layers of sweetness for every celebration.', 
    isFeatured: true 
  },
  { 
    name: 'Pastries', 
    description: 'Hundreds of flaky layers, pure French butter, and the crunch of a perfect bake. Our pastries are a morning tradition.', 
    subtitle: 'Flaky, buttery goodness baked fresh every morning.', 
    isFeatured: true 
  },
  { 
    name: 'Cookies', 
    description: 'Crispy edges, gooey centers, and a hint of sea salt. Made in small batches to ensure the perfect texture every time.', 
    subtitle: 'Crispy edges and soft hearts in every bite.', 
    isFeatured: true 
  },
  { 
    name: 'Bread', 
    description: 'The soul of our bakery. Naturally leavened sourdoughs and rustic loaves with a thick, caramelized crust.', 
    subtitle: 'The soul of our bakery, slow-fermented for flavor.', 
    isFeatured: true 
  }
];

// Import into DB
const importData = async () => {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ CRITICAL: Cannot run seeder in production environment! Aborting to prevent data loss.');
    process.exit(1);
  }
  try {
    await connectDB();

    await Product.deleteMany();
    await User.deleteMany();
    await Coupon.deleteMany();
    await Category.deleteMany();

    await User.create(users);
    await Product.create(products);
    await Coupon.create(coupons);
    await Category.create(initialCategories);
    console.log('Data Imported...');
    await mongoose.connection.close();
    process.exit();
  } catch (err) {
    console.error(err);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Delete data
const deleteData = async () => {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ CRITICAL: Cannot destroy data in production environment! Aborting.');
    process.exit(1);
  }
  try {
    await connectDB();

    await Product.deleteMany();
    await User.deleteMany();
    await Coupon.deleteMany();
    await Category.deleteMany();
    console.log('Data Destroyed...');
    await mongoose.connection.close();
    process.exit();
  } catch (err) {
    console.error(err);
    await mongoose.connection.close();
    process.exit(1);
  }
};

if (process.argv[2] === '-i') {
  importData();
} else if (process.argv[2] === '-d') {
  deleteData();
}
