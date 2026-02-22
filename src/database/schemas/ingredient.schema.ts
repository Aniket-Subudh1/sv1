import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Schema as MongooseSchema } from 'mongoose';

export enum IngredientTheme {
  RED = 'Red',
  PINK = 'Pink',
  PURPLE = 'Purple',
  GREEN = 'Green',
  YELLOW = 'Yellow',
  ORANGE = 'Orange',
}

export enum Month {
  JANUARY = 'January',
  FEBRUARY = 'February',
  MARCH = 'March',
  APRIL = 'April',
  MAY = 'May',
  JUNE = 'June',
  JULY = 'July',
  AUGUST = 'August',
  SEPTEMBER = 'September',
  OCTOBER = 'October',
  NOVEMBER = 'November',
  DECEMBER = 'December',
}

@Schema({ timestamps: true })
export class Ingredient {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  averageWeight: number; 

  @Prop({ type: Types.ObjectId, ref: 'IngredientsCategory', required: true })
  categoryId: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'DietCategory' }], default: [] })
  suitableDiets: Types.ObjectId[];

  @Prop({ default: false })
  hasPage: boolean;

  @Prop()
  heroImageUrl?: string;

  @Prop({ enum: Object.values(IngredientTheme) })
  theme?: IngredientTheme;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Ingredient' }], default: [] })
  parentIngredients: Types.ObjectId[];

  @Prop()
  description?: string; 

  @Prop({ type: Types.ObjectId, ref: 'Sponsers' })
  sponsorId?: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'HackOrTip' }], default: [] })
  relatedHacks: Types.ObjectId[];

  @Prop({ type: [{ type: String, enum: Object.values(Month) }], default: [] })
  inSeason: Month[];

  @Prop({ type: Types.ObjectId, ref: 'Stickers' })
  stickerId?: Types.ObjectId;

  @Prop({ default: false })
  isPantryItem: boolean;

  @Prop()
  nutrition?: string; 

  @Prop({ default: 0 })
  order?: number; 

  @Prop({ type: [String], default: [] })
  countries: string[];
}

export type IngredientDocument = Ingredient & Document;
export const IngredientSchema = SchemaFactory.createForClass(Ingredient);

IngredientSchema.index({ name: 1 });
IngredientSchema.index({ categoryId: 1 });
IngredientSchema.index({ hasPage: 1 });
IngredientSchema.index({ suitableDiets: 1 });
