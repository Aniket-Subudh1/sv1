import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsUrl,
  IsArray,
  IsDateString,
  ValidateNested,
  Min,
} from 'class-validator';

import { Type, Transform } from 'class-transformer';
import { BadgeCategory, MilestoneType, MetricType } from '../../../database/schemas/badge.schema';

class SponsorMetadataDto {
  @IsOptional()
  @IsString()
  campaignId?: string;

  @IsOptional()
  @IsString()
  redemptionCode?: string;

  @IsOptional()
  @IsUrl()
  sponsorLink?: string;

  @IsOptional()
  @IsString()
  termsAndConditions?: string;
}

export class CreateBadgeDto {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsEnum(BadgeCategory)
  category: BadgeCategory;

  @IsOptional()
  @IsEnum(MilestoneType)
  milestoneType?: MilestoneType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  milestoneThreshold?: number;

  @IsOptional()
  @IsEnum(MetricType)
  metricType?: MetricType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  rarityScore?: number;

  @IsOptional()
  @IsString()
  iconColor?: string;

  @IsOptional()
  @IsString()
  challengeId?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return Boolean(value);
  })
  @IsBoolean()
  isActive?: boolean;

  // Sponsor Badge Fields
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return Boolean(value);
  })
  @IsBoolean()
  isSponsorBadge?: boolean;

  @IsOptional()
  @IsString()
  sponsorName?: string;

  @IsOptional()
  @IsUrl()
  sponsorLogoUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [];
      }
    }
    return Array.isArray(value) ? value : [];
  })
  sponsorCountries?: string[]; // ISO country codes like ["AU", "IN", "NZ"]

  @IsOptional()
  @IsDateString()
  sponsorValidFrom?: string;

  @IsOptional()
  @IsDateString()
  sponsorValidUntil?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => SponsorMetadataDto)
  sponsorMetadata?: SponsorMetadataDto;
}
