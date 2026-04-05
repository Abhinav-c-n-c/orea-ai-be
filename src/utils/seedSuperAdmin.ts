import User from '../models/User';
import { defaultPermissions } from '../models/User';
import { env } from '../config/env';

export const seedSuperAdmin = async (): Promise<void> => {
  try {
    const existing = await User.findOne({ role: 'super_admin' }).lean();
    if (existing) {
      console.log('✅ Super admin already exists');
      return;
    }

    await User.create({
      name: 'Super Admin',
      email: env.SUPER_ADMIN_EMAIL,
      password: env.SUPER_ADMIN_PASSWORD,
      role: 'super_admin',
      permissions: defaultPermissions.super_admin,
      isActive: true,
    });

    console.log(`✅ Super admin created: ${env.SUPER_ADMIN_EMAIL}`);
  } catch (error) {
    console.error('❌ Failed to seed super admin:', error);
  }
};
