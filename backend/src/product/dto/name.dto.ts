import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Sanitize } from '../../common/sanitize';

export class NameDto {
  @Sanitize()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}
