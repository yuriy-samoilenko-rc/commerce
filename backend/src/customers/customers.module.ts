import {
  Body,
  Controller,
  Get,
  Module,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuthService } from '../auth/auth.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../generated/prisma/client';
import {
  CreateCustomerDto,
  CustomerQueryDto,
  CustomersService,
  UpdateCustomerDto,
} from './customers.service';

/** Customer accounts for the people who sell: managers work with customers (ТЗ п.18). */
@Controller('admin/customers')
@Roles(Role.ADMIN, Role.MANAGER)
export class CustomersController {
  constructor(
    private readonly customers: CustomersService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  list(@Query() query: CustomerQueryDto) {
    return this.customers.list(query);
  }

  @Get(':id')
  card(@Param('id', ParseUUIDPipe) id: string) {
    return this.customers.card(id);
  }

  /** The new customer gets an email with a link to set their password. */
  @Post()
  async create(@Body() dto: CreateCustomerDto) {
    const customer = await this.customers.create(dto);
    await this.auth.inviteCustomer(customer);
    return customer;
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customers.update(id, dto);
  }
}

@Module({
  imports: [AuthModule],
  controllers: [CustomersController],
  providers: [CustomersService],
})
export class CustomersModule {}
