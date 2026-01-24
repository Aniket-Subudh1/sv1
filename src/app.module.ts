import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { RedisModule } from './redis/redis.module';
import { UserModule } from './modules/user/user.module';
import { HackModule } from './modules/hack/hack.module';
import { ImageUploadModule } from './modules/image-upload/image-upload.module';
import { IngredientsModule } from './modules/ingredients/ingredients.module';
import { StickerModule } from './modules/sticker/sticker.module';
import { SponsersModule } from './modules/sponsers/sponsers.module';
import { AdminModule } from './modules/admin/admin.module';
import { HackOrTipModule } from './modules/hack-or-tip/hack-or-tip.module';
import { CommunityGroupsModule } from './modules/community-groups/community-groups.module';
import { DietModule } from './modules/diet/diet.module';
import { FoodFactModule } from './modules/food-fact/food-fact.module';
import { RecipeModule } from './modules/recipe/recipe.module';
import { FrameworkCategoryModule } from './modules/framework-category/framework-category.module';
import { AnalyticsService } from './modules/analytics/analytics.service';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { FeedbackModule } from './modules/feedback/feedback.module';
import { FavouriteModule } from './modules/favourite/favourite.module';
import { BadgesModule } from './modules/badges/badges.module';
import { ShoppingListModule } from './modules/shopping-list/shopping-list.module';
import { TrackSurveyModule } from './modules/track-survey/track-survey.module';
import {EventEmitterModule} from "@nestjs/event-emitter"
import { WinstonModule, WINSTON_MODULE_PROVIDER } from 'nest-winston';
import createWinstonLogger from './logger';
import { SqsModule } from './sqs/sqs.module';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    WinstonModule.forRoot({
      instance: createWinstonLogger(),
    }),
    EventEmitterModule.forRoot(),
    DatabaseModule,
    AuthModule,
    RedisModule,
    UserModule,
    HackModule,
    ImageUploadModule,
    IngredientsModule,
    DietModule,
    StickerModule,
    SponsersModule,
    AdminModule,
    HackOrTipModule,
    CommunityGroupsModule,
    FoodFactModule,
    RecipeModule,
    FrameworkCategoryModule,
    AnalyticsModule,
    FeedbackModule,
    FavouriteModule,
    BadgesModule,
    ShoppingListModule,
    TrackSurveyModule,
    SqsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}



