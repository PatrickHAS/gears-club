import { ArrayUnique, IsArray, IsIn, IsString } from 'class-validator';

export const MATCHMAKING_COUNTRIES = [
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
  'MX',
  'US',
  'CA',
  'GT',
  'HN',
  'SV',
  'NI',
  'CR',
  'PA',
  'DO',
  'CU',
  'HT',
] as const;

export class UpdateMatchmakingPreferencesDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsIn(MATCHMAKING_COUNTRIES, { each: true })
  countries!: string[];
}
