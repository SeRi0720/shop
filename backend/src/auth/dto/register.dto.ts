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
import { Sanitize } from '../../common/sanitize';

export class RegisterDto {
  @IsEmail() email: string;
  @IsString() @MinLength(8) password: string;
  @Sanitize()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fullName: string;
  @IsOptional()
  @IsString()
  @Matches(PHONE_REGEX, { message: PHONE_MESSAGE })
  phone?: string;
}
