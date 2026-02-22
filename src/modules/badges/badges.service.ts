import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Badge, BadgeDocument, BadgeCategory, MilestoneType, MetricType } from '../../database/schemas/badge.schema';
import { UserBadge, UserBadgeDocument } from '../../database/schemas/user-badge.schema';
import { UserFoodAnalyticsProfile, UserFoodAnalyticalProfileDocument } from '../../database/schemas/user.food.analyticsProfile.schema';
import { CreateBadgeDto } from './dto/create-badge.dto';
import { UpdateBadgeDto } from './dto/update-badge.dto';
import { AwardBadgeDto } from './dto/award-badge.dto';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class BadgesService {
  private readonly logger = new Logger(BadgesService.name);

  constructor(
    @InjectModel(Badge.name)
    private readonly badgeModel: Model<BadgeDocument>,
    @InjectModel(UserBadge.name)
    private readonly userBadgeModel: Model<UserBadgeDocument>,
    @InjectModel(UserFoodAnalyticsProfile.name)
    private readonly userAnalyticsModel: Model<UserFoodAnalyticalProfileDocument>,
  ) {}

  // ===========================
  // BADGE CRUD OPERATIONS
  // ===========================

  async createBadge(dto: CreateBadgeDto): Promise<Badge> {
    const badge = await this.badgeModel.create(dto);
    this.logger.log(`Badge created: ${badge.name} (${badge._id})`);
    return badge;
  }

  async getAllBadges(includeInactive = false): Promise<Badge[]> {
    const filter: any = { isDeleted: false };
    if (!includeInactive) {
      filter.isActive = true;
    }
    return this.badgeModel.find(filter).sort({ category: 1, milestoneThreshold: 1, rarityScore: -1 }).lean();
  }

  async getBadgesByCategory(category: BadgeCategory): Promise<Badge[]> {
    return this.badgeModel.find({
      category,
      isActive: true,
      isDeleted: false,
    }).sort({ milestoneThreshold: 1 }).lean();
  }

  async getSponsorBadges(country?: string): Promise<Badge[]> {
    const filter: any = {
      isSponsorBadge: true,
      isActive: true,
      isDeleted: false,
      $or: [
        { sponsorValidUntil: { $exists: false } },
        { sponsorValidUntil: { $gte: new Date() } },
      ],
    };

    if (country) {
      filter.sponsorCountries = country;
    }

    return this.badgeModel.find(filter).sort({ sponsorValidFrom: -1 }).lean();
  }

  async getBadgeStats() {
    const [totalBadges, activeBadges, totalAwarded, uniqueRecipients] = await Promise.all([
      this.badgeModel.countDocuments({ isDeleted: false }),
      this.badgeModel.countDocuments({ isDeleted: false, isActive: true }),
      this.userBadgeModel.countDocuments(),
      this.userBadgeModel.distinct('userId').then(users => users.length),
    ]);

    const badgesByCategory = await this.badgeModel.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);

    const categoryStats = badgesByCategory.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalBadges,
      activeBadges,
      onboardingBadges: categoryStats[BadgeCategory.ONBOARDING] || 0,
      usageBadges: categoryStats[BadgeCategory.USAGE] || 0,
      cookingBadges: categoryStats[BadgeCategory.COOKING] || 0,
      moneySavedBadges: categoryStats[BadgeCategory.MONEY_SAVED] || 0,
      foodSavedBadges: categoryStats[BadgeCategory.FOOD_SAVED] || 0,
      planningBadges: categoryStats[BadgeCategory.PLANNING] || 0,
      bonusBadges: categoryStats[BadgeCategory.BONUS] || 0,
      sponsorBadges: categoryStats[BadgeCategory.SPONSOR] || 0,
      challengeBadges: categoryStats[BadgeCategory.CHALLENGE_WINNER] || 0,
      specialBadges: categoryStats[BadgeCategory.SPECIAL] || 0,
      totalAwarded,
      uniqueRecipients,
    };
  }

  async getBadgeById(badgeId: string): Promise<Badge> {
    if (!Types.ObjectId.isValid(badgeId)) {
      throw new BadRequestException('Invalid badge ID');
    }

    const badge = await this.badgeModel.findOne({
      _id: new Types.ObjectId(badgeId),
      isDeleted: false,
    }).lean();

    if (!badge) {
      throw new NotFoundException('Badge not found');
    }

    return badge;
  }

  async updateBadge(badgeId: string, dto: UpdateBadgeDto): Promise<Badge> {
    if (!Types.ObjectId.isValid(badgeId)) {
      throw new BadRequestException('Invalid badge ID');
    }

    const badge = await this.badgeModel.findOneAndUpdate(
      { _id: new Types.ObjectId(badgeId), isDeleted: false },
      { $set: dto },
      { new: true },
    ).lean();

    if (!badge) {
      throw new NotFoundException('Badge not found');
    }

    this.logger.log(`Badge updated: ${badge.name} (${badge._id})`);
    return badge;
  }

  async deleteBadge(badgeId: string): Promise<{ message: string }> {
    if (!Types.ObjectId.isValid(badgeId)) {
      throw new BadRequestException('Invalid badge ID');
    }

    const result = await this.badgeModel.findOneAndUpdate(
      { _id: new Types.ObjectId(badgeId) },
      { $set: { isDeleted: true, isActive: false } },
      { new: true },
    );

    if (!result) {
      throw new NotFoundException('Badge not found');
    }

    this.logger.log(`Badge deleted: ${result.name} (${result._id})`);
    return { message: 'Badge deleted successfully' };
  }

  // ===========================
  // BADGE AWARDING
  // ===========================

  async awardBadge(dto: AwardBadgeDto): Promise<UserBadge> {
    if (!Types.ObjectId.isValid(dto.userId) || !Types.ObjectId.isValid(dto.badgeId)) {
      throw new BadRequestException('Invalid user or badge ID');
    }

    const badge = await this.badgeModel.findOne({
      _id: new Types.ObjectId(dto.badgeId),
      isActive: true,
      isDeleted: false,
    });

    if (!badge) {
      throw new NotFoundException('Badge not found or inactive');
    }

    const existingBadge = await this.userBadgeModel.findOne({
      userId: new Types.ObjectId(dto.userId),
      badgeId: new Types.ObjectId(dto.badgeId),
    });

    if (existingBadge) {
      throw new ConflictException('User already has this badge');
    }

    const userBadge = await this.userBadgeModel.create({
      userId: new Types.ObjectId(dto.userId),
      badgeId: new Types.ObjectId(dto.badgeId),
      achievedValue: dto.achievedValue,
      metadata: dto.metadata,
    });

    this.logger.log(`Badge awarded: ${badge.name} to user ${dto.userId}`);
    return userBadge;
  }

  async revokeBadge(userId: string, badgeId: string): Promise<{ message: string }> {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(badgeId)) {
      throw new BadRequestException('Invalid user or badge ID');
    }

    const result = await this.userBadgeModel.findOneAndDelete({
      userId: new Types.ObjectId(userId),
      badgeId: new Types.ObjectId(badgeId),
    });

    if (!result) {
      throw new NotFoundException('User badge not found');
    }

    this.logger.log(`Badge revoked: ${badgeId} from user ${userId}`);
    return { message: 'Badge revoked successfully' };
  }

  async awardBadgeToMultipleUsers(
    userIds: string[],
    badgeId: string,
    metadata?: any,
  ): Promise<{ successCount: number; failedUsers: string[]; awardedBadges: UserBadge[] }> {
    if (!Types.ObjectId.isValid(badgeId)) {
      throw new BadRequestException('Invalid badge ID');
    }

    const badge = await this.badgeModel.findOne({
      _id: new Types.ObjectId(badgeId),
      isActive: true,
      isDeleted: false,
    });

    if (!badge) {
      throw new NotFoundException('Badge not found or inactive');
    }

    const awardedBadges: UserBadge[] = [];
    const failedUsers: string[] = [];

    for (const userId of userIds) {
      try {
        const userBadge = await this.awardBadge({
          userId,
          badgeId,
          metadata,
        });
        awardedBadges.push(userBadge);
      } catch (error) {
        this.logger.warn(`Failed to award badge to user ${userId}:`, error.message);
        failedUsers.push(userId);
      }
    }

    this.logger.log(`Bulk award complete: ${awardedBadges.length} successful, ${failedUsers.length} failed`);
    
    return {
      successCount: awardedBadges.length,
      failedUsers,
      awardedBadges,
    };
  }

  async awardChallengeWinnerBadge(
    challengeId: string,
    challengeName: string,
    userId: string,
    rank: number,
    totalParticipants: number,
    mealsCompleted: number,
  ): Promise<UserBadge | null> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const challengeBadge = await this.badgeModel.findOne({
      category: BadgeCategory.CHALLENGE_WINNER,
      isActive: true,
      isDeleted: false,
    }).sort({ rarityScore: -1 });

    if (!challengeBadge) {
      this.logger.warn(`No challenge winner badge found for challenge ${challengeId}`);
      return null;
    }

    const existingBadge = await this.userBadgeModel.findOne({
      userId: new Types.ObjectId(userId),
      badgeId: challengeBadge._id,
      'metadata.challengeId': challengeId,
    });

    if (existingBadge) {
      this.logger.warn(`User ${userId} already has badge for challenge ${challengeId}`);
      return null;
    }

    const metadata = {
      challengeId,
      challengeName,
      rank,
      totalParticipants,
      mealsCompleted,
      period: new Date().toISOString(),
    };

    try {
      const userBadge = await this.awardBadge({
        userId: userId.toString(),
        badgeId: challengeBadge._id.toString(),
        achievedValue: mealsCompleted,
        metadata,
      });

      this.logger.log(`Challenge winner badge awarded to user ${userId} for challenge ${challengeId} (rank ${rank})`);
      return userBadge;
    } catch (error) {
      if (error instanceof ConflictException) {
        return null;
      }
      throw error;
    }
  }


  async getUserBadges(userId: string): Promise<any[]> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const userBadges = await this.userBadgeModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate('badgeId')
      .sort({ earnedAt: -1 })
      .lean();

    return userBadges;
  }

  async getUserBadgeStats(userId: string): Promise<{
    totalBadges: number;
    badgesByCategory: Record<string, number>;
    recentBadges: any[];
    unviewedCount: number;
    progressToNextBadges: any[];
  }> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const userBadges = await this.userBadgeModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate('badgeId')
      .lean();

    const badgesByCategory: Record<string, number> = {};
    userBadges.forEach((ub: any) => {
      const category = ub.badgeId?.category || 'UNKNOWN';
      badgesByCategory[category] = (badgesByCategory[category] || 0) + 1;
    });

    const recentBadges = userBadges.slice(0, 5);
    const unviewedCount = userBadges.filter(ub => !ub.isViewed).length;
    
    const progressToNextBadges = await this.getUserBadgeProgress(userId);

    return {
      totalBadges: userBadges.length,
      badgesByCategory,
      recentBadges,
      unviewedCount,
      progressToNextBadges,
    };
  }

  async markBadgeAsViewed(userId: string, badgeId: string): Promise<void> {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(badgeId)) {
      throw new BadRequestException('Invalid user or badge ID');
    }

    await this.userBadgeModel.updateOne(
      {
        userId: new Types.ObjectId(userId),
        badgeId: new Types.ObjectId(badgeId),
      },
      { $set: { isViewed: true } },
    );
  }



  async checkAndAwardBadges(userId: string, userCountry?: string): Promise<UserBadge[]> {
    const newBadges: UserBadge[] = [];

    const analytics = await this.userAnalyticsModel.findOne({
      userId: new Types.ObjectId(userId),
    });

    if (!analytics) {
      this.logger.warn(`No analytics found for user ${userId}`);
      return newBadges;
    }

    const activeBadges = await this.badgeModel.find({
      isActive: true,
      isDeleted: false,
      $or: [
        { isSponsorBadge: false },
        { isSponsorBadge: true, sponsorCountries: userCountry || { $exists: true } },
      ],
    });

    const existingBadgeIds = await this.userBadgeModel
      .find({ userId: new Types.ObjectId(userId) })
      .distinct('badgeId');

    const existingBadgeIdStrings = existingBadgeIds.map(id => id.toString());

    for (const badge of activeBadges) {
      if (existingBadgeIdStrings.includes(badge._id.toString())) {
        continue;
      }

      const shouldAward = await this.shouldAwardBadge(badge, analytics, userId, userCountry);

      if (shouldAward.award) {
        try {
          const userBadge = await this.awardBadge({
            userId: userId.toString(),
            badgeId: badge._id.toString(),
            achievedValue: shouldAward.achievedValue,
            metadata: shouldAward.metadata,
          });
          newBadges.push(userBadge);
        } catch (error) {
          this.logger.error(`Failed to award badge ${badge.name} to user ${userId}:`, error);
        }
      }
    }

    this.logger.log(`Awarded ${newBadges.length} new badges to user ${userId}`);
    return newBadges;
  }

  private async shouldAwardBadge(
    badge: Badge,
    analytics: UserFoodAnalyticalProfileDocument,
    userId: string,
    userCountry?: string,
  ): Promise<{ award: boolean; achievedValue?: number; metadata?: any }> {
    let achievedValue = 0;
    const metadata: any = {};

    if (badge.isSponsorBadge) {
      if (userCountry && badge.sponsorCountries && !badge.sponsorCountries.includes(userCountry)) {
        return { award: false };
      }
      if (badge.sponsorValidUntil && new Date() > badge.sponsorValidUntil) {
        return { award: false };
      }
      metadata.userCountry = userCountry;
      metadata.sponsorCampaignId = badge.sponsorMetadata?.campaignId;
    }

    switch (badge.metricType) {
      case MetricType.RECIPES_COOKED:
        achievedValue = analytics.numberOfMealsCooked || 0;
        if (achievedValue >= (badge.milestoneThreshold || 0)) {
          metadata.metricType = MetricType.RECIPES_COOKED;
          return { award: true, achievedValue, metadata };
        }
        break;

      case MetricType.APP_SESSIONS:
        achievedValue = (analytics as any).totalAppSessions || 0;
        if (achievedValue >= (badge.milestoneThreshold || 0)) {
          metadata.metricType = MetricType.APP_SESSIONS;
          return { award: true, achievedValue, metadata };
        }
        break;

      case MetricType.MONEY_SAVED_CUMULATIVE:
        // Use the actual stored totalMoneySaved (already in the user's local currency)
        // rather than recalculating from grams with a hardcoded per-kg rate.
        achievedValue = analytics.totalMoneySaved || 0;
        if (achievedValue >= (badge.milestoneThreshold || 0)) {
          metadata.metricType = MetricType.MONEY_SAVED_CUMULATIVE;
          return { award: true, achievedValue, metadata };
        }
        break;

      case MetricType.FOOD_WEIGHT_SAVED:
        achievedValue = (analytics.foodSavedInGrams || 0) / 1000; 
        if (achievedValue >= (badge.milestoneThreshold || 0)) {
          metadata.metricType = MetricType.FOOD_WEIGHT_SAVED;
          return { award: true, achievedValue, metadata };
        }
        break;

      case MetricType.SHOPPING_LISTS_CREATED:
        achievedValue = (analytics as any).shoppingListsCreated || 0;
        if (achievedValue >= (badge.milestoneThreshold || 0)) {
          metadata.metricType = MetricType.SHOPPING_LISTS_CREATED;
          return { award: true, achievedValue, metadata };
        }
        break;

      case MetricType.WEEKDAY_MEALS_COOKED:
        achievedValue = (analytics as any).weekdayMealsCooked || 0;
        if (achievedValue >= (badge.milestoneThreshold || 0)) {
          metadata.metricType = MetricType.WEEKDAY_MEALS_COOKED;
          return { award: true, achievedValue, metadata };
        }
        break;

      case MetricType.FIRST_EVENT:
        if (badge.milestoneType === MilestoneType.FIRST_RECIPE_COOKED) {
          achievedValue = analytics.numberOfMealsCooked || 0;
          if (achievedValue >= 1) {
            metadata.metricType = MetricType.FIRST_EVENT;
            return { award: true, achievedValue: 1, metadata };
          }
        } else if (badge.milestoneType === MilestoneType.FIRST_FOOD_SAVED) {
          achievedValue = analytics.foodSavedInGrams || 0;
          if (achievedValue > 0) {
            metadata.metricType = MetricType.FIRST_EVENT;
            return { award: true, achievedValue: 1, metadata };
          }
        }
        break;
    }

    return { award: false };
  }

  private calculateMoneySaved(gramsOfFoodSaved: number): number {
    const kgs = gramsOfFoodSaved / 1000;
    const avgCostPerKg = 7.5; 
    return Math.floor(kgs * avgCostPerKg);
  }

  async getUserBadgeProgress(userId: string): Promise<any[]> {
    const analytics = await this.userAnalyticsModel.findOne({
      userId: new Types.ObjectId(userId),
    });

    if (!analytics) {
      return [];
    }

    const existingBadgeIds = await this.userBadgeModel
      .find({ userId: new Types.ObjectId(userId) })
      .distinct('badgeId');

    const nextBadges = await this.badgeModel.find({
      _id: { $nin: existingBadgeIds },
      isActive: true,
      isDeleted: false,
      isSponsorBadge: false,
      metricType: { $exists: true },
    }).sort({ milestoneThreshold: 1 }).limit(5);

    const progress = nextBadges.map(badge => {
      let current = 0;
      let target = badge.milestoneThreshold || 0;

      switch (badge.metricType) {
        case MetricType.RECIPES_COOKED:
          current = analytics.numberOfMealsCooked || 0;
          break;
        case MetricType.FOOD_WEIGHT_SAVED:
          current = (analytics.foodSavedInGrams || 0) / 1000;
          break;
        case MetricType.MONEY_SAVED_CUMULATIVE:
          // Use actual stored money (local currency) rather than recalculating from grams
          current = analytics.totalMoneySaved || 0;
          break;
        case MetricType.APP_SESSIONS:
          current = (analytics as any).totalAppSessions || 0;
          break;
      }

      return {
        badge: {
          _id: badge._id,
          name: badge.name,
          description: badge.description,
          imageUrl: badge.imageUrl,
          category: badge.category,
        },
        current,
        target,
        percentage: target > 0 ? Math.min(100, Math.floor((current / target) * 100)) : 0,
      };
    });

    return progress;
  }


  async getBadgeLeaderboard(limit = 20): Promise<any[]> {
    const leaderboard = await this.userBadgeModel.aggregate([
      {
        $group: {
          _id: '$userId',
          badgeCount: { $sum: 1 },
          latestBadge: { $max: '$earnedAt' },
        },
      },
      {
        $lookup: {
          from: 'userauths',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $unwind: { path: '$user', preserveNullAndEmptyArrays: true },
      },
      {
        $sort: { badgeCount: -1, latestBadge: -1 },
      },
      {
        $limit: limit,
      },
      {
        $project: {
          rank: 0,
          userId: '$_id',
          userName: { $ifNull: ['$user.name', 'Unknown User'] },
          userEmail: '$user.email',
          badgeCount: 1,
          latestBadge: {
            awardedAt: '$latestBadge',
          },
        },
      },
    ]);

    return leaderboard.map((entry, index) => ({
      rank: index + 1,
      ...entry,
    }));
  }

  @OnEvent('recipe.cooked')
  async handleRecipeCooked(payload: { userId: string; recipeId: string }) {
    try {
      await this.checkAndAwardBadges(payload.userId);
    } catch (error) {
      this.logger.error(`Error checking badges after recipe cooked:`, error);
    }
  }

  @OnEvent('food.saved')
  async handleFoodSaved(payload: { userId: string; amount: number; country?: string }) {
    try {
      await this.checkAndAwardBadges(payload.userId, payload.country);
    } catch (error) {
      this.logger.error(`Error checking badges after food saved:`, error);
    }
  }

  @OnEvent('shopping-list.created')
  async handleShoppingListCreated(payload: { userId: string; listId: string }) {
    try {
      await this.checkAndAwardBadges(payload.userId);
    } catch (error) {
      this.logger.error(`Error checking badges after shopping list created:`, error);
    }
  }

  @OnEvent('app.session.incremented')
  async handleAppSessionIncremented(payload: { userId: string; country?: string }) {
    try {
      await this.checkAndAwardBadges(payload.userId, payload.country);
    } catch (error) {
      this.logger.error(`Error checking badges after session increment:`, error);
    }
  }
}
