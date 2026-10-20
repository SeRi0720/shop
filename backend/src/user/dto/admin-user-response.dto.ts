export class AdminUserItemDto {
  id: number;
  email: string;
  fullName: string;
  phone: string | null;
  role: 'USER' | 'ADMIN';
  isActive: boolean;
  createdAt: Date;

  static from(u: AdminUserItemDto): AdminUserItemDto {
    return {
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      phone: u.phone,
      role: u.role,
      isActive: u.isActive,
      createdAt: u.createdAt,
    };
  }
}
