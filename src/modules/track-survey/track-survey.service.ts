import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { TrackSurvey, TrackSurveyDocument } from 'src/database/schemas/track-survey.schema';
import { CreateTrackSurveyDto } from './dto/create-track-survey.dto';
import {
  SurveyEligibilityDto,
  TrackSurveyResponseDto,
  WeeklySavingsSummaryDto,
} from './dto/track-survey-response.dto';

@Injectable()
export class TrackSurveyService {
  constructor(
    @InjectModel(TrackSurvey.name)
    private trackSurveyModel: Model<TrackSurveyDocument>,
  ) {}

  private getWeekStart(surveyDay: number): Date {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = (dayOfWeek - surveyDay + 7) % 7;
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - diff);
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  }

  private getNextSurveyDate(lastSurveyWeek: Date, surveyDay: number): Date {
    const nextWeek = new Date(lastSurveyWeek);
    nextWeek.setDate(nextWeek.getDate() + 7);
    return nextWeek;
  }

  private calculateSavings(dto: CreateTrackSurveyDto) {
    const COUNTRY_RATES: Record<string, { costPerGram: number; symbol: string }> = {
      IN: { costPerGram: 0.015, symbol: '₹' },  // India – INR per gram (~₹15/kg)
      AU: { costPerGram: 0.004, symbol: 'A$' }, // Australia – AUD per gram (~A$4/kg)
      NZ: { costPerGram: 0.005, symbol: 'NZ$' },// New Zealand – NZD per gram (~NZ$5/kg)
      US: { costPerGram: 0.003, symbol: '$' },  // United States – USD per gram (~$3/kg)
      GB: { costPerGram: 0.0035, symbol: '£' }, // United Kingdom – GBP per gram (~£3.5/kg)
      CA: { costPerGram: 0.004, symbol: 'C$' }, // Canada – CAD per gram (~C$4/kg)
      CN: { costPerGram: 0.02,  symbol: '¥' },  // China – CNY per gram (~¥20/kg)
      JP: { costPerGram: 0.4,   symbol: '¥' },  // Japan – JPY per gram (~¥400/kg)
      KR: { costPerGram: 3.0,   symbol: '₩' },  // South Korea – KRW per gram (~₩3000/kg)
      SG: { costPerGram: 0.004, symbol: 'S$' }, // Singapore – SGD per gram (~S$4/kg)
      AE: { costPerGram: 0.012, symbol: 'AED' },// UAE – AED per gram (~AED12/kg)
      DE: { costPerGram: 0.003, symbol: '€' },  // Germany – EUR per gram (~€3/kg)
      FR: { costPerGram: 0.003, symbol: '€' },  // France – EUR per gram (~€3/kg)
    };

    const countryRate = COUNTRY_RATES[dto.country ?? 'IN'] ?? COUNTRY_RATES['IN'];
    const COST_PER_GRAM = countryRate.costPerGram;
    const CO2_PER_GRAM = 2.5;

    const WEIGHTS = {
      cupfulScraps: 150, 
      containerLeftovers: 500,
      fruitPiece: 150,
      veggiePiece: 100,
      dairyKg: 1000,
      breadLoaf: 400,
      meatKg: 1000,
      herbsBunch: 50,
    };

    // Calculate total waste in grams
    const scrapsWeight = dto.scraps * WEIGHTS.cupfulScraps;
    const leftoversWeight = dto.uneatenLeftovers * WEIGHTS.containerLeftovers;
    const produceWeight =
      dto.produceWaste.fruit * WEIGHTS.fruitPiece +
      dto.produceWaste.veggies * WEIGHTS.veggiePiece +
      dto.produceWaste.dairy * WEIGHTS.dairyKg +
      dto.produceWaste.bread * WEIGHTS.breadLoaf +
      dto.produceWaste.meat * WEIGHTS.meatKg +
      dto.produceWaste.herbs * WEIGHTS.herbsBunch;

    const totalWasteGrams = scrapsWeight + leftoversWeight + produceWeight;

    // Calculate average weekly waste (baseline comparison)
    // Assume average household wastes ~5kg per week
    const avgWeeklyWaste = 5000; // grams
    const foodSaved = Math.max(0, avgWeeklyWaste - totalWasteGrams);

    // Calculate savings — keep 2 decimal places for currency precision
    const co2_savings = Math.round(foodSaved * CO2_PER_GRAM);
    const cost_savings = Math.round(foodSaved * COST_PER_GRAM * 100) / 100;

    return {
      co2_savings,
      cost_savings,
      food_saved: Math.round(foodSaved),
      currency_symbol: countryRate.symbol,
    };
  }

  async checkEligibility(userId: string): Promise<SurveyEligibilityDto> {
    const userIdObj = new Types.ObjectId(userId);

    const lastSurvey = await this.trackSurveyModel
      .findOne({ userId: userIdObj })
      .sort({ surveyWeek: -1 })
      .lean();

    const totalSurveys = await this.trackSurveyModel.countDocuments({
      userId: userIdObj,
    });

    if (!lastSurvey) {
      return {
        eligible: true,
        next_survey_date: null,
        last_survey_date: null,
        surveys_count: 0,
        message: 'Ready to take your first survey!',
      };
    }

    const currentWeekStart = this.getWeekStart(lastSurvey.surveyDay);
    const lastSurveyWeek = new Date(lastSurvey.surveyWeek);

    const eligible = currentWeekStart.getTime() > lastSurveyWeek.getTime();

    const nextSurveyDate = this.getNextSurveyDate(
      lastSurveyWeek,
      lastSurvey.surveyDay,
    );

    return {
      eligible,
      next_survey_date: nextSurveyDate.toISOString(),
      last_survey_date: lastSurvey.completedAt.toISOString(),
      surveys_count: totalSurveys,
      message: eligible
        ? 'Ready to take this week\'s survey!'
        : 'You\'ve already completed this week\'s survey',
    };
  }

  /**
   * Create a new track survey
   */
  async createSurvey(
    userId: string,
    dto: CreateTrackSurveyDto,
  ): Promise<TrackSurveyResponseDto> {
    const userIdObj = new Types.ObjectId(userId);

    // Check eligibility
    const eligibility = await this.checkEligibility(userId);
    if (!eligibility.eligible) {
      throw new BadRequestException(
        'You have already completed a survey for this week',
      );
    }

    // Determine survey day
    const surveyDay = dto.surveyDay ?? new Date().getDay();
    const weekStart = this.getWeekStart(surveyDay);

    // Check if survey already exists for this week
    const existingSurvey = await this.trackSurveyModel.findOne({
      userId: userIdObj,
      surveyWeek: weekStart,
    });

    if (existingSurvey) {
      throw new BadRequestException('Survey already exists for this week');
    }

    // Calculate savings
    const calculatedSavings = this.calculateSavings(dto);

    // Check if this is the first survey (baseline)
    const isBaseline = eligibility.surveys_count === 0;

    // Get personal bests
    const personalBests = await this.getPersonalBests(userId);

    const survey = new this.trackSurveyModel({
      userId: userIdObj,
      cookingFrequency: dto.cookingFrequency,
      scraps: dto.scraps,
      uneatenLeftovers: dto.uneatenLeftovers,
      produceWaste: dto.produceWaste,
      preferredIngredients: dto.preferredIngredients,
      noOfCooks: dto.noOfCooks ?? 1,
      calculatedSavings,
      isBaseline,
      surveyWeek: weekStart,
      surveyDay,
      isCo2PersonalBest: calculatedSavings.co2_savings > personalBests.co2_savings,
      isCostPersonalBest: calculatedSavings.cost_savings > personalBests.cost_savings,
      isFoodSavedPersonalBest: calculatedSavings.food_saved > personalBests.food_saved,
    });

    const saved = await survey.save();

    // Attach previous personal bests (computed before this survey was saved)
    // so the client can display "Your previous best was X" correctly.
    const dto_response = this.toResponseDto(saved);
    dto_response.prev_personal_bests = personalBests;
    return dto_response;
  }

  /**
   * Get all surveys for a user
   */
  async getUserSurveys(userId: string): Promise<TrackSurveyResponseDto[]> {
    const userIdObj = new Types.ObjectId(userId);

    const surveys = await this.trackSurveyModel
      .find({ userId: userIdObj })
      .sort({ surveyWeek: -1 })
      .lean();

    return surveys.map((s) => this.toResponseDto(s));
  }

  /**
   * Get latest survey for a user
   */
  async getLatestSurvey(userId: string): Promise<TrackSurveyResponseDto> {
    const userIdObj = new Types.ObjectId(userId);

    const survey = await this.trackSurveyModel
      .findOne({ userId: userIdObj })
      .sort({ surveyWeek: -1 })
      .lean();

    if (!survey) {
      throw new NotFoundException('No surveys found for this user');
    }

    return this.toResponseDto(survey);
  }

  /**
   * Get personal bests for a user
   */
  private async getPersonalBests(userId: string) {
    const userIdObj = new Types.ObjectId(userId);

    const surveys = await this.trackSurveyModel
      .find({ userId: userIdObj })
      .lean();

    if (surveys.length === 0) {
      return { co2_savings: 0, cost_savings: 0, food_saved: 0 };
    }

    return {
      co2_savings: Math.max(
        ...surveys.map((s) => s.calculatedSavings.co2_savings),
      ),
      cost_savings: Math.max(
        ...surveys.map((s) => s.calculatedSavings.cost_savings),
      ),
      food_saved: Math.max(
        ...surveys.map((s) => s.calculatedSavings.food_saved),
      ),
    };
  }

  /**
   * Get weekly savings summary
   */
  async getWeeklySummary(userId: string): Promise<WeeklySavingsSummaryDto> {
    const userIdObj = new Types.ObjectId(userId);

    const surveys = await this.trackSurveyModel
      .find({ userId: userIdObj })
      .sort({ surveyWeek: -1 })
      .limit(2)
      .lean();

    if (surveys.length === 0) {
      throw new NotFoundException('No surveys found');
    }

    const personalBests = await this.getPersonalBests(userId);
    const allSurveys = await this.trackSurveyModel
      .find({ userId: userIdObj })
      .lean();

    const totalSavings = allSurveys.reduce(
      (acc, survey) => ({
        co2: acc.co2 + survey.calculatedSavings.co2_savings,
        cost: acc.cost + survey.calculatedSavings.cost_savings,
        food: acc.food + survey.calculatedSavings.food_saved,
      }),
      { co2: 0, cost: 0, food: 0 },
    );

    return {
      current_week: surveys[0].calculatedSavings,
      previous_week: surveys[1]?.calculatedSavings || null,
      personal_bests: {
        ...personalBests,
        currency_symbol: surveys[0].calculatedSavings.currency_symbol ?? '₹',
      },
      total_surveys: allSurveys.length,
      total_co2_saved: totalSavings.co2,
      total_cost_saved: totalSavings.cost,
      total_food_saved: totalSavings.food,
    };
  }

  private toResponseDto(doc: any): TrackSurveyResponseDto {
    return {
      _id: doc._id.toString(),
      userId: doc.userId.toString(),
      cookingFrequency: doc.cookingFrequency,
      scraps: doc.scraps,
      uneatenLeftovers: doc.uneatenLeftovers,
      produceWaste: doc.produceWaste,
      preferredIngredients: doc.preferredIngredients,
      noOfCooks: doc.noOfCooks,
      calculatedSavings: doc.calculatedSavings,
      isBaseline: doc.isBaseline,
      surveyWeek: doc.surveyWeek,
      surveyDay: doc.surveyDay,
      isCo2PersonalBest: doc.isCo2PersonalBest,
      isCostPersonalBest: doc.isCostPersonalBest,
      isFoodSavedPersonalBest: doc.isFoodSavedPersonalBest,
      completedAt: doc.completedAt,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}
