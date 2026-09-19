import { PartialType } from '@nestjs/swagger';
import { CreateMaterialDto } from './create-material.dto.js';

export class UpdateMaterialDto extends PartialType(CreateMaterialDto) {}
