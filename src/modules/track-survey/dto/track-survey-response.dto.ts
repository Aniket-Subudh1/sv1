export class TrackSurveyResponseDto {
  _id: string;
  userId: string;
  cookingFrequency: number;
  scraps: number;
  uneatenLeftovers: number;
  produceWaste: {
    fruit: number;
    veggies: number;
    dairy: number;
    bread: number;
    meat: number;
    herbs: number;
  };
  preferredIngredients: string[];
  noOfCooks: number;
  calculatedSavings: {
    co2_savings: number;
    cost_savings: number;
    food_saved: number;
  };
  isBaseline: boolean;
  surveyWeek: Date;
  surveyDay: number;
  isCo2PersonalBest: boolean;
  isCostPersonalBest: boolean;
  isFoodSavedPersonalBest: boolean;
  completedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class SurveyEligibilityDto {
  eligible: boolean;
  next_survey_date: string | null;
  last_survey_date: string | null;
  surveys_count: number;
  message?: string;
}

export class WeeklySavingsSummaryDto {
  current_week: {
    co2_savings: number;
    cost_savings: number;
    food_saved: number;
  };
  previous_week?: {
    co2_savings: number;
    cost_savings: number;
    food_saved: number;
  } | null;
  personal_bests: {
    co2_savings: number;
    cost_savings: number;
    food_saved: number;
  };
  total_surveys: number;
  total_co2_saved: number;
  total_cost_saved: number;
  total_food_saved: number;
}
