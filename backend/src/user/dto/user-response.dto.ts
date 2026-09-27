export class UserResponseDto {
  id: number;
  email: string;
  fullName: string;
  phone: string | null;
  role: 'USER' | 'ADMIN';

  static from(user: {
    id: number;
    email: string;
    fullName: string;
    phone: string | null;
    role: 'USER' | 'ADMIN';
  }): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
    };
  }
}
