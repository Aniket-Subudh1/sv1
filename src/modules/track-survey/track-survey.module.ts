import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TrackSurveyService } from './track-survey.service';
import { TrackSurveyController } from './track-survey.controller';
import {
  TrackSurvey,
  TrackSurveySchema,
} from 'src/database/schemas/track-survey.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TrackSurvey.name, schema: TrackSurveySchema },
    ]),
  ],
  controllers: [TrackSurveyController],
  providers: [TrackSurveyService],
  exports: [TrackSurveyService],
})
export class TrackSurveyModule {}
