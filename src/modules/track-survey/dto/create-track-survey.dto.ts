import {
  IsNumber,
  IsArray,
  IsString,
  IsOptional,
  Min,
  IsInt,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';


export class ProduceWasteDto {
  @IsNumber()
  @Min(0)
  fruit: number;

  @IsNumber()
  @Min(0)
  veggies: number;

  @IsNumber()
  @Min(0)
  dairy: number;

  @IsNumber()
  @Min(0)
  bread: number;

  @IsNumber()
  @Min(0)
  meat: number;

  @IsNumber()
  @Min(0)
  herbs: number;
}

export class CreateTrackSurveyDto {
  @IsInt()
  @Min(0)
  cookingFrequency: number;

  @IsInt()
  @Min(0)
  scraps: number;

  @IsInt()
  @Min(0)
  uneatenLeftovers: number;

  @ValidateNested()
  @Type(() => ProduceWasteDto)
  produceWaste: ProduceWasteDto;

  @IsArray()
  @IsString({ each: true })
  preferredIngredients: string[];

  @IsInt()
  @Min(1)
  @IsOptional()
  noOfCooks?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  surveyDay?: number; // 0-6 for Sun-Sat

  @IsString()
  @IsOptional()
  country?: string; // ISO country code e.g. IN, AU, US
}
