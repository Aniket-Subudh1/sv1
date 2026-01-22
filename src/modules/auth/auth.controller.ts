import { Controller, Post, Get, Put, Body, UseGuards, Logger } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterUserDto } from './dto/user.register.dto';
import { UserLoginDto } from './dto/user.login.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { GetUser } from 'src/common/decorators/Get.user.decorator';
import { UserRole } from 'src/database/schemas/user.auth.schema';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/role.decorators';
import { CreateChefDto } from '../admin/dto/create-chef.dto';
import { AdminService } from '../admin/admin.service';
import { UserService } from '../user/user.service';
import { UserProfileDto } from '../user/dto/user.profile.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  
  constructor(
    private readonly authservice: AuthService,
    private readonly adminService: AdminService,
    private readonly userService: UserService,
  ) {}

  @Post('request-otp')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 3600 } }) // 10 requests per hour per IP
  async requestOTP(@Body() dto: RequestOtpDto) {
    this.logger.log(`🔷 POST /auth/request-otp - Email: ${dto.email}`);
    try {
      const result = await this.authservice.requestOTP(dto);
      this.logger.log(`✅ OTP request successful for ${dto.email}`);
      return result;
    } catch (error) {
      this.logger.error(`❌ OTP request failed for ${dto.email}: ${error.message}`);
      throw error;
    }
  }

  @Post('verify-otp')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 3600 } }) // 20 attempts per hour per IP
  async verifyOTP(@Body() dto: VerifyOtpDto) {
    return this.authservice.verifyOTP(dto);
  }

  @Post('')
  async register(@Body('') dto: RegisterUserDto) {
    return this.authservice.register(dto);
  }

  @Post('signup')
  async signup(@Body('') dto: RegisterUserDto) {
    return this.authservice.register(dto);
  }

  @Post('login')
  async Login(@Body('') dto: UserLoginDto) {
    return this.authservice.login(dto);
  }

  @Post('refresh')
  async refreshToken(@Body('refreshToken') refreshToken: string) {
    return this.authservice.refreshToken(refreshToken);
  }

  @Post('admin/login')
  async adminLogin(@Body('') dto: UserLoginDto) {
    return this.authservice.loginWithRole(dto, UserRole.ADMIN);
  }

  @Post('chef/login')
  async chefLogin(@Body('') dto: UserLoginDto) {
    return this.authservice.loginWithRole(dto, UserRole.CHEF);
  }

  @Post('chef/create')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async createChef(@Body() dto: CreateChefDto) {
    return this.adminService.createChef(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@GetUser() user:any) {
    return this.authservice.getProfile(user.userId);
    
  }

  @Put('dietary-profile')
  @UseGuards(JwtAuthGuard)
  async updateDietaryProfile(@Body() dto: UserProfileDto, @GetUser() user: any) {
    return this.userService.updateProfile(dto, user.userId);
  }
}
