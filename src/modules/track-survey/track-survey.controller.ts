import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { TrackSurveyService } from './track-survey.service';
import { CreateTrackSurveyDto } from './dto/create-track-survey.dto';
import { GetUser } from 'src/common/decorators/Get.user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@Controller('track-survey')
@UseGuards(JwtAuthGuard)
export class TrackSurveyController {
  constructor(private readonly trackSurveyService: TrackSurveyService) {}

  @Get('eligibility')
  async checkEligibility(@GetUser() user: any) {
    return this.trackSurveyService.checkEligibility(user.userId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createSurvey(
    @GetUser() user: any,
    @Body() createTrackSurveyDto: CreateTrackSurveyDto,
  ) {
    return this.trackSurveyService.createSurvey(
      user.userId,
      createTrackSurveyDto,
    );
  }

  @Get()
  async getUserSurveys(@GetUser() user: any) {
    return this.trackSurveyService.getUserSurveys(user.userId);
  }

  @Get('latest')
  async getLatestSurvey(@GetUser() user: any) {
    return this.trackSurveyService.getLatestSurvey(user.userId);
  }

  @Get('summary')
  async getWeeklySummary(@GetUser() user: any) {
    return this.trackSurveyService.getWeeklySummary(user.userId);
  }
}
