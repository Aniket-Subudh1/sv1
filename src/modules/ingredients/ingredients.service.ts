import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  IngredientsCategory,
  IngredientsCategoryDocument,
} from 'src/database/schemas/ingredinats.Category.schema';
import {
  Ingredient,
  IngredientDocument,
} from 'src/database/schemas/ingredient.schema';
import { RedisService } from 'src/redis/redis.service';
import { CreateCatgoryDto } from './dto/ingrediants.category.dto';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { ImageUploadService } from '../image-upload/image-upload.service';
import { SqsService } from 'src/sqs/sqs.service';
import { CacheInvalidationEvent } from 'src/contracts/cache-invalidation.event';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
@Injectable()
export class IngredientsService {
  private readonly logger = new Logger(IngredientsService.name);
  constructor(
    @InjectModel(IngredientsCategory.name)
    private readonly ingredinatsCategory: Model<IngredientsCategoryDocument>,
    @InjectModel(Ingredient.name)
    private readonly ingredientModel: Model<IngredientDocument>,
    private readonly redisService: RedisService,
    private readonly imageuploadService: ImageUploadService,
    private readonly sqsService:SqsService
    
  ) {}

  // Category Management
  async create(dto: CreateCatgoryDto, files: { image: Express.Multer.File[] }) {
    const existing = await this.ingredinatsCategory.findOne({ name: dto.name });
    console.log(existing);
    if (existing) throw new ConflictException('this categiry already exists');

    const categoryData: any = {
      name: dto.name,
    };

    if (files?.image?.[0]) {
      const imageUrl = await this.imageuploadService.uploadFile(
        files.image[0],
        'saveful/ingredinats-category',
      );
      categoryData.imageUrl = imageUrl;
    }

    const cachedKey = `Ingrediants:Category:all`;
    const result = await this.ingredinatsCategory.create(categoryData);
    await this.redisService.del(cachedKey);
    return result;
  }

  async getAllCategories() {
    const cachedKey = `Ingrediants:Category:all`;
    const cachedData = await this.redisService.get(cachedKey);
    if (cachedData) return JSON.parse(cachedData);
    const result = await this.ingredinatsCategory.find();
    await this.redisService.set(cachedKey, JSON.stringify(result), 60 * 20);
    return result;
  }

  async updateCategory(
    id: string,
    dto: CreateCatgoryDto,
    files?: { image?: Express.Multer.File[] },
  ) {
    const category = await this.ingredinatsCategory.findById(id);
    if (!category) throw new NotFoundException('Category not found');

    const updateData: any = {
      name: dto.name,
    };

    // Only update image if a new one is provided
    if (files?.image?.[0]) {
      const imageUrl = await this.imageuploadService.uploadFile(
        files.image[0],
        'saveful/ingredinats-category',
      );
      updateData.imageUrl = imageUrl;
    }

    const result = await this.ingredinatsCategory.findByIdAndUpdate(
      id,
      updateData,
      { new: true },
    );

    const cachedKey = `Ingrediants:Category:all`;
    await this.redisService.del(cachedKey);
    return result;
  }

  async deleteCategory(id: string) {
    const category = await this.ingredinatsCategory.findById(id);
    if (!category) throw new NotFoundException('Category not found');

    // Check if any ingredients use this category
    const ingredientsUsingCategory = await this.ingredientModel.countDocuments(
      { categoryId: new Types.ObjectId(id) },
    );

    if (ingredientsUsingCategory > 0) {
      throw new ConflictException(
        `Cannot delete category. ${ingredientsUsingCategory} ingredient(s) are using this category.`,
      );
    }

    await this.ingredinatsCategory.findByIdAndDelete(id);

    const cachedKey = `Ingrediants:Category:all`;
    await this.redisService.del(cachedKey);
    return { message: 'Category deleted successfully' };
  }

  async createIngredient(
    dto: CreateIngredientDto,
    files?: { heroImage?: Express.Multer.File[] },
  ) {
    const ingredientData: any = {
      name: dto.name,
      averageWeight: dto.averageWeight,
      categoryId: new Types.ObjectId(dto.categoryId),
      hasPage: dto.hasPage || false,
    };

    if (dto.suitableDiets && dto.suitableDiets.length > 0) {
      ingredientData.suitableDiets = dto.suitableDiets
        .filter((id) => Types.ObjectId.isValid(id))
        .map((id) => new Types.ObjectId(id));
    }

    if (dto.hasPage) {
      if (files?.heroImage?.[0]) {
        const heroImageUrl = await this.imageuploadService.uploadFile(
          files.heroImage[0],
          'saveful/ingredients/hero',
        );
        ingredientData.heroImageUrl = heroImageUrl;
      }

      if (dto.theme) ingredientData.theme = dto.theme;
      if (dto.description) ingredientData.description = dto.description;
      if (dto.nutrition) ingredientData.nutrition = dto.nutrition;

      if (dto.parentIngredients && dto.parentIngredients.length > 0) {
        ingredientData.parentIngredients = dto.parentIngredients
          .filter((id) => Types.ObjectId.isValid(id))
          .map((id) => new Types.ObjectId(id));
      }

      if (dto.sponsorId && Types.ObjectId.isValid(dto.sponsorId)) {
        ingredientData.sponsorId = new Types.ObjectId(dto.sponsorId);
      }

      if (dto.relatedHacks && dto.relatedHacks.length > 0) {
        ingredientData.relatedHacks = dto.relatedHacks
          .filter((id) => Types.ObjectId.isValid(id))
          .map((id) => new Types.ObjectId(id));
      }

      if (dto.inSeason && dto.inSeason.length > 0) {
        ingredientData.inSeason = dto.inSeason;
      }

      if (dto.stickerId && Types.ObjectId.isValid(dto.stickerId)) {
        ingredientData.stickerId = new Types.ObjectId(dto.stickerId);
      }

      if (dto.isPantryItem !== undefined) {
        ingredientData.isPantryItem = dto.isPantryItem;
      }
    }

    if (dto.order !== undefined) {
      ingredientData.order = dto.order;
    }

    if (dto.countries !== undefined) {
      ingredientData.countries = dto.countries;
    }

    const ingredient = await this.ingredientModel.create(ingredientData);
    
    // Invalidate cache with versioned strategy
    const ingredients = await this.ingredientModel
      .find()
      .populate('categoryId', 'name imageUrl')
      .populate('suitableDiets', 'name')
      .populate('parentIngredients', 'name')
      .populate('sponsorId', 'title logo')
      .populate('relatedHacks', 'title type')
      .populate('stickerId', 'title imageUrl')
      .sort({ order: 1, name: 1 })
      .lean();

    const { oldVersion, newVersion } = await this.redisService.setVersioned(
      'Ingredients:all',
      ingredients,
      60 * 20,
    );
    
    if (oldVersion > 0) {
      await this.sqsService.publishCacheInvalidation({
        eventType: 'CACHE_INVALIDATION',
        baseKey: 'Ingredients:all',
        invalidateVersions: [oldVersion],
        timestamp: Date.now(),
      });
      this.logger.log(
        `Cache invalidation pushed with version ${newVersion} for key Ingredients:all`,
      );
    }

    // Bust per-country caches so filtered results reflect the new data
    await this.redisService.delByPattern('Ingredients:all:country:*');

    return ingredient;
  }

  async getAllIngredients(country?: string) {
    const baseKey = country
      ? `Ingredients:all:country:${country.toLowerCase()}`
      : 'Ingredients:all';

    if (country) {
      const cachedData = await this.redisService.get(baseKey);
      if (cachedData) {
        this.logger.log(`Cache hit for ${baseKey}`);
        return JSON.parse(cachedData);
      }
      this.logger.warn(`Cache miss for ${baseKey}`);

      // Filter: empty countries array = globally available; or country matches
      const matchQuery: any = {
        $or: [
          { countries: { $size: 0 } },
          { countries: country },
        ],
      };

      const ingredients = await this.ingredientModel
        .find(matchQuery)
        .populate('categoryId', 'name imageUrl')
        .populate('suitableDiets', 'name')
        .populate('parentIngredients', 'name')
        .populate('sponsorId', 'title logo')
        .populate('relatedHacks', 'title type')
        .populate('stickerId', 'title imageUrl')
        .sort({ order: 1, name: 1 })
        .lean();

      await this.redisService.set(baseKey, JSON.stringify(ingredients), 60 * 20);
      return ingredients;
    }

    // No country filter — use existing versioned cache strategy
    const cachedIngrediants = await this.redisService.getVersioned(baseKey);

    if (cachedIngrediants) {
      console.log('cached hit for ingredinats:all');
      this.logger.log('Cache hit for Ingredients:all');
      return cachedIngrediants;
    }

    this.logger.warn('Cache miss for Ingredients:all');

    const ingredients = await this.ingredientModel
      .find()
      .populate('categoryId', 'name imageUrl')
      .populate('suitableDiets', 'name')
      .populate('parentIngredients', 'name')
      .populate('sponsorId', 'title logo')
      .populate('relatedHacks', 'title type')
      .populate('stickerId', 'title imageUrl')
      .sort({ order: 1, name: 1 })
      .lean();

    await this.redisService.setVersioned(baseKey, ingredients, 60 * 20);
    return ingredients;
  }

  async getIngredientById(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Invalid ingredient ID');
    }

    const ingredient = await this.ingredientModel
      .findById(id)
      .populate('categoryId', 'name imageUrl')
      .populate('suitableDiets', 'name')
      .populate('parentIngredients', 'name averageWeight')
      .populate('sponsorId', 'title logo logoBlackAndWhite broughtToYouBy tagline')
      .populate('relatedHacks', 'title type shortDescription')
      .populate('stickerId', 'title imageUrl description')
      .lean();

    if (!ingredient) {
      throw new NotFoundException('Ingredient not found');
    }

    return ingredient;
  }

  async updateIngredient(
    id: string,
    dto: UpdateIngredientDto,
    files?: { heroImage?: Express.Multer.File[] },
  ) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Invalid ingredient ID');
    }

    const ingredient = await this.ingredientModel.findById(id);
    if (!ingredient) {
      throw new NotFoundException('Ingredient not found');
    }

    const updateData: any = {};

    // Update basic fields
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.averageWeight !== undefined)
      updateData.averageWeight = dto.averageWeight;
    if (dto.hasPage !== undefined) updateData.hasPage = dto.hasPage;

    if (dto.categoryId && Types.ObjectId.isValid(dto.categoryId)) {
      updateData.categoryId = new Types.ObjectId(dto.categoryId);
    }

    if (dto.suitableDiets !== undefined) {
      updateData.suitableDiets = dto.suitableDiets
        .filter((id) => Types.ObjectId.isValid(id))
        .map((id) => new Types.ObjectId(id));
    }

    // Update hasPage related fields
    if (files?.heroImage?.[0]) {
      const heroImageUrl = await this.imageuploadService.uploadFile(
        files.heroImage[0],
        'saveful/ingredients/hero',
      );
      updateData.heroImageUrl = heroImageUrl;
    }

    if (dto.theme !== undefined) updateData.theme = dto.theme;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.nutrition !== undefined) updateData.nutrition = dto.nutrition;

    if (dto.parentIngredients !== undefined) {
      updateData.parentIngredients = dto.parentIngredients
        .filter((id) => Types.ObjectId.isValid(id))
        .map((id) => new Types.ObjectId(id));
    }

    if (dto.sponsorId !== undefined) {
      if (dto.sponsorId && Types.ObjectId.isValid(dto.sponsorId)) {
        updateData.sponsorId = new Types.ObjectId(dto.sponsorId);
      } else if (!dto.sponsorId) {
        updateData.sponsorId = null;
      }
    }

    if (dto.relatedHacks !== undefined) {
      updateData.relatedHacks = dto.relatedHacks
        .filter((id) => Types.ObjectId.isValid(id))
        .map((id) => new Types.ObjectId(id));
    }

    if (dto.inSeason !== undefined) {
      updateData.inSeason = dto.inSeason;
    }

    if (dto.stickerId !== undefined) {
      if (dto.stickerId && Types.ObjectId.isValid(dto.stickerId)) {
        updateData.stickerId = new Types.ObjectId(dto.stickerId);
      } else if (!dto.stickerId) {
        updateData.stickerId = null;
      }
    }

    if (dto.isPantryItem !== undefined) {
      updateData.isPantryItem = dto.isPantryItem;
    }

    if (dto.order !== undefined) {
      updateData.order = dto.order;
    }

    if (dto.countries !== undefined) {
      updateData.countries = dto.countries;
    }

    const updatedIngredient = await this.ingredientModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .populate('categoryId', 'name imageUrl')
      .populate('suitableDiets', 'name')
      .populate('parentIngredients', 'name')
      .populate('sponsorId', 'title logo')
      .populate('relatedHacks', 'title type')
      .populate('stickerId', 'title imageUrl');

    // Invalidate cache with versioned strategy
    const ingredients = await this.ingredientModel
      .find()
      .populate('categoryId', 'name imageUrl')
      .populate('suitableDiets', 'name')
      .populate('parentIngredients', 'name')
      .populate('sponsorId', 'title logo')
      .populate('relatedHacks', 'title type')
      .populate('stickerId', 'title imageUrl')
      .sort({ order: 1, name: 1 })
      .lean();

    // New caching strategy
    const { oldVersion, newVersion } = await this.redisService.setVersioned(
      'Ingredients:all',
      ingredients,
      60 * 20,
    );
    
    if (oldVersion > 0) {
      await this.sqsService.publishCacheInvalidation({
        eventType: 'CACHE_INVALIDATION',
        baseKey: 'Ingredients:all',
        invalidateVersions: [oldVersion],
        timestamp: Date.now(),
      });
      this.logger.log(
        `Cache invalidation pushed with version ${newVersion} for key Ingredients:all`,
      );
    }

    await this.redisService.delByPattern('Ingredients:all:country:*');

    return updatedIngredient;
  }

  async deleteIngredient(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Invalid ingredient ID');
    }

    // First, delete the ingredient from the database
    const deletedIngredient = await this.ingredientModel.findByIdAndDelete(id);
    
    if (!deletedIngredient) {
      throw new NotFoundException('Ingredient not found');
    }

    if (deletedIngredient.heroImageUrl) {
      try {
        await this.imageuploadService.deleteFile(deletedIngredient.heroImageUrl);
      } catch (error) {
        this.logger.warn(`Failed to delete image for ingredient ${id}: ${error.message}`);
      }
    }

    // Invalidate cache with versioned strategy - fetch remaining ingredients
    const ingredients = await this.ingredientModel
      .find()
      .populate('categoryId', 'name imageUrl')
      .populate('suitableDiets', 'name')
      .populate('parentIngredients', 'name')
      .populate('sponsorId', 'title logo')
      .populate('relatedHacks', 'title type')
      .populate('stickerId', 'title imageUrl')
      .sort({ order: 1, name: 1 })
      .lean();

    const { oldVersion, newVersion } = await this.redisService.setVersioned(
      'Ingredients:all',
      ingredients,
      60 * 20,
    );
    
    if (oldVersion > 0) {
      await this.sqsService.publishCacheInvalidation({
        eventType: 'CACHE_INVALIDATION',
        baseKey: 'Ingredients:all',
        invalidateVersions: [oldVersion],
        timestamp: Date.now(),
      });
      this.logger.log(
        `Cache invalidation pushed with version ${newVersion} for key Ingredients:all after deleting ingredient ${id}`,
      );
    }

    // Bust per-country caches
    await this.redisService.delByPattern('Ingredients:all:country:*');

    return { message: 'Ingredient deleted successfully' };
  }

  private async clearIngredientCache() {
    const keys = ['Ingredients:all'];
    await Promise.all(keys.map((key) => this.redisService.del(key)));
  }
}
