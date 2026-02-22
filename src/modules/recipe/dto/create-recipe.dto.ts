import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsArray,
  IsNumber,
  IsBoolean,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class AlternativeIngredientDto {
  @IsString()
  @IsNotEmpty()
  ingredient: string;

  @IsBoolean()
  @IsOptional()
  inheritQuantity?: boolean;

  @IsBoolean()
  @IsOptional()
  inheritPreparation?: boolean;

  @IsString()
  @IsOptional()
  quantity?: string;

  @IsString()
  @IsOptional()
  preparation?: string;
}

export class RequiredIngredientDto {
  @IsString()
  @IsNotEmpty()
  recommendedIngredient: string;

  @IsString()
  @IsNotEmpty()
  quantity: string;

  @IsString()
  @IsNotEmpty()
  preparation: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AlternativeIngredientDto)
  alternativeIngredients?: AlternativeIngredientDto[];
}

export class OptionalIngredientDto {
  @IsString()
  @IsNotEmpty()
  ingredient: string;

  @IsString()
  @IsNotEmpty()
  quantity: string;

  @IsString()
  @IsNotEmpty()
  preparation: string;
}

export class ComponentStepDto {
  @IsString()
  @IsNotEmpty()
  stepInstructions: string;

  @IsArray()
  @IsOptional()
  hackOrTipIds?: string[];

  @IsBoolean()
  @IsOptional()
  alwaysShow?: boolean;

  @IsArray()
  @IsOptional()
  relevantIngredients?: string[];
}

export class ComponentDto {
  @IsString()
  @IsNotEmpty()
  componentTitle: string;

  @IsString()
  @IsOptional()
  componentInstructions?: string;

  @IsArray()
  @IsOptional()
  includedInVariants?: string[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => RequiredIngredientDto)
  requiredIngredients?: RequiredIngredientDto[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => OptionalIngredientDto)
  optionalIngredients?: OptionalIngredientDto[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ComponentStepDto)
  componentSteps?: ComponentStepDto[];
}

export class RecipeComponentWrapperDto {
  @IsString()
  @IsOptional()
  prepShortDescription?: string;

  @IsString()
  @IsOptional()
  prepLongDescription?: string;

  @IsArray()
  @IsOptional()
  variantTags?: string[];

  @IsBoolean()
  @IsOptional()
  stronglyRecommended?: boolean;

  @IsString()
  @IsOptional()
  choiceInstructions?: string;

  @IsString()
  @IsOptional()
  buttonText?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ComponentDto)
  component: ComponentDto[];
}

export class CreateRecipeDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsString()
  @IsNotEmpty()
  shortDescription: string;

  @IsNotEmpty()
  @IsString()
  longDescription: string;

  @IsOptional()
  @IsString()
  youtubeId?: string;

  @IsOptional()
  @IsString()
  heroImageUrl?: string;

  @IsString()
  @IsNotEmpty()
  portions: string;

  @IsNumber()
  prepCookTime: number;

  @IsOptional()
  @IsString()
  stickerId?: string;

  @IsArray()
  @ArrayMinSize(1)
  frameworkCategories: string[];

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

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RecipeComponentWrapperDto)
  components: RecipeComponentWrapperDto[];

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