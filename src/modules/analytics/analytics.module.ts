import { Global, Module, forwardRef } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsListner } from './analytics.listener';
import { AppSessionListener } from './app-session.listener';
import { MongooseModule } from '@nestjs/mongoose';
import { UserFoodAnalyticalProfileSchema, UserFoodAnalyticsProfile } from 'src/database/schemas/user.food.analyticsProfile.schema';
import { Ingredient, IngredientSchema } from 'src/database/schemas/ingredient.schema';
import { CommunityGroups, CommunityGroupSchema } from 'src/database/schemas/community.groups.schema';
import { CommunityGroupMember, CommunityGroupMemberSchema } from 'src/database/schemas/CommunityGroupMember.schema';
import { CommunityChallenge, CommunityChallengesSchema } from 'src/database/schemas/challenge.schema';
import { CommunityChallengeParticipant, CommunityChallengeParticipantSchema } from 'src/database/schemas/challenge.members.schema';
import { Recipe, RecipeSchema } from 'src/database/schemas/recipe.schema';
import { Feedback, FeedbackSchema } from 'src/database/schemas/feedback.schema';
import { BadgesModule } from '../badges/badges.module';
import { User,UserSchema } from 'src/database/schemas/user.auth.schema';
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      {name:UserFoodAnalyticsProfile.name,schema:UserFoodAnalyticalProfileSchema},
      {name:Ingredient.name,schema:IngredientSchema},
      {name:CommunityGroups.name,schema:CommunityGroupSchema},
      {name:CommunityGroupMember.name,schema:CommunityGroupMemberSchema},
      {name:CommunityChallenge.name,schema:CommunityChallengesSchema},
      {name:CommunityChallengeParticipant.name,schema:CommunityChallengeParticipantSchema},
      {name:Recipe.name,schema:RecipeSchema},
      {name:Feedback.name,schema:FeedbackSchema},
      {name:User.name,schema:UserSchema},
    ]),
    forwardRef(() => BadgesModule),
  ],
  providers: [AnalyticsService,AnalyticsListner, AppSessionListener],
  controllers: [AnalyticsController],
  exports:[]
})
export class AnalyticsModule {}
