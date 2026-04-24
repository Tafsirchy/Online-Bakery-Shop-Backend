const fs = require('fs');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load env vars
dotenv.config();

// Load models
const Product = require('./models/Product');
const User = require('./models/User');

// Connect to DB
mongoose.connect(process.env.MONGO_URI);

// Mock Data
const products = [
  {
    name: 'Classic Sourdough',
    price: 8.50,
    category: 'Bread',
    description: 'Slow-fermented for 24 hours using organic stone-ground flour.',
    stock: 20,
    images: ['https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=800']
  },
  {
    name: 'Velvet Chocolate Cake',
    price: 35.00,
    category: 'Cakes',
    description: 'Triple-layer dark chocolate cake with silky ganache frosting.',
    stock: 5,
    images: ['https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=800']
  },
  {
    name: 'Almond Croissant',
    price: 4.75,
    category: 'Pastries',
    description: 'Flaky layers filled with homemade almond frangipane.',
    stock: 15,
    images: ['https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&q=80&w=800']
  },
  {
    name: 'Blueberry Muffin',
    price: 3.50,
    category: 'Pastries',
    description: 'Bursting with fresh blueberries and topped with sugar streusel.',
    stock: 25,
    images: ['https://images.unsplash.com/photo-1607958996333-41aef7caefaa?auto=format&fit=crop&q=80&w=800']
  },
  {
    name: 'Artisanal Baguette',
    price: 5.00,
    category: 'Bread',
    description: 'Traditional French style with a crispy crust and soft airy center.',
    stock: 30,
    images: ['https://images.unsplash.com/photo-1597079910443-60c43fc4f729?auto=format&fit=crop&q=80&w=800']
  },
  {
    name: 'Strawberry Tart',
    price: 6.50,
    category: 'Cakes',
    description: 'Buttery shortcrust pastry filled with crème pâtissière and glazed strawberries.',
    stock: 10,
    images: ['https://images.unsplash.com/photo-1464305795204-6f5bdee7351a?auto=format&fit=crop&q=80&w=800']
  }
];

// Import into DB
const importData = async () => {
  try {
    await Product.create(products);
    console.log('Data Imported...');
    process.exit();
  } catch (err) {
    console.error(err);
  }
};

// Delete data
const deleteData = async () => {
  try {
    await Product.deleteMany();
    await User.deleteMany();
    console.log('Data Destroyed...');
    process.exit();
  } catch (err) {
    console.error(err);
  }
};

if (process.argv[2] === '-i') {
  importData();
} else if (process.argv[2] === '-d') {
  deleteData();
}
