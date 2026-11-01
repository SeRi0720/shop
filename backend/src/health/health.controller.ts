import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  async check() {
    const { healthy, body } = await this.health.check();
    if (!healthy) throw new ServiceUnavailableException(body); // 503, thân JSON giữ nguyên
    return body;
  }
}
