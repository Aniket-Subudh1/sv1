import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional, IsArray, IsBoolean, IsNumber } from 'class-validator';

export class RequestOtpDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsString()
  @IsNotEmpty()
  confirmPassword: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  stateCode?: string;

  @IsOptional()
  @IsString()
  vegType?: string;

  @IsOptional()
  @IsBoolean()
  dairyFree?: boolean;

  @IsOptional()
  @IsBoolean()
  nutFree?: boolean;

  @IsOptional()
  @IsBoolean()
  glutenFree?: boolean;

  @IsOptional()
  @IsBoolean()
  hasDiabetes?: boolean;

  @IsOptional()
  @IsArray()
  otherAllergies?: string[];

  @IsOptional()
  @IsNumber()
  noOfAdults?: number;

  @IsOptional()
  @IsNumber()
  noOfChildren?: number;

  @IsOptional()
  @IsArray()
  tastePreference?: string[];
}
