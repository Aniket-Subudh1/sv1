import {
  Controller,
  Body,
  Get,
  Put,
  Delete,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Param,
  Patch,
} from '@nestjs/common';
import { IngredientsService } from './ingredients.service';
import { CreateCatgoryDto } from './dto/ingrediants.category.dto';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { Roles } from 'src/common/decorators/role.decorators';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { FileFieldsInterceptor } from '@nestjs/platform-express';

@Controller('ingredients')
export class IngredientsController {
  constructor(private readonly ingrediantsService: IngredientsService) {}

  // Category endpoints
  @Post('category')
  @Roles('ADMIN', 'CHEF')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @UseInterceptors(FileFieldsInterceptor([{ name: 'image', maxCount: 1 }]))
  async createCategory(
    @Body() dto: CreateCatgoryDto,
    @UploadedFiles() files: { image: Express.Multer.File[] },
  ) {
    return this.ingrediantsService.create(dto, files);
  }

  @Get('category')
  async fetchCategory() {
    return this.ingrediantsService.getAllCategories();
  }

  @Patch('category/:id')
  @Roles('ADMIN', 'CHEF')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @UseInterceptors(FileFieldsInterceptor([{ name: 'image', maxCount: 1 }]))
  async updateCategory(
    @Param('id') id: string,
    @Body() dto: CreateCatgoryDto,
    @UploadedFiles() files: { image?: Express.Multer.File[] },
  ) {
    return this.ingrediantsService.updateCategory(id, dto, files);
  }

  @Delete('category/:id')
  @Roles('ADMIN', 'CHEF')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async deleteCategory(@Param('id') id: string) {
    return this.ingrediantsService.deleteCategory(id);
  }

  // Ingredient endpoints
  @Post()
  @Roles('ADMIN', 'CHEF')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'heroImage', maxCount: 1 }]),
  )
  async createIngredient(
    @Body() dto: CreateIngredientDto,
    @UploadedFiles() files: { heroImage?: Express.Multer.File[] },
  ) {
    return this.ingrediantsService.createIngredient(dto, files);
  }

  @Get()
  async getAllIngredients(@Query('country') country?: string) {
    return this.ingrediantsService.getAllIngredients(country);
  }

  @Get(':id')
  async getIngredientById(@Param('id') id: string) {
    return this.ingrediantsService.getIngredientById(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'CHEF')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'heroImage', maxCount: 1 }]),
  )
  async updateIngredient(
    @Param('id') id: string,
    @Body() dto: UpdateIngredientDto,
    @UploadedFiles() files: { heroImage?: Express.Multer.File[] },
  ) {
    return this.ingrediantsService.updateIngredient(id, dto, files);
  }

  @Delete(':id')
  @Roles('ADMIN', 'CHEF')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async deleteIngredient(@Param('id') id: string) {
    return this.ingrediantsService.deleteIngredient(id);
  }
}
