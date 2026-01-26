import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserFoodAnalyticsProfile, UserFoodAnalyticalProfileDocument } from 'src/database/schemas/user.food.analyticsProfile.schema';

@Injectable()
export class AppSessionListener {
  private readonly logger = new Logger(AppSessionListener.name);

  constructor(
    @InjectModel(UserFoodAnalyticsProfile.name)
    private readonly profileModel: Model<UserFoodAnalyticalProfileDocument>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // Increment totalAppSessions when we detect a new app session
  @OnEvent('app.session', { async: true })
  async handleAppSession(payload: { userId: string }) {
    try {
      if (!payload?.userId) return;
      await this.profileModel.findOneAndUpdate(
        { userId: new Types.ObjectId(payload.userId) },
        { $inc: { totalAppSessions: 1 } },
        { upsert: true, new: true },
      );
      this.logger.log(`Incremented totalAppSessions for user ${payload.userId}`);
      // Emit a follow-up event so badges check runs after increment
      this.eventEmitter.emit('app.session.incremented', { userId: payload.userId });
    } catch (error) {
      this.logger.error(`Failed to increment totalAppSessions for user ${payload?.userId}: ${error?.message}`);
    }
  }
}
