import {
  IsOptional,
  IsString,
  IsArray,
  IsNumber,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

import {
  AlternativeIngredientDto,
  RequiredIngredientDto,
  OptionalIngredientDto,
  ComponentStepDto,
  ComponentDto,
  RecipeComponentWrapperDto,
} from './create-recipe.dto';

export class UpdateRecipeDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  shortDescription?: string;

  @IsOptional()
  @IsString()
  longDescription?: string;

  @IsOptional()
  @IsString()
  youtubeId?: string;

  @IsOptional()
  @IsString()
  heroImageUrl?: string;

  @IsOptional()
  @IsString()
  portions?: string;

  @IsOptional()
  @IsNumber()
  prepCookTime?: number;

  @IsOptional()
  @IsString()
  stickerId?: string;

  @IsOptional()
  @IsArray()
  frameworkCategories?: string[];

  @IsOptional()
  @IsString()
  sponsorId?: string;

  @IsOptional()
  @IsString()
  fridgeKeepTime?: string;

  @IsOptional()
  @IsString()
  freezeKeepTime?: string;

  @IsOptional()
  @IsArray()
  hackOrTipIds?: string[];

  @IsOptional()
  @IsArray()
  useLeftoversIn?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeComponentWrapperDto)
  components?: RecipeComponentWrapperDto[];

  @IsOptional()
  @IsNumber()
  order?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

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