const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // Waa loo beddeley bcryptjs si uu package.json-kaaga u waafaqo
require('dotenv').config();

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'admin' }
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

const seedAdmin = async () => {
  try {
    const rawPassword = process.env.ADMIN_PASSWORD || 'AdminTayonx123!';
    
    // Hubinta dhererka erayga sirta ah (Password Validation)
    if (!rawPassword || rawPassword.length < 8 || rawPassword.length > 72) {
      console.error('❌ Password-ku waa inuu yahay 8 ilaa 72 xaraf!');
      process.exit(1);
    }

    if (!process.env.MONGO_URI) {
      console.error('❌ MONGO_URI ma ku jiro faylka .env!');
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB Atlas...');

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@tayonx.com';
    const adminName = process.env.ADMIN_NAME || 'Tayonx Admin';

    // Tirtir admin-kii hore haddii uu jiray si loo cusboonaysiiyo
    await User.deleteOne({ email: adminEmail });

    // Hash password-ka iyadoo la isticmaalayo bcryptjs
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    const admin = new User({
      name: adminName,
      email: adminEmail,
      password: hashedPassword,
      role: 'admin'
    });

    await admin.save();
    console.log('🎉 Admin account seeded successfully!');
    console.log(`📧 Email: ${adminEmail}`);
    console.log(`🔑 Password: ${rawPassword}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during seeding:', error.message);
    process.exit(1);
  }
};

seedAdmin();