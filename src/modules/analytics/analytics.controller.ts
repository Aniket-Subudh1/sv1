import { Body, Controller, Get, Post, Query, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { GetUser } from 'src/common/decorators/Get.user.decorator';
import { SaveFoodDto } from './dto/savefood.dto';
import { GetLeaderboardDto } from './dto/leaderboard.dto';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async saveFood(@Body() dto: SaveFoodDto, @GetUser() user: any) {
    try {
      const userId = user.userId;
      const result = await this.analyticsService.saveFood(userId, dto.ingredinatsIds, dto.frameworkId, dto.ingredients);
      return result;
    } catch (error) {
      throw error;
    }
  }

  @Get('cooked-recipes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getCookedRecipes(@GetUser() user: any) {
    const userId = user.userId;
    if (!userId) throw new UnauthorizedException();
    return this.analyticsService.getUserCookedRecipes(userId);
  }

  @Get('cooked-recipes/details')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getCookedRecipesDetails(@GetUser() user: any) {
    const userId = user.userId;
    if (!userId) throw new UnauthorizedException();
    return this.analyticsService.getUserCookedRecipesDetails(userId);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getStats(@GetUser() user: any) {
    const userId = user.userId;
    if (!userId) throw new UnauthorizedException();
    return this.analyticsService.getStats(userId);
  }

  @Get('trending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getTrending(@GetUser() user: any, @Query('country') country?: string) {
    return this.analyticsService.getTrendingRecipes(5, country);
  }

  @Get('leaderboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getLeaderboard(@Query() query: GetLeaderboardDto) {
    return this.analyticsService.getLeaderboard({
      period: query.period,
      metric: query.metric,
      limit: query.limit,
      offset: query.offset,
      country: query.country,
      stateCode: query.stateCode,
    });
  }

  @Get('leaderboard/my-rank')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getMyRank(@Query() query: GetLeaderboardDto, @GetUser() user: any) {
    const userId = user.userId;
    if (!userId) throw new UnauthorizedException();
    return this.analyticsService.getUserRank(userId, {
      period: query.period,
      metric: query.metric,
    });
  }

  @Get('leaderboard/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getLeaderboardStats() {
    return this.analyticsService.getLeaderboardStats();
  }

  @Get('recipe-rating-stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getRecipeRatingStats(@Query('framework_id') frameworkId: string) {
    return this.analyticsService.getRecipeRatingStats(frameworkId);
  }
}
