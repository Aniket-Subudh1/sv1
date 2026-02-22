import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import OpenAI from "openai";
import {
  Ingredient,
  IngredientDocument,
} from 'src/database/schemas/ingredient.schema';
import { Feedback, FeedbackDocument } from 'src/database/schemas/feedback.schema';
import { Recipe, RecipeDocument } from 'src/database/schemas/recipe.schema';
import {
  UserFoodAnalyticalProfileDocument,
  UserFoodAnalyticsProfile,
} from 'src/database/schemas/user.food.analyticsProfile.schema';
import { User } from 'src/database/schemas/user.auth.schema';

export interface FoodSavedEvent {
  userId: string;
  foodSavedInGrams: number;
  ingredinatIds: string[];
  timestamp: Date;
  frameworkId?: string;  
  totalPriceInINR?: number; 
  totalCo2SavedInGrams?: number; 
}

export interface PriceCalculationResult {
  ingredient: string;
  weightInGrams: number;
  country: string;
  priceInINR: number;
}

export interface Co2CalculationResult {
  ingredient: string;
  weightInGrams: number;
  country: string;
  co2SavedKg: number;
}

@Injectable()
export class AnalyticsService {
   private readonly openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  constructor(
    @InjectModel(UserFoodAnalyticsProfile.name)
    private readonly userFoodAnallyticsProfileModel: Model<UserFoodAnalyticalProfileDocument>,
    @InjectModel(Ingredient.name)
    private readonly ingredinatModel: Model<IngredientDocument>,
    @InjectModel(Recipe.name)
    private readonly recipeModel: Model<RecipeDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
       @InjectModel(Feedback.name)
    private readonly feedbackModel: Model<FeedbackDocument>,
    private readonly eventEmmiter: EventEmitter2,
  ) {}
async saveFood(userId: string, ingredinatIds: string[], frameworkId?: string, directIngredients?: { name: string; averageWeight: number }[]) {
  try {
    // Load user first
    const user = await this.userModel.findOne({ _id: userId, role: "USER" }).lean();
    if (!user) throw new Error('User not found');
    const country = user.country || "India";

    let ingredinats: Array<{ name: string; averageWeight: number }>; 
    // Prefer DB lookup by IDs if provided
    if (ingredinatIds && ingredinatIds.length > 0) {
      const dbIngredients = await this.ingredinatModel.find({ _id: { $in: ingredinatIds } }).lean();
      ingredinats = dbIngredients.map(i => ({ name: i.name, averageWeight: i.averageWeight || 0 }));
    } else {
      // Fallback to direct payload from client
      ingredinats = (directIngredients || []).map(i => ({ name: i.name, averageWeight: i.averageWeight || 0 }));
    }

    if (!ingredinats.length) throw new Error('No ingredients found');

    const foodSavedInGrams = ingredinats.reduce((sum, i) => sum + (i.averageWeight || 0), 0);
    const ingredientNames = ingredinats.map(i => i.name).join(', ');

    // Run AI price calculations in parallel with error handling
    let aiResults: PriceCalculationResult[] = [];
    let totalPriceInINR: number = 0;
    let co2Results: Co2CalculationResult[] = [];
    let totalCo2SavedInGrams: number = 0;
    
    try {
      aiResults = await Promise.all(
        ingredinats.map(i => this.calculatePriceWithAI(i.name, i.averageWeight || 0, country))
      );
      totalPriceInINR = aiResults.reduce((sum, r) => sum + (r.priceInINR || 0), 0);

      co2Results = await Promise.all(
        ingredinats.map(i => this.calculateCo2SavedWithAI(i.name, i.averageWeight || 0, country))
      );
      totalCo2SavedInGrams = co2Results.reduce((sum, r) => sum + Math.max(0, (r.co2SavedKg || 0) * 1000), 0);
    } catch (aiError) {
      // If AI fails, continue without price calculation
      aiResults = ingredinats.map(i => ({
        ingredient: i.name,
        weightInGrams: i.averageWeight,
        country,
        priceInINR: 0
      }));
      co2Results = ingredinats.map(i => ({
        ingredient: i.name,
        weightInGrams: i.averageWeight,
        country,
        co2SavedKg: 0,
      }));
    }

    // Emit event to persist analytics
    this.eventEmmiter.emit('food.saved', {
      userId,
      foodSavedInGrams,
      ingredinatIds,
      timestamp: new Date(),
      frameworkId,
      totalPriceInINR,
      totalCo2SavedInGrams,
    });

    return {
      success: true,
      foodSavedInGrams,
      ingredientNames,
      country,
      totalPriceInINR,
      breakdown: aiResults,
      co2Breakdown: co2Results,
      totalCo2SavedInKg: Number((totalCo2SavedInGrams / 1000).toFixed(3)),
    };
  } catch (error) {
    throw error;
  }
}

//ai
  async calculatePriceWithAI(ingredientName: string, weightInGrams: number, country: string): Promise<PriceCalculationResult> {
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4.1",
        messages: [
          {
            role: "system",
            content: `You are a helpful AI assistant. You will calculate the price of food ingredients based on country and weight that either in english hindi or any language you need to get it based on country what is that in any cases may be typo is there. You MUST respond ONLY in JSON strictly`
          },
          {
            role: "user",
            content: `
Calculate or estimate the price of:
- ingredient: ${ingredientName}
- weight: ${weightInGrams} grams
- country: ${country}

Return strictly in JSON like:
{
  "ingredient": "...",
  "weightInGrams": 0,
  "country": "...",
  "priceInINR": 0
}
Convert price to INR always.
`
          }
        ],
        temperature: 0.2
      });

      const message = response.choices[0]?.message?.content;
      if (!message) {
        throw new Error("AI returned no content");
      }
      
      try {
        const parsed = JSON.parse(message);
        return parsed;
      } catch (parseError) {
        throw new Error(`Failed to parse AI response: ${parseError.message}`);
      }
    } catch (error) {
      return {
        ingredient: ingredientName,
        weightInGrams,
        country,
        priceInINR: 0
      };
    }
  }
  
  async calculateCo2SavedWithAI(ingredientName: string, weightInGrams: number, country: string): Promise<Co2CalculationResult> {
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4.1",
        messages: [
          {
            role: "system",
            content: `You are a helpful AI that estimates CO2e emissions avoided by preventing food waste or by cooking at home. Respond ONLY in strict JSON.`
          },
          {
            role: "user",
            content: `
Estimate the CO2e emissions avoided for:
- ingredient: ${ingredientName}
- weight: ${weightInGrams} grams
- country: ${country}

Return strictly JSON:
{
  "ingredient": "...",
  "weightInGrams": 0,
  "country": "...",
  "co2SavedKg": 0
}
Notes:
- Output is CO2e saved (kg), not produced.
- Consider typical farm-to-fork footprint and waste avoidance.
`
          }
        ],
        temperature: 0.2
      });

      const message = response.choices[0]?.message?.content;
      if (!message) {
        throw new Error("AI returned no content");
      }

      try {
        const parsed = JSON.parse(message);
        return parsed;
      } catch (parseError) {
        throw new Error(`Failed to parse AI response: ${parseError.message}`);
      }
    } catch (error) {
      return {
        ingredient: ingredientName,
        weightInGrams,
        country,
        co2SavedKg: 0,
      };
    }
  }
  

  async getUserCookedRecipes(userId: string) {
    const profile = await this.userFoodAnallyticsProfileModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .select('cookedRecipes numberOfMealsCooked')
      .lean();
    
    return { 
      cookedRecipes: profile?.cookedRecipes || [],
      numberOfMealsCooked: profile?.numberOfMealsCooked || 0,
    };
  }

  async getUserCookedRecipesDetails(userId: string) {
    const profile = await this.userFoodAnallyticsProfileModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .select('cookedRecipes')
      .lean();

    const cookedIds: string[] = profile?.cookedRecipes || [];

    if (!cookedIds.length) {
      return { cookedRecipes: [] };
    }

    const recipes = await this.recipeModel
      .find({ _id: { $in: cookedIds.map(id => new Types.ObjectId(id)) } })
      .select('title heroImageUrl shortDescription')
      .lean();

    const items = (recipes as any[]).map(r => ({
      id: r._id.toString(),
      title: r.title,
      shortDescription: r.shortDescription,
      heroImageUrl: r.heroImageUrl,
    }));

    // Preserve the recent ordering (last 3)
    const idOrder = cookedIds.slice(-3);
    const map = new Map(items.map(i => [i.id, i]));
    const orderedRecent = idOrder.map(id => map.get(id)).filter(Boolean);

    return { cookedRecipes: orderedRecent };
  }

  async getUserStats(userId: string) {
    const profile = await this.userFoodAnallyticsProfileModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .lean();

    if (!profile) {
      return {
        food_savings_user: '0',
        completed_meals_count: 0,
        best_food_savings: null,
        total_co2_savings: null,
        total_cost_savings: null,
        best_co2_savings: null,
        best_cost_savings: null,
      };
    }

    // Convert grams to kg for display
    const foodSavedInKg = (profile.foodSavedInGrams || 0) / 1000;
    const totalMoneySaved = Number(profile.totalMoneySaved || 0);
    const totalCo2SavedKg = Number((profile.totalCo2SavedInGrams || 0) / 1000);
    
    return {
      food_savings_user: foodSavedInKg.toFixed(2),
      completed_meals_count: profile.numberOfMealsCooked || 0,
      best_food_savings: null, // TODO: Track best savings
      total_co2_savings: totalCo2SavedKg.toFixed(2),
      // Return the accumulated money saved for the user.
      // Amount is computed based on the user's country during saveFood.
      total_cost_savings: totalMoneySaved.toFixed(2),
      best_co2_savings: null,
      best_cost_savings: null,
    };
  }

  async getTrendingRecipes(limit: number = 5, country?: string) {
    // Define current month range
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Aggregate feedbacks for current month with valid framework_id
    let results = await this.feedbackModel.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfMonth, $lt: endOfMonth },
          framework_id: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: '$framework_id',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);

    // Fallback to last 30 days if monthly has no results
    if (!results || results.length === 0) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      results = await this.feedbackModel.aggregate([
        {
          $match: {
            createdAt: { $gte: thirtyDaysAgo },
            framework_id: { $exists: true, $ne: null },
          },
        },
        {
          $group: {
            _id: '$framework_id',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: limit },
      ]);
    }

    const ids = results.map(r => r._id).filter(Boolean);
    if (!ids.length) return { trending: [] };

    // Build recipe filter: match IDs + optional country restriction
    const recipeFilter: any = { _id: { $in: ids.map(id => new Types.ObjectId(id)) } };
    if (country) {
      recipeFilter.$or = [
        { countries: { $size: 0 } },
        { countries: country },
      ];
    }

    const recipes = await this.recipeModel
      .find(recipeFilter)
      .select('title heroImageUrl shortDescription')
      .lean();

    const byId = new Map(recipes.map((r: any) => [r._id.toString(), r]));
    const trending = results
      .map(r => {
        const rec = byId.get(r._id);
        if (!rec) return null;
        return {
          id: rec._id.toString(),
          title: rec.title,
          shortDescription: rec.shortDescription,
          heroImageUrl: rec.heroImageUrl,
          count: r.count,
        };
      })
      .filter(Boolean);

    return { trending };
  }

  async getAllUsersStats() {
    const result = await this.userFoodAnallyticsProfileModel.aggregate([
      {
        $group: {
          _id: null,
          totalFoodSaved: { $sum: '$foodSavedInGrams' },
          totalMeals: { $sum: '$numberOfMealsCooked' },
        },
      },
    ]);

    const stats = result[0] || { totalFoodSaved: 0, totalMeals: 0 };
    const foodSavedInKg = stats.totalFoodSaved / 1000;

    return {
      food_savings_all_users: foodSavedInKg.toFixed(2),
      total_meals_all_users: stats.totalMeals,
    };
  }

  async getStats(userId: string) {
    const [userStats, allUsersStats] = await Promise.all([
      this.getUserStats(userId),
      this.getAllUsersStats(),
    ]);

    return {
      ...userStats,
      food_savings_all_users: allUsersStats.food_savings_all_users,
    };
  }

 
  async getLeaderboard(options: {
    period?: 'ALL_TIME' | 'YEARLY' | 'MONTHLY' | 'WEEKLY';
    metric?: 'MEALS_COOKED' | 'FOOD_SAVED' | 'MONEY_SAVED' | 'BADGES' | 'CO2_SAVED' | 'BOTH';
    limit?: number;
    offset?: number;
    country?: string;
    stateCode?: string;
  }) {
    const {
      period = 'ALL_TIME',
      metric = 'BOTH',
      limit = 20,
      offset = 0,
      country,
      stateCode,
    } = options;

    // Build date filter based on period
    let dateFilter: any = {};
    const now = new Date();

    if (period === 'WEEKLY') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      dateFilter = { updatedAt: { $gte: weekAgo } };
    } else if (period === 'MONTHLY') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = { updatedAt: { $gte: monthStart } };
    } else if (period === 'YEARLY') {
      const yearStart = new Date(now.getFullYear(), 0, 1);
      dateFilter = { updatedAt: { $gte: yearStart } };
    }

    // Build aggregation pipeline
    const pipeline: any[] = [
      // Join with users collection
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $unwind: '$user',
      },
    ];

    // Add date filter if needed (for non-ALL_TIME periods)
    if (Object.keys(dateFilter).length > 0) {
      pipeline.push({ $match: dateFilter });
    }

    // Add location filters if provided
    const matchConditions: any = {};
    if (country) {
      matchConditions['user.country'] = country;
    }
    if (stateCode) {
      matchConditions['user.stateCode'] = stateCode;
    }
    if (Object.keys(matchConditions).length > 0) {
      pipeline.push({ $match: matchConditions });
    }

    // Add sorting based on metric
    let sortField: any = {};
    if (metric === 'MEALS_COOKED') {
      sortField = { numberOfMealsCooked: -1 };
    } else if (metric === 'FOOD_SAVED') {
      sortField = { foodSavedInGrams: -1 };
    } else if (metric === 'MONEY_SAVED') {
      sortField = { totalMoneySaved: -1 };
    } else if (metric === 'BADGES') {
      // Will sort by badge count after lookup
      sortField = { badgeCount: -1 };
    } else if (metric === 'CO2_SAVED') {
      sortField = { totalCo2SavedInGrams: -1 };
    } else {
      pipeline.push({
        $addFields: {
          combinedScore: {
            $add: [
              '$numberOfMealsCooked',
              { $divide: ['$foodSavedInGrams', 1000] },
            ],
          },
        },
      });
      sortField = { combinedScore: -1 };
    }

    if (metric === 'BADGES') {
      pipeline.push({
        $lookup: {
          from: 'userbadges',
          localField: 'userId',
          foreignField: 'userId',
          as: 'badges',
        },
      });
      pipeline.push({
        $addFields: {
          badgeCount: { $size: '$badges' },
        },
      });
    }

    pipeline.push({ $sort: sortField });
    pipeline.push({ $skip: offset });
    pipeline.push({ $limit: limit });

    // Add badge lookup if not already done
    if (metric !== 'BADGES') {
      pipeline.push({
        $lookup: {
          from: 'userbadges',
          localField: 'userId',
          foreignField: 'userId',
          as: 'badges',
        },
      });
    }

    pipeline.push({
      $project: {
        rank: 1,
        userId: '$user._id',
        userName: '$user.name',
        country: '$user.country',
        stateCode: '$user.stateCode',
          numberOfMealsCooked: 1,
          foodSavedInGrams: 1,
          foodSavedInKg: { $divide: ['$foodSavedInGrams', 1000] },
          totalMoneySaved: 1,
          totalCo2SavedInGrams: { $ifNull: ['$totalCo2SavedInGrams', 0] },
          totalCo2SavedKg: { $divide: [{ $ifNull: ['$totalCo2SavedInGrams', 0] }, 1000] },
          badgeCount: { $size: '$badges' },
          combinedScore: 1,
          updatedAt: 1,
        },
      },
    );

    const results = await this.userFoodAnallyticsProfileModel.aggregate(pipeline);

    const countPipeline = pipeline.slice(0, -3);
    const totalCount = await this.userFoodAnallyticsProfileModel.aggregate([
      ...countPipeline,
      { $count: 'total' }
    ]);
    const totalEntries = totalCount.length > 0 ? totalCount[0].total : 0;

    const leaderboard = results.map((entry, index) => ({
      ...entry,
      rank: offset + index + 1,
      foodSavedInKg: Number(entry.foodSavedInKg.toFixed(2)),
      totalMoneySaved: Number((entry.totalMoneySaved || 0).toFixed(2)),
      totalCo2SavedInGrams: entry.totalCo2SavedInGrams || 0,
      totalCo2SavedKg: Number((entry.totalCo2SavedKg || 0).toFixed(2)),
    }));

    return {
      period,
      metric,
      limit,
      offset,
      filters: {
        country: country || 'all',
        stateCode: stateCode || 'all',
      },
      totalEntries,
      leaderboard,
    };
  }

 
  async getUserRank(userId: string, options: {
    period?: 'ALL_TIME' | 'YEARLY' | 'MONTHLY' | 'WEEKLY';
    metric?: 'MEALS_COOKED' | 'FOOD_SAVED' | 'BOTH';
  }) {
    const { period = 'ALL_TIME', metric = 'BOTH' } = options;

    const leaderboardData = await this.getLeaderboard({
      period,
      metric,
      limit: 1000, 
    });

   
    const userEntry = leaderboardData.leaderboard.find(
      (entry) => entry.userId.toString() === userId,
    );

    if (!userEntry) {
      return {
        found: false,
        message: 'User not found in leaderboard',
      };
    }

    const userIndex = leaderboardData.leaderboard.indexOf(userEntry);
    const surrounding = {
      above: leaderboardData.leaderboard.slice(
        Math.max(0, userIndex - 2),
        userIndex,
      ),
      current: userEntry,
      below: leaderboardData.leaderboard.slice(
        userIndex + 1,
        Math.min(leaderboardData.leaderboard.length, userIndex + 3),
      ),
    };

    return {
      found: true,
      rank: userEntry.rank,
      totalUsers: leaderboardData.totalEntries,
      percentile: ((1 - userEntry.rank / leaderboardData.totalEntries) * 100).toFixed(1),
      userStats: {
        mealsCooked: userEntry.numberOfMealsCooked,
        foodSaved: userEntry.foodSavedInKg,
        badgeCount: userEntry.badgeCount,
      },
      surrounding,
      period,
      metric,
    };
  }

  
  async getLeaderboardStats() {
    const [allTimeLeaders, monthlyLeaders, weeklyLeaders, totalActiveUsers] =
      await Promise.all([
        this.userFoodAnallyticsProfileModel
          .find()
          .sort({ numberOfMealsCooked: -1 })
          .limit(3)
          .populate('userId', 'name')
          .lean(),
        this.getLeaderboard({ period: 'MONTHLY', limit: 3 }),
        this.getLeaderboard({ period: 'WEEKLY', limit: 3 }),
        this.userFoodAnallyticsProfileModel.countDocuments({
          numberOfMealsCooked: { $gt: 0 },
        }),
      ]);

    return {
      totalActiveUsers,
      topAllTime: allTimeLeaders.map((leader, index) => ({
        rank: index + 1,
        userId: leader.userId,
        mealsCooked: leader.numberOfMealsCooked,
        foodSaved: (leader.foodSavedInGrams / 1000).toFixed(2),
      })),
      topMonthly: monthlyLeaders.leaderboard.slice(0, 3),
      topWeekly: weeklyLeaders.leaderboard.slice(0, 3),
    };
  }

  async getRecipeRatingStats(frameworkId: string): Promise<{
    totalRatings: number;
    averageRating: number;
    ratingDistribution: { rating: number; count: number; percentage: number }[];
  }> {
    if (!frameworkId) {
      return {
        totalRatings: 0,
        averageRating: 0,
        ratingDistribution: [
          { rating: 5, count: 0, percentage: 0 },
          { rating: 4, count: 0, percentage: 0 },
          { rating: 3, count: 0, percentage: 0 },
          { rating: 2, count: 0, percentage: 0 },
          { rating: 1, count: 0, percentage: 0 },
        ],
      };
    }

    const ratings = await this.feedbackModel
      .find({
        framework_id: frameworkId,
        'data.rating': { $exists: true, $ne: null },
      })
      .select('data.rating')
      .lean();

    const totalRatings = ratings.length;
    if (totalRatings === 0) {
      return {
        totalRatings: 0,
        averageRating: 0,
        ratingDistribution: [
          { rating: 5, count: 0, percentage: 0 },
          { rating: 4, count: 0, percentage: 0 },
          { rating: 3, count: 0, percentage: 0 },
          { rating: 2, count: 0, percentage: 0 },
          { rating: 1, count: 0, percentage: 0 },
        ],
      };
    }

    const distribution: Record<number, number> = ratings.reduce(
      (acc: Record<number, number>, r: any) => {
        const v = Number(r?.data?.rating) || 0;
        if (v >= 1 && v <= 5) acc[v] = (acc[v] || 0) + 1;
        return acc;
      },
      {},
    );

    const ratingDistribution = [5, 4, 3, 2, 1].map(r => ({
      rating: r,
      count: distribution[r] || 0,
      percentage: Math.round(((distribution[r] || 0) / totalRatings) * 100),
    }));

    const sumRatings = ratings.reduce(
      (sum: number, r: any) => sum + (Number(r?.data?.rating) || 0),
      0,
    );
    const averageRating = Math.round((sumRatings / totalRatings) * 10) / 10;

    return {
      totalRatings,
      averageRating,
      ratingDistribution,
    };
  }
}
