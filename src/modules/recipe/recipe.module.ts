import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';
import { RecipeController } from './recipe.controller';
import { RecipeService } from './recipe.service';
import { Recipe, RecipeSchema } from '../../database/schemas/recipe.schema';
import { RedisModule } from '../../redis/redis.module';
import { ImageUploadModule } from '../image-upload/image-upload.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Recipe.name, schema: RecipeSchema }]),
    MulterModule.register({
      limits: {
        fileSize: 10 * 1024 * 1024,
        files: 10, 
        fields: 100,
      },
    }),
    RedisModule,
    ImageUploadModule,
  ],
  controllers: [RecipeController],
  providers: [RecipeService],
  exports: [RecipeService],
})
export class RecipeModule {}