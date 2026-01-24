import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Schema as MongooseSchema } from 'mongoose';

export interface ProduceWaste {
  fruit: number; 
  veggies: number; 
  dairy: number;
  bread: number;
  meat: number; 
  herbs: number; 
}

export interface WeeklySavings {
  co2_savings: number;
  cost_savings: number;
  food_saved: number;
}

@Schema({ timestamps: true })
export class TrackSurvey {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  cookingFrequency: number; 

  @Prop({ required: true, min: 0 })
  scraps: number;

  @Prop({ required: true, min: 0 })
  uneatenLeftovers: number;

  @Prop({
    type: MongooseSchema.Types.Mixed,
    required: true,
    default: {
      fruit: 0,
      veggies: 0,
      dairy: 0,
      bread: 0,
      meat: 0,
      herbs: 0,
    },
  })
  produceWaste: ProduceWaste;

  @Prop({ type: [String], default: [] })
  preferredIngredients: string[];

  @Prop({ default: 1, min: 1 })
  noOfCooks: number;

  @Prop({
    type: MongooseSchema.Types.Mixed,
    default: {
      co2_savings: 0,
      cost_savings: 0,
      food_saved: 0,
    },
  })
  calculatedSavings: WeeklySavings;

  @Prop({ default: false })
  isBaseline: boolean; 

  @Prop({ required: true, index: true })
  surveyWeek: Date; 

  @Prop({ required: true })
  surveyDay: number;

  @Prop({ default: false })
  isCo2PersonalBest: boolean;

  @Prop({ default: false })
  isCostPersonalBest: boolean;

  @Prop({ default: false })
  isFoodSavedPersonalBest: boolean;

  @Prop({ type: Date, default: Date.now })
  completedAt: Date;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}

export type TrackSurveyDocument = TrackSurvey & Document;
export const TrackSurveySchema = SchemaFactory.createForClass(TrackSurvey);

TrackSurveySchema.index({ userId: 1, surveyWeek: -1 });
TrackSurveySchema.index({ userId: 1, completedAt: -1 });
TrackSurveySchema.index({ userId: 1, isBaseline: 1 });

TrackSurveySchema.index({ userId: 1, surveyWeek: 1 }, { unique: true });
