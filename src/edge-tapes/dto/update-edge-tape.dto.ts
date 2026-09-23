import { PartialType } from '@nestjs/swagger';
import { CreateEdgeTapeDto } from './create-edge-tape.dto.js';

export class UpdateEdgeTapeDto extends PartialType(CreateEdgeTapeDto) {}
