import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ _id: false })
export class AlternativeIngredient {
  @Prop({ type: Types.ObjectId, ref: 'Ingredient', required: true })
  ingredient: Types.ObjectId;

  @Prop({ default: false })
  inheritQuantity: boolean;

  @Prop({ default: false })
  inheritPreparation: boolean;

  @Prop()
  quantity?: string;

  @Prop()
  preparation?: string;
}


@Schema({ _id: false })
export class RequiredIngredient {
  @Prop({ type: Types.ObjectId, ref: 'Ingredient', required: true })
  recommendedIngredient: Types.ObjectId;

  @Prop({ required: true })
  quantity: string;

  @Prop({ required: true })
  preparation: string;

  @Prop({ type: [AlternativeIngredient], default: [] })
  alternativeIngredients: AlternativeIngredient[];
}

@Schema({ _id: false })
export class OptionalIngredient {
  @Prop({ type: Types.ObjectId, ref: 'Ingredient', required: true })
  ingredient: Types.ObjectId;

  @Prop({ required: true })
  quantity: string;

  @Prop({ required: true })
  preparation: string;
}

@Schema({ _id: false })
export class ComponentStep {
  @Prop({ required: true })
  stepInstructions: string; 

  @Prop({ type: [{ type: Types.ObjectId, ref: 'HackOrTip' }], default: [] })
  hackOrTipIds: Types.ObjectId[];

  @Prop({ default: false })
  alwaysShow: boolean;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Ingredient' }], default: [] })
  relevantIngredients: Types.ObjectId[];
}

@Schema({ _id: false })
export class Component {
  @Prop({ required: true })
  componentTitle: string; 

  @Prop()
  componentInstructions?: string;

  @Prop({ type: [String], default: [] })
  includedInVariants: string[];

  @Prop({ type: [RequiredIngredient], default: [] })
  requiredIngredients: RequiredIngredient[];

  @Prop({ type: [OptionalIngredient], default: [] })
  optionalIngredients: OptionalIngredient[];

  @Prop({ type: [ComponentStep], default: [] })
  componentSteps: ComponentStep[];
}


@Schema({ _id: false })
export class RecipeComponentWrapper {

  @Prop()
  prepShortDescription?: string;

  @Prop()
  prepLongDescription?: string; 

  @Prop({ type: [String], default: [] })
  variantTags: string[];

  @Prop({ default: false })
  stronglyRecommended: boolean;

  @Prop()
  choiceInstructions?: string; 

  @Prop()
  buttonText?: string; 

  @Prop({ type: [Component], required: true })
  component: Component[];
}

@Schema({ timestamps: true })
export class Recipe {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  shortDescription: string;

  @Prop({ required: true })
  longDescription: string; 

  @Prop({ type: [{ type: Types.ObjectId, ref: 'HackOrTip' }], default: [] })
  hackOrTipIds: Types.ObjectId[];

  @Prop()
  heroImageUrl?: string; 

  @Prop()
  youtubeId?: string;

  @Prop({ required: true })
  portions: string; 

  @Prop({ required: true })
  prepCookTime: number; 

  @Prop({ type: Types.ObjectId, ref: 'Stickers' })
  stickerId?: Types.ObjectId;

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'FrameworkCategory' }],
    required: true,
  })
  frameworkCategories: Types.ObjectId[]; 

  @Prop({ type: Types.ObjectId, ref: 'Sponsers' })
  sponsorId?: Types.ObjectId;

  @Prop()
  fridgeKeepTime?: string;

  @Prop()
  freezeKeepTime?: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Recipe' }], default: [] })
  useLeftoversIn: Types.ObjectId[];

 
  @Prop({ type: [RecipeComponentWrapper], required: true })
  components: RecipeComponentWrapper[];

  @Prop({ default: 0 })
  order?: number;

  @Prop({ default: true })
  isActive: boolean;
}

export type RecipeDocument = Recipe & Document;
export const RecipeSchema = SchemaFactory.createForClass(Recipe);

// Indexes for optimized queries
RecipeSchema.index({ title: 1 });
RecipeSchema.index({ frameworkCategories: 1 });
RecipeSchema.index({ isActive: 1 });
RecipeSchema.index({ order: 1 });