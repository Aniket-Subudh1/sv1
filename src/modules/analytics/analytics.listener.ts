import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  UserFoodAnalyticalProfileDocument,
  UserFoodAnalyticsProfile,
} from 'src/database/schemas/user.food.analyticsProfile.schema';
import {
  CommunityGroups,
  CommunityGroupDocument,
} from 'src/database/schemas/community.groups.schema';
import {
  CommunityGroupMember,
  CommunityGroupMemberDocument,
} from 'src/database/schemas/CommunityGroupMember.schema';
import {
  CommunityChallenge,
  CommunityChallengeDocument,
} from 'src/database/schemas/challenge.schema';
import {
  CommunityChallengeParticipant,
  CommunityChallengeParticipantDocument,
} from 'src/database/schemas/challenge.members.schema';
import { FoodSavedEvent } from './analytics.service';
import { OnEvent } from '@nestjs/event-emitter';
import { Types } from 'mongoose';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class AnalyticsListner {
  private readonly logger = new Logger(AnalyticsListner.name);
  constructor(
    @InjectModel(UserFoodAnalyticsProfile.name)
    private readonly profileModel: Model<UserFoodAnalyticalProfileDocument>,
    @InjectModel(CommunityGroups.name)
    private readonly communityGroupModel: Model<CommunityGroupDocument>,
    @InjectModel(CommunityGroupMember.name)
    private readonly communityGroupMemberModel: Model<CommunityGroupMemberDocument>,
    @InjectModel(CommunityChallenge.name)
    private readonly communityChallengeModel: Model<CommunityChallengeDocument>,
    @InjectModel(CommunityChallengeParticipant.name)
    private readonly challengeParticipantModel: Model<CommunityChallengeParticipantDocument>,
    private readonly redisService: RedisService,
  ) {
    this.logger.log('AnalyticsListener initialized and ready to receive events');
  }

  @OnEvent('food.saved', { async: true })
  async updateUserProfile(event: FoodSavedEvent) {
    try {
      this.logger.log(`[AnalyticsListener] Received food.saved event:`, JSON.stringify(event));
      
      // Prepare update operation
      const updateOperation: any = {
        $inc: {
          foodSavedInGrams: event.foodSavedInGrams,
          numberOfMealsCooked: 1,
          totalMoneySaved: event.totalPriceInLocalCurrency || 0,
          totalCo2SavedInGrams: event.totalCo2SavedInGrams || 0,
        },
      };

      // Add framework_id to cookedRecipes if provided
      if (event.frameworkId) {
        updateOperation.$addToSet = {
          cookedRecipes: event.frameworkId,
        };
        this.logger.log(`[AnalyticsListener] Adding frameworkId to cookedRecipes: ${event.frameworkId}`);
      } else {
        this.logger.warn('[AnalyticsListener] No frameworkId provided in event');
      }

      this.logger.log(`[AnalyticsListener] Updating profile with:`, JSON.stringify(updateOperation));

      // Update user analytics profile
      const result = await this.profileModel.findOneAndUpdate(
        { userId: new Types.ObjectId(event.userId) },
        updateOperation,
        { upsert: true, new: true },
      );
      
      this.logger.log(`[AnalyticsListener] Profile updated successfully for user ${event.userId}. New values: numberOfMealsCooked=${result.numberOfMealsCooked}, foodSavedInGrams=${result.foodSavedInGrams}`);

      // Update all community groups the user is a member of
      await this.updateCommunityGroups(event);

      // Update all active challenges the user is participating in
      await this.updateChallenges(event);
    } catch (error) {
      this.logger.error(
        `Failed to update profile: ${error.message}`,
        error.stack,
      );
    }
  }

  private async updateCommunityGroups(event: FoodSavedEvent) {
    try {
      // Find all groups where user is an active member
      const userMemberships = await this.communityGroupMemberModel
        .find({
          userId: new Types.ObjectId(event.userId),
          isActive: true,
        })
        .lean();

      if (userMemberships.length === 0) {
        return;
      }

      const groupIds = userMemberships.map((m) => m.groupId);

      // Update totalFoodSaved for all groups
      await this.communityGroupModel.updateMany(
        {
          _id: { $in: groupIds },
          isDeleted: false,
        },
        {
          $inc: {
            totalFoodSaved: event.foodSavedInGrams,
          },
        },
      );

      // Invalidate Redis cache for each updated group
      for (const groupId of groupIds) {
        const cacheKey = `community:group:${groupId.toString()}`;
        await this.redisService.del(cacheKey);
      }

      this.logger.log(
        `Updated ${groupIds.length} community groups for user ${event.userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update community groups: ${error.message}`,
        error.stack,
      );
    }
  }

  private async updateChallenges(event: FoodSavedEvent) {
    try {
      const now = new Date();

      // Find all groups where user is an active member
      const userGroups = await this.communityGroupMemberModel
        .find({
          userId: new Types.ObjectId(event.userId),
          isActive: true,
        })
        .select('groupId')
        .lean();

      if (userGroups.length === 0) {
        return;
      }

      const groupIds = userGroups.map(g => g.groupId);

      // Find all active challenges in those groups (currently within date range)
      const activeChallenges = await this.communityChallengeModel
        .find({
          communityId: { $in: groupIds },
          isDeleted: false,
          status: true,
          startDate: { $lte: now },
          endDate: { $gte: now },
        })
        .select('_id communityId')
        .lean();

      if (activeChallenges.length === 0) {
        return;
      }

      const activeChallengeIds = activeChallenges.map((ch: any) => ch._id);

      // Update totalFoodSaved for all active challenges
      await this.communityChallengeModel.updateMany(
        {
          _id: { $in: activeChallengeIds },
        },
        {
          $inc: {
            totalFoodSaved: event.foodSavedInGrams,
            totalMealsCompleted: 1,
          },
        },
      );

      // Ensure participant docs exist and increment counters per active challenge
      for (const challenge of activeChallenges) {
        await this.challengeParticipantModel.findOneAndUpdate(
          {
            userId: new Types.ObjectId(event.userId),
            challengeId: (challenge as any)._id,
            communityId: (challenge as any).communityId,
            isActive: true,
          },
          {
            $inc: {
              foodSaved: event.foodSavedInGrams,
              totalMealsCompleted: 1,
            },
          },
          {
            upsert: true,
            setDefaultsOnInsert: true,
          },
        );
      }

      // Invalidate Redis cache for each updated challenge
      for (const challengeId of activeChallengeIds) {
        const cacheKey = `community:challenge:single:${challengeId.toString()}`;
        await this.redisService.del(cacheKey);
        
        // Also invalidate the community's challenges list
        const challenge = await this.communityChallengeModel.findById(challengeId).select('communityId').lean();
        if (challenge) {
          const listCacheKey = `community:challenges:communityId:${challenge.communityId.toString()}`;
          await this.redisService.del(listCacheKey);
        }
      }

      this.logger.log(
        `Updated ${activeChallengeIds.length} challenges for user ${event.userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update challenges: ${error.message}`,
        error.stack,
      );
    }
  }
}



