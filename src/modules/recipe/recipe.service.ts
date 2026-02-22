import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Recipe, RecipeDocument } from '../../database/schemas/recipe.schema';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { RedisService } from '../../redis/redis.service';
import { ImageUploadService } from '../image-upload/image-upload.service';

@Injectable()
export class RecipeService {
  private readonly CACHE_TTL = 1200; // 20 minutes
  private readonly CACHE_KEY_ALL = 'recipes:all';
  private readonly CACHE_KEY_SINGLE = 'recipes:single';
  private readonly CACHE_KEY_CATEGORY = 'recipes:category';

  constructor(
    @InjectModel(Recipe.name) private recipeModel: Model<RecipeDocument>,
    private readonly redisService: RedisService,
    private readonly imageUploadService: ImageUploadService,
  ) {}


  private processComponents(components: any[]): any[] {
    if (!Array.isArray(components) || components.length === 0) {
      throw new BadRequestException('At least one component wrapper is required');
    }

    return components.map((wrapper, wrapperIndex) => {
      // Support both `component` and `components` keys from the client
      const componentArray = Array.isArray(wrapper.component)
        ? wrapper.component
        : Array.isArray((wrapper as any).components)
        ? (wrapper as any).components
        : [];

      if (componentArray.length === 0) {
        throw new BadRequestException(
          `Component wrapper ${wrapperIndex} must have at least one component`
        );
      }

      return {
        prepShortDescription: wrapper.prepShortDescription,
        prepLongDescription: wrapper.prepLongDescription,
        variantTags: wrapper.variantTags || [],
        stronglyRecommended: wrapper.stronglyRecommended || false,
        choiceInstructions: wrapper.choiceInstructions,
        buttonText: wrapper.buttonText,
        component: componentArray.map((comp: any, compIndex: number) => {
          if (!comp.componentTitle || comp.componentTitle.trim() === '') {
            throw new BadRequestException(
              `Component title is required for wrapper ${wrapperIndex}, component ${compIndex}`
            );
          }

          return {
            componentTitle: comp.componentTitle,
            componentInstructions: comp.componentInstructions,
            includedInVariants: comp.includedInVariants || [],

            requiredIngredients: (comp.requiredIngredients || []).map(
              (reqIng: any, reqIndex: number) => {
                if (!reqIng.recommendedIngredient || !Types.ObjectId.isValid(reqIng.recommendedIngredient)) {
                  throw new BadRequestException(
                    `Invalid ingredient ID in wrapper ${wrapperIndex}, component ${compIndex}, required ingredient ${reqIndex}: "${reqIng.recommendedIngredient}"`
                  );
                }
                return {
                  recommendedIngredient: new Types.ObjectId(
                    reqIng.recommendedIngredient,
                  ),
                  quantity: reqIng.quantity,
                  preparation: reqIng.preparation,

                  alternativeIngredients: (
                    reqIng.alternativeIngredients || []
                  ).map((altIng: any, altIndex: number) => {
                    if (!altIng.ingredient || !Types.ObjectId.isValid(altIng.ingredient)) {
                      throw new BadRequestException(
                        `Invalid alternative ingredient ID in wrapper ${wrapperIndex}, component ${compIndex}, required ingredient ${reqIndex}, alternative ${altIndex}: "${altIng.ingredient}"`
                      );
                    }
                    return {
                      ingredient: new Types.ObjectId(altIng.ingredient),
                      inheritQuantity: altIng.inheritQuantity || false,
                      inheritPreparation: altIng.inheritPreparation || false,
                      quantity: altIng.quantity,
                      preparation: altIng.preparation,
                    };
                  }),
                };
              },
            ),

            optionalIngredients: (comp.optionalIngredients || []).map(
              (optIng: any, optIndex: number) => {
                if (!optIng.ingredient || !Types.ObjectId.isValid(optIng.ingredient)) {
                  throw new BadRequestException(
                    `Invalid optional ingredient ID in wrapper ${wrapperIndex}, component ${compIndex}, optional ingredient ${optIndex}: "${optIng.ingredient}"`
                  );
                }
                return {
                  ingredient: new Types.ObjectId(optIng.ingredient),
                  quantity: optIng.quantity,
                  preparation: optIng.preparation,
                };
              },
            ),

            componentSteps: (comp.componentSteps || []).map((step: any) => ({
              stepInstructions: step.stepInstructions,
              hackOrTipIds: (step.hackOrTipIds || [])
                .filter((id: string) => id && Types.ObjectId.isValid(id))
                .map((id: string) => new Types.ObjectId(id)),
              alwaysShow: step.alwaysShow || false,
              relevantIngredients: (step.relevantIngredients || [])
                .filter((id: string) => id && Types.ObjectId.isValid(id))
                .map((id: string) => new Types.ObjectId(id)),
            })),
          };
        }),
      };
    });
  }

  async create(
    createRecipeDto: CreateRecipeDto,
    heroImageFile?: Express.Multer.File,
  ): Promise<Recipe> {
    try {
      let heroImageUrl: string | undefined;
      if (heroImageFile) {
        heroImageUrl = await this.imageUploadService.uploadFile(
          heroImageFile,
          'recipes',
        );
      }

      const processedComponents = this.processComponents(
        createRecipeDto.components,
      );
      // Debug: log processed structure for the first wrapper/component
      if (processedComponents?.length) {
        const firstWrapper = processedComponents[0] as any;
        const firstComp = Array.isArray(firstWrapper?.component)
          ? firstWrapper.component[0]
          : undefined;
        // Using console.log here to ensure visibility even if Nest logger level changes
        console.log('RecipeService.processedComponents count:', processedComponents.length);
        console.log('RecipeService.firstWrapper keys:', Object.keys(firstWrapper || {}));
        if (firstComp) {
          console.log('RecipeService.firstComponent keys:', Object.keys(firstComp));
        }
      }

      // Validate and convert framework categories
      const validFrameworkCategories = createRecipeDto.frameworkCategories
        .filter(id => id && Types.ObjectId.isValid(id))
        .map(id => new Types.ObjectId(id));
      
      if (validFrameworkCategories.length === 0) {
        throw new BadRequestException('At least one valid framework category is required');
      }

      // Validate and convert optional ObjectId fields
      const recipeData: any = {
        ...createRecipeDto,
        heroImageUrl: heroImageUrl || createRecipeDto.heroImageUrl,
        hackOrTipIds: (createRecipeDto.hackOrTipIds || [])
          .filter(id => id && Types.ObjectId.isValid(id))
          .map(id => new Types.ObjectId(id)),
        frameworkCategories: validFrameworkCategories,
        useLeftoversIn: (createRecipeDto.useLeftoversIn || [])
          .filter(id => id && Types.ObjectId.isValid(id))
          .map(id => new Types.ObjectId(id)),
        stickerId: createRecipeDto.stickerId && Types.ObjectId.isValid(createRecipeDto.stickerId)
          ? new Types.ObjectId(createRecipeDto.stickerId)
          : undefined,
        sponsorId: createRecipeDto.sponsorId && Types.ObjectId.isValid(createRecipeDto.sponsorId)
          ? new Types.ObjectId(createRecipeDto.sponsorId)
          : undefined,
        components: processedComponents,
      };

      const recipe = new this.recipeModel(recipeData);
      const savedRecipe = await recipe.save();

      // Debug: confirm what was persisted
      try {
        const firstWrapper: any = (savedRecipe.components || [])[0];
        const firstComp: any = Array.isArray(firstWrapper?.component)
          ? firstWrapper.component[0]
          : undefined;
        console.log('SavedRecipe.components length:', savedRecipe.components?.length || 0);
        if (firstWrapper) {
          console.log('SavedRecipe.firstWrapper keys:', Object.keys(firstWrapper));
        }
        if (firstComp) {
          console.log('SavedRecipe.firstComponent keys:', Object.keys(firstComp));
          console.log('SavedRecipe.firstComponent requiredIngredients length:', firstComp.requiredIngredients?.length || 0);
          console.log('SavedRecipe.firstComponent optionalIngredients length:', firstComp.optionalIngredients?.length || 0);
          console.log('SavedRecipe.firstComponent componentSteps length:', firstComp.componentSteps?.length || 0);
        }
      } catch (e) {
        console.log('SavedRecipe debug logging failed:', e?.message);
      }

      await this.redisService.del(this.CACHE_KEY_ALL);
      await this.redisService.delByPattern(`${this.CACHE_KEY_ALL}:country:*`);
      await this.redisService.delByPattern(`${this.CACHE_KEY_CATEGORY}:*:country:*`);
      // Also clear per-category caches for affected framework categories
      try {
        for (const catId of recipeData.frameworkCategories || []) {
          await this.redisService.del(
            `${this.CACHE_KEY_CATEGORY}:${catId.toString()}`,
          );
        }
      } catch (e) {
        console.warn('Failed clearing category cache after create:', e?.message);
      }

      return savedRecipe;
    } catch (error) {
      throw new BadRequestException(
        `Failed to create recipe: ${error.message}`,
      );
    }
  }

 
 
  async findAll(country?: string): Promise<Recipe[]> {
    // Country-specific cache key so each country gets its own cached result
    const cacheKey = country
      ? `${this.CACHE_KEY_ALL}:country:${country.toLowerCase()}`
      : this.CACHE_KEY_ALL;

    try {
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.error('Error parsing cached recipes, clearing cache:', error.message);
      await this.redisService.del(cacheKey);
    }

    try {
      // Clean up any recipes with empty string ObjectId fields before querying
      await this.recipeModel.updateMany(
        { 
          $or: [
            { stickerId: '' },
            { sponsorId: '' },
          ]
        },
        { 
          $unset: { 
            stickerId: 1,
            sponsorId: 1,
          } 
        }
      );

      // Build the match query with optional country filter.
      // Recipes with an empty countries array are globally available.
      // Recipes with a non-empty countries array are only shown to users
      // whose country is listed.
      const matchQuery: any = { isActive: true };
      if (country) {
        matchQuery.$or = [
          { countries: { $size: 0 } },
          { countries: country },
        ];
      }

      const recipes = await this.recipeModel
        .find(matchQuery)
        .populate('hackOrTipIds')
        .populate('stickerId')
        .populate('frameworkCategories')
        .populate('sponsorId')
        .populate('useLeftoversIn')
        .populate({
          path: 'components.component.requiredIngredients.recommendedIngredient',
          model: 'Ingredient',
        })
        .populate({
          path: 'components.component.requiredIngredients.alternativeIngredients.ingredient',
          model: 'Ingredient',
        })
        .populate({
          path: 'components.component.optionalIngredients.ingredient',
          model: 'Ingredient',
        })
        .populate({
          path: 'components.component.componentSteps.hackOrTipIds',
          model: 'HackOrTip',
        })
        .populate({
          path: 'components.component.componentSteps.relevantIngredients',
          model: 'Ingredient',
        })
        .sort({ order: 1 })
        .lean()
        .exec();

      await this.redisService.set(
        cacheKey,
        JSON.stringify(recipes),
        this.CACHE_TTL,
      );

      return recipes;
    } catch (error) {
      console.error('Error fetching recipes from database:', error);
      throw new BadRequestException(
        `Failed to fetch recipes: ${error.message}`,
      );
    }
  }

  
  async findOne(id: string): Promise<Recipe> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid recipe ID format');
    }

    const cacheKey = `${this.CACHE_KEY_SINGLE}:${id}`;
    try {
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.error('Error parsing cached recipe, clearing cache:', error.message);
      await this.redisService.del(cacheKey);
    }

    const recipe = await this.recipeModel
      .findById(id)
      .populate('hackOrTipIds')
      .populate('stickerId')
      .populate('frameworkCategories')
      .populate('sponsorId')
      .populate('useLeftoversIn')
      .populate({
        path: 'components.component.requiredIngredients.recommendedIngredient',
        model: 'Ingredient',
      })
      .populate({
        path: 'components.component.requiredIngredients.alternativeIngredients.ingredient',
        model: 'Ingredient',
      })
      .populate({
        path: 'components.component.optionalIngredients.ingredient',
        model: 'Ingredient',
      })
      .populate({
        path: 'components.component.componentSteps.hackOrTipIds',
        model: 'HackOrTip',
      })
      .populate({
        path: 'components.component.componentSteps.relevantIngredients',
        model: 'Ingredient',
      })
      .lean()
      .exec();

    if (!recipe) {
      throw new NotFoundException(`Recipe with ID ${id} not found`);
    }

    await this.redisService.set(
      cacheKey,
      JSON.stringify(recipe),
      this.CACHE_TTL,
    );

    return recipe;
  }


  async findByFrameworkCategory(categoryId: string, country?: string): Promise<Recipe[]> {
    if (!Types.ObjectId.isValid(categoryId)) {
      throw new BadRequestException('Invalid category ID format');
    }

    const cacheKey = country
      ? `${this.CACHE_KEY_CATEGORY}:${categoryId}:country:${country.toLowerCase()}`
      : `${this.CACHE_KEY_CATEGORY}:${categoryId}`;
    try {
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.error('Error parsing cached recipes by category, clearing cache:', error.message);
      await this.redisService.del(cacheKey);
    }

    const matchQuery: any = {
      frameworkCategories: new Types.ObjectId(categoryId),
      isActive: true,
    };
    if (country) {
      matchQuery.$or = [
        { countries: { $size: 0 } },
        { countries: country },
      ];
    }

    const recipes = await this.recipeModel
      .find(matchQuery)
      .populate('hackOrTipIds')
      .populate('stickerId')
      .populate('frameworkCategories')
      .populate('sponsorId')
      .populate({
        path: 'components.component.requiredIngredients.recommendedIngredient',
        model: 'Ingredient',
      })
      .populate({
        path: 'components.component.optionalIngredients.ingredient',
        model: 'Ingredient',
      })
      .sort({ order: 1 })
      .lean()
      .exec();

    await this.redisService.set(
      cacheKey,
      JSON.stringify(recipes),
      this.CACHE_TTL,
    );

    return recipes;
  }

  async findByIngredient(ingredientId: string, country?: string): Promise<Recipe[]> {
    if (!Types.ObjectId.isValid(ingredientId)) {
      throw new BadRequestException('Invalid ingredient ID format');
    }

    const cacheKey = country
      ? `recipes:ingredient:${ingredientId}:country:${country.toLowerCase()}`
      : `recipes:ingredient:${ingredientId}`;
    try {
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.error('Error parsing cached recipes by ingredient, clearing cache:', error.message);
      await this.redisService.del(cacheKey);
    }

    const ingredientObjectId = new Types.ObjectId(ingredientId);

    // Build the match query: filter by ingredient presence plus optional country.
    const ingredientConditions = [
      { 'components.component.requiredIngredients.recommendedIngredient': ingredientObjectId },
      { 'components.component.requiredIngredients.alternativeIngredients.ingredient': ingredientObjectId },
      { 'components.component.optionalIngredients.ingredient': ingredientObjectId },
    ];

    const matchQuery: any = { isActive: true, $or: ingredientConditions };
    if (country) {
      matchQuery.$and = [
        { $or: ingredientConditions },
        {
          $or: [
            { countries: { $size: 0 } },
            { countries: country },
          ],
        },
      ];
      delete matchQuery.$or; // move to $and
    }

    // Find recipes where the ingredient appears in:
    // 1. Required ingredients (recommendedIngredient)
    // 2. Alternative ingredients
    // 3. Optional ingredients
    const recipes = await this.recipeModel
      .find(matchQuery)
      .populate('hackOrTipIds')
      .populate('stickerId')
      .populate('frameworkCategories')
      .populate('sponsorId')
      .populate('useLeftoversIn')
      .populate({
        path: 'components.component.requiredIngredients.recommendedIngredient',
        model: 'Ingredient',
      })
      .populate({
        path: 'components.component.requiredIngredients.alternativeIngredients.ingredient',
        model: 'Ingredient',
      })
      .populate({
        path: 'components.component.optionalIngredients.ingredient',
        model: 'Ingredient',
      })
      .populate({
        path: 'components.component.componentSteps.hackOrTipIds',
        model: 'HackOrTip',
      })
      .populate({
        path: 'components.component.componentSteps.relevantIngredients',
        model: 'Ingredient',
      })
      .sort({ order: 1 })
      .lean()
      .exec();

    await this.redisService.set(
      cacheKey,
      JSON.stringify(recipes),
      this.CACHE_TTL,
    );

    return recipes;
  }


  async update(
    id: string,
    updateRecipeDto: UpdateRecipeDto,
    heroImageFile?: Express.Multer.File,
  ): Promise<Recipe> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid recipe ID format');
    }

    const existingRecipe = await this.recipeModel.findById(id);
    if (!existingRecipe) {
      throw new NotFoundException(`Recipe with ID ${id} not found`);
    }

    try {
      let heroImageUrl = updateRecipeDto.heroImageUrl;
      if (heroImageFile) {
        heroImageUrl = await this.imageUploadService.uploadFile(
          heroImageFile,
          'recipes',
        );

        if (existingRecipe.heroImageUrl) {
          await this.imageUploadService.deleteFile(
            existingRecipe.heroImageUrl,
          );
        }
      }

      const processedComponents = updateRecipeDto.components
        ? this.processComponents(updateRecipeDto.components)
        : undefined;

      const updateData: any = {
        ...updateRecipeDto,
      };

      if (heroImageUrl) {
        updateData.heroImageUrl = heroImageUrl;
      }

      if (updateRecipeDto.hackOrTipIds) {
        updateData.hackOrTipIds = updateRecipeDto.hackOrTipIds
          .filter(id => id && Types.ObjectId.isValid(id))
          .map((id) => new Types.ObjectId(id));
      }

      if (updateRecipeDto.frameworkCategories) {
        const validCategories = updateRecipeDto.frameworkCategories
          .filter(id => id && Types.ObjectId.isValid(id))
          .map((id) => new Types.ObjectId(id));
        
        if (validCategories.length === 0) {
          throw new BadRequestException('At least one valid framework category is required');
        }
        
        updateData.frameworkCategories = validCategories;
      }

      if (updateRecipeDto.useLeftoversIn) {
        updateData.useLeftoversIn = updateRecipeDto.useLeftoversIn
          .filter(id => id && Types.ObjectId.isValid(id))
          .map((id) => new Types.ObjectId(id));
      }

      if (updateRecipeDto.stickerId && Types.ObjectId.isValid(updateRecipeDto.stickerId)) {
        updateData.stickerId = new Types.ObjectId(updateRecipeDto.stickerId);
      }

      if (updateRecipeDto.sponsorId && Types.ObjectId.isValid(updateRecipeDto.sponsorId)) {
        updateData.sponsorId = new Types.ObjectId(updateRecipeDto.sponsorId);
      }

      if (processedComponents) {
        updateData.components = processedComponents;
      }

      const updatedRecipe = await this.recipeModel
        .findByIdAndUpdate(id, updateData, { new: true })
        .exec();

      if (!updatedRecipe) {
        throw new NotFoundException(`Recipe with ID ${id} not found after update`);
      }

      await this.redisService.del(this.CACHE_KEY_ALL);
      await this.redisService.del(`${this.CACHE_KEY_SINGLE}:${id}`);
      await this.redisService.delByPattern(`${this.CACHE_KEY_ALL}:country:*`);
      await this.redisService.delByPattern(`${this.CACHE_KEY_CATEGORY}:*:country:*`);

      // Clear caches for previous and new category IDs
      try {
        const prevCats = existingRecipe.frameworkCategories || [];
        for (const catId of prevCats) {
          await this.redisService.del(
            `${this.CACHE_KEY_CATEGORY}:${catId.toString()}`,
          );
        }
        const newCats = updatedRecipe.frameworkCategories || [];
        for (const catId of newCats) {
          await this.redisService.del(
            `${this.CACHE_KEY_CATEGORY}:${catId.toString()}`,
          );
        }
      } catch (e) {
        console.warn('Failed clearing category cache after update:', e?.message);
      }

      return updatedRecipe;
    } catch (error) {
      throw new BadRequestException(
        `Failed to update recipe: ${error.message}`,
      );
    }
  }

  
  async remove(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid recipe ID format');
    }

    const recipe = await this.recipeModel.findById(id);
    if (!recipe) {
      throw new NotFoundException(`Recipe with ID ${id} not found`);
    }

    if (recipe.heroImageUrl) {
      await this.imageUploadService.deleteFile(recipe.heroImageUrl);
    }

    await this.recipeModel.findByIdAndDelete(id).exec();

    await this.redisService.del(this.CACHE_KEY_ALL);
    await this.redisService.del(`${this.CACHE_KEY_SINGLE}:${id}`);
    await this.redisService.delByPattern(`${this.CACHE_KEY_ALL}:country:*`);
    await this.redisService.delByPattern(`${this.CACHE_KEY_CATEGORY}:*:country:*`);

    if (recipe.frameworkCategories) {
      for (const catId of recipe.frameworkCategories) {
        await this.redisService.del(
          `${this.CACHE_KEY_CATEGORY}:${catId.toString()}`,
        );
      }
    }
  }
}