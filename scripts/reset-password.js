const db = require('../database/db');
const bcrypt = require('bcrypt');

async function resetPassword() {
    console.log('Resetting admin password...');
    
    try {
        // Check if admin exists
        const admin = await db.get('SELECT * FROM admins WHERE username = ?', ['admin']);
        
        if (!admin) {
            console.log('❌ Admin not found! Creating new admin...');
            const hashedPassword = await bcrypt.hash('Admin@123456', 10);
            await db.run(
                'INSERT INTO admins (username, password, role) VALUES (?, ?, ?)',
                ['admin', hashedPassword, 'superadmin']
            );
            console.log('✅ Admin created successfully!');
        } else {
            console.log('✅ Admin found:', admin.username);
            const hashedPassword = await bcrypt.hash('Admin@123456', 10);
            await db.run('UPDATE admins SET password = ? WHERE username = ?', [hashedPassword, 'admin']);
            console.log('✅ Password reset to: Admin@123456');
        }
        
        // Verify the password
        const updatedAdmin = await db.get('SELECT * FROM admins WHERE username = ?', ['admin']);
        const testMatch = await bcrypt.compare('Admin@123456', updatedAdmin.password);
        console.log('✅ Password verification:', testMatch ? 'SUCCESS' : 'FAILED');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

resetPassword();
