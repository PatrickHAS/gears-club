import { MatchTeam } from '@prisma/client';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsString,
  IsUUID,
  Length,
  Equals,
} from 'class-validator';

export class ResolveDisputeDto {
  @IsEnum(MatchTeam)
  winnerTeam!: MatchTeam;

  @IsString()
  @Length(10, 2000)
  reason!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  evidenceIds!: string[];

  @Equals(true)
  gamertagsVerified!: boolean;
}
