import {
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

import { Transform } from 'class-transformer';

export const SUPPORTED_COUNTRIES = [
  // América do Sul
  'BR',
  'AR',
  'CL',
  'UY',
  'CO',
  'EC',
  'PE',
  'BO',
  'PY',
  'VE',

  // América do Norte
  'MX',
  'US',
  'CA',

  // América Central
  'GT',
  'HN',
  'SV',
  'NI',
  'CR',
  'PA',

  // Caribe
  'DO',
  'CU',
  'HT',
] as const;

export class UpdatePlayerProfileDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  gamertag?: string;

  @IsOptional()
  @IsString()
  @IsIn([...SUPPORTED_COUNTRIES])
  country?: string;

  @IsOptional()
  @IsUrl({
    protocols: ['https'],
    require_protocol: true,
  })
  avatarUrl?: string;
}
