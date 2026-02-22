import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RecipeService } from './recipe.service';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { JwtAuthGuard } from './../../common/guards/jwt-auth.guard';
import { RolesGuard } from './../../common/guards/roles.guard';
import { Roles } from './../../common/decorators/role.decorators';
import { UserRole } from '../../database/schemas/user.auth.schema';
import { plainToClass } from 'class-transformer';
import { validate } from 'class-validator';

@Controller('api/recipe')
export class RecipeController {
  private readonly logger = new Logger(RecipeController.name);

  constructor(private readonly recipeService: RecipeService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CHEF)
  @UseInterceptors(FileInterceptor('heroImage'))
  async create(
    @Body() body: any,
    @UploadedFile() heroImage?: Express.Multer.File,
  ) {
    this.logger.log('Received recipe creation request');
    this.logger.debug('Raw body keys:', Object.keys(body));

    // Parse JSON strings from FormData
    const parsedBody = { ...body };

    // Parse arrays that come as JSON strings
    const jsonFields = [
      'components',
      'frameworkCategories',
      'hackOrTipIds',
      'useLeftoversIn',
    ];

    for (const field of jsonFields) {
      if (typeof parsedBody[field] === 'string') {
        try {
          parsedBody[field] = JSON.parse(parsedBody[field]);
          this.logger.debug(
            `Parsed ${field}:`,
            JSON.stringify(parsedBody[field], null, 2),
          );
        } catch (error) {
          this.logger.error(`Failed to parse ${field}:`, error.message);
          throw new BadRequestException(
            `Invalid ${field} data: ${error.message}`,
          );
        }
      }
    }

    // Convert numeric strings
    if (typeof parsedBody.prepCookTime === 'string') {
      parsedBody.prepCookTime = parseInt(parsedBody.prepCookTime, 10);
    }
    if (typeof parsedBody.order === 'string') {
      parsedBody.order = parseInt(parsedBody.order, 10);
    }

    // Convert boolean strings
    if (typeof parsedBody.isActive === 'string') {
      parsedBody.isActive = parsedBody.isActive === 'true';
    }

    this.logger.debug('Parsed body:', JSON.stringify(parsedBody, null, 2));
    if (Array.isArray(parsedBody.components)) {
      this.logger.debug(
        `Parsed components count: ${parsedBody.components.length}`,
      );
      const firstWrapper = parsedBody.components[0];
      this.logger.debug(
        'First wrapper keys:',
        Object.keys(firstWrapper || {}),
      );
      const innerList = Array.isArray(firstWrapper?.component)
        ? firstWrapper.component
        : Array.isArray(firstWrapper?.components)
        ? firstWrapper.components
        : [];
      this.logger.debug(
        `First wrapper component count: ${innerList.length}`,
      );
      if (innerList[0]) {
        this.logger.debug(
          'First component keys:',
          Object.keys(innerList[0]),
        );
      }
    }

    // Transform to DTO with proper class instantiation
    const createRecipeDto = plainToClass(CreateRecipeDto, parsedBody, {
      enableImplicitConversion: true,
      exposeDefaultValues: true,
    });

    this.logger.debug(
      'Transformed DTO:',
      JSON.stringify(createRecipeDto, null, 2),
    );
    if (Array.isArray(createRecipeDto.components)) {
      this.logger.debug(
        `DTO components count: ${createRecipeDto.components.length}`,
      );
      const firstWrapper = createRecipeDto.components[0] as any;
      const innerList = Array.isArray(firstWrapper?.component)
        ? firstWrapper.component
        : [];
      this.logger.debug(
        `DTO first wrapper component count: ${innerList.length}`,
      );
    }

    // Validate
    const errors = await validate(createRecipeDto, {
      whitelist: true,
      forbidNonWhitelisted: false,
    });

    if (errors.length > 0) {
      this.logger.error('Validation errors:', JSON.stringify(errors, null, 2));
      const errorMessages = errors.map((err) => ({
        property: err.property,
        constraints: err.constraints,
        children: err.children?.map((child) => ({
          property: child.property,
          constraints: child.constraints,
        })),
      }));
      throw new BadRequestException({
        message: 'Validation failed',
        errors: errorMessages,
      });
    }

    this.logger.log('Validation passed, creating recipe...');
    return this.recipeService.create(createRecipeDto, heroImage);
  }

  @Get()
  async findAll(@Query('country') country?: string) {
    return this.recipeService.findAll(country);
  }

  @Get('category/:categoryId')
  async findByCategory(
    @Param('categoryId') categoryId: string,
    @Query('country') country?: string,
  ) {
    return this.recipeService.findByFrameworkCategory(categoryId, country);
  }

  @Get('ingredient/:ingredientId')
  async findByIngredient(
    @Param('ingredientId') ingredientId: string,
    @Query('country') country?: string,
  ) {
    return this.recipeService.findByIngredient(ingredientId, country);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.recipeService.findOne(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CHEF)
  @UseInterceptors(FileInterceptor('heroImage'))
  async update(
    @Param('id') id: string,
    @Body() body: any,
    @UploadedFile() heroImage?: Express.Multer.File,
  ) {
    this.logger.log(`Received recipe update request for ID: ${id}`);
    this.logger.debug('Raw body keys:', Object.keys(body));

    // Same parsing logic as create
    const parsedBody = { ...body };

    const jsonFields = [
      'components',
      'frameworkCategories',
      'hackOrTipIds',
      'useLeftoversIn',
    ];

    for (const field of jsonFields) {
      if (
        parsedBody[field] !== undefined &&
        typeof parsedBody[field] === 'string'
      ) {
        try {
          parsedBody[field] = JSON.parse(parsedBody[field]);
          this.logger.debug(
            `Parsed ${field}:`,
            JSON.stringify(parsedBody[field], null, 2),
          );
        } catch (error) {
          this.logger.error(`Failed to parse ${field}:`, error.message);
          throw new BadRequestException(`Invalid ${field} data`);
        }
      }
    }

    if (typeof parsedBody.prepCookTime === 'string') {
      parsedBody.prepCookTime = parseInt(parsedBody.prepCookTime, 10);
    }
    if (typeof parsedBody.order === 'string') {
      parsedBody.order = parseInt(parsedBody.order, 10);
    }
    if (typeof parsedBody.isActive === 'string') {
      parsedBody.isActive = parsedBody.isActive === 'true';
    }

    this.logger.debug('Parsed body:', JSON.stringify(parsedBody, null, 2));

    const updateRecipeDto = plainToClass(UpdateRecipeDto, parsedBody, {
      enableImplicitConversion: true,
      exposeDefaultValues: true,
    });

    this.logger.debug(
      'Transformed DTO:',
      JSON.stringify(updateRecipeDto, null, 2),
    );

    // Validate
    const errors = await validate(updateRecipeDto, {
      whitelist: true,
      forbidNonWhitelisted: false,
    });

    if (errors.length > 0) {
      this.logger.error('Validation errors:', JSON.stringify(errors, null, 2));
      const errorMessages = errors.map((err) => ({
        property: err.property,
        constraints: err.constraints,
        children: err.children?.map((child) => ({
          property: child.property,
          constraints: child.constraints,
        })),
      }));
      throw new BadRequestException({
        message: 'Validation failed',
        errors: errorMessages,
      });
    }

    this.logger.log('Validation passed, updating recipe...');
    return this.recipeService.update(id, updateRecipeDto, heroImage);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CHEF)
  async remove(@Param('id') id: string) {
    await this.recipeService.remove(id);
    return { message: 'Recipe deleted successfully' };
  }
}