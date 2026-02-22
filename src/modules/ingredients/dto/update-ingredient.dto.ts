import {
  IsOptional,
  IsString,
  IsNumber,
  IsBoolean,
  IsEnum,
  IsArray,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { IngredientTheme, Month } from '../../../database/schemas/ingredient.schema';

export class UpdateIngredientDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    const v = typeof value === 'string' ? value.trim() : value;
    const n = Number(v);
    return Number.isFinite(n) ? n : value;
  })
  @IsNumber()
  @Min(0)
  averageWeight?: number;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsArray()
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
  suitableDiets?: string[];

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value === 'true';
    }
    return Boolean(value);
  })
  hasPage?: boolean;

  @IsOptional()
  @IsEnum(IngredientTheme)
  theme?: IngredientTheme;

  @IsOptional()
  @IsArray()
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
  parentIngredients?: string[];

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  sponsorId?: string;

  @IsOptional()
  @IsArray()
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
  relatedHacks?: string[];

  @IsOptional()
  @IsArray()
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
  inSeason?: Month[];

  @IsOptional()
  @IsString()
  stickerId?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value === 'true';
    }
    return Boolean(value);
  })
  isPantryItem?: boolean;

  @IsOptional()
  @IsString()
  nutrition?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    const v = typeof value === 'string' ? value.trim() : value;
    const n = Number(v);
    return Number.isFinite(n) ? n : value;
  })
  @IsNumber()
  order?: number;

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
  countries?: string[];
}
