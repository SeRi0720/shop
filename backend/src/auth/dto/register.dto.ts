import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PHONE_MESSAGE, PHONE_REGEX } from '../../common/phone';

export class RegisterDto {
  @IsEmail() email: string;
  @IsString() @MinLength(8) password: string;
  @IsString() @IsNotEmpty() @MaxLength(100) fullName: string;
  @IsOptional()
  @IsString()
  @Matches(PHONE_REGEX, { message: PHONE_MESSAGE })
  phone?: string;
}
