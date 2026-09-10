import { PartialType } from '@nestjs/swagger';
import { CreatePartDto } from './create-part.dto.js';

export class UpdatePartDto extends PartialType(CreatePartDto) {}
